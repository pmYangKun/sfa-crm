"""User management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.auth import hash_password
from app.core.database import get_session
from app.core.deps import require_permission
from app.models.auth import Role, UserDataScope, UserRole
from app.models.lead import Lead
from app.models.org import User

router = APIRouter()


class UserCreate(BaseModel):
    name: str
    login: str
    password: str
    org_node_id: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    org_node_id: Optional[str] = None


class RoleAssign(BaseModel):
    role_id: str


class DataScopeUpdate(BaseModel):
    scope: str
    node_ids: Optional[list[str]] = None


class UserResponse(BaseModel):
    id: str
    name: str
    login: str
    org_node_id: str
    is_active: bool
    created_at: str
    roles: list[str]


class UserListResponse(BaseModel):
    total: int
    items: list[UserResponse]


def _user_to_response(user: User, session: Session) -> UserResponse:
    role_ids = session.exec(select(UserRole.role_id).where(UserRole.user_id == user.id)).all()
    roles = []
    for rid in role_ids:
        role = session.get(Role, rid)
        if role:
            roles.append(role.name)
    return UserResponse(
        id=user.id, name=user.name, login=user.login,
        org_node_id=user.org_node_id, is_active=user.is_active,
        created_at=user.created_at, roles=roles,
    )


@router.get("/users", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    stmt = select(User)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    users = session.exec(stmt.offset((page - 1) * size).limit(size)).all()
    return UserListResponse(total=total, items=[_user_to_response(u, session) for u in users])


@router.post("/users", response_model=UserResponse)
def create_user(
    body: UserCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    existing = session.exec(select(User).where(User.login == body.login)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Login already exists")

    user = User(
        name=body.name, login=body.login,
        password_hash=hash_password(body.password),
        org_node_id=body.org_node_id,
    )
    session.add(user)
    session.flush()

    # Default data scope
    session.add(UserDataScope(user_id=user.id, scope="self_only"))
    session.commit()
    return _user_to_response(user, session)


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None:
        user.name = body.name
    if body.org_node_id is not None:
        user.org_node_id = body.org_node_id
    session.add(user)
    session.commit()
    return _user_to_response(user, session)


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    active_leads = session.exec(
        select(func.count()).where(Lead.owner_id == user_id, Lead.stage == "active")
    ).one()
    if active_leads > 0:
        raise HTTPException(status_code=400, detail={
            "code": "USER_HAS_ACTIVE_DATA",
            "message": f"用户名下有 {active_leads} 条活跃线索，无法停用",
        })

    user.is_active = False
    session.add(user)
    session.commit()
    return {"status": "deactivated"}


@router.post("/users/{user_id}/roles")
def assign_role(
    user_id: str,
    body: RoleAssign,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    existing = session.exec(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == body.role_id)
    ).first()
    if existing:
        return {"status": "already_assigned"}
    session.add(UserRole(user_id=user_id, role_id=body.role_id))
    session.commit()
    return {"status": "assigned"}


@router.delete("/users/{user_id}/roles/{role_id}")
def remove_role(
    user_id: str,
    role_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    ur = session.exec(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id)
    ).first()
    if not ur:
        raise HTTPException(status_code=404, detail="Role assignment not found")
    session.delete(ur)
    session.commit()
    return {"status": "removed"}


@router.patch("/users/{user_id}/data-scope")
def update_data_scope(
    user_id: str,
    body: DataScopeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    import json
    scope = session.exec(select(UserDataScope).where(UserDataScope.user_id == user_id)).first()
    if scope:
        scope.scope = body.scope
        scope.node_ids = json.dumps(body.node_ids) if body.node_ids else None
    else:
        scope = UserDataScope(
            user_id=user_id, scope=body.scope,
            node_ids=json.dumps(body.node_ids) if body.node_ids else None,
        )
    session.add(scope)
    session.commit()
    return {"status": "updated"}
