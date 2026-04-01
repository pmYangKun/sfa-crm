"""
User management API (T086).

GET  /users               — list users (admin)
POST /users               — create user
PATCH /users/{id}         — update user (name, org_node, active)
POST /users/{id}/roles    — replace user's roles
POST /users/{id}/scope    — configure data scope
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.auth import Role, UserDataScope, UserRole
from app.models.org import OrgNode, User

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    login: str
    password: str
    org_node_id: str
    role_names: list[str] = []
    scope: str = "self_only"


class UserResponse(BaseModel):
    id: str
    name: str
    login: str
    org_node_id: str
    is_active: bool
    roles: list[str]
    scope: Optional[str]


class UserUpdate(BaseModel):
    name: Optional[str] = None
    org_node_id: Optional[str] = None
    is_active: Optional[bool] = None


class RoleAssignment(BaseModel):
    role_names: list[str]


class ScopeAssignment(BaseModel):
    scope: str  # self_only | current_node | current_and_below | selected_nodes | all
    node_ids: Optional[list[str]] = None


# ── GET /users ────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:users"))],
):
    users = session.exec(select(User)).all()
    return [_to_response(session, u) for u in users]


# ── POST /users ───────────────────────────────────────────────────────────────

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:users"))],
):
    if session.exec(select(User).where(User.login == body.login)).first():
        raise HTTPException(status_code=400, detail="登录名已存在")
    if not session.get(OrgNode, body.org_node_id):
        raise HTTPException(status_code=400, detail="组织节点不存在")

    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        name=body.name,
        login=body.login,
        password_hash=_pwd.hash(body.password),
        org_node_id=body.org_node_id,
    )
    session.add(user)
    session.flush()

    _assign_roles(session, user_id, body.role_names)
    _assign_scope(session, user_id, body.scope, None)

    session.commit()
    session.refresh(user)
    return _to_response(session, user)


# ── PATCH /users/{id} ─────────────────────────────────────────────────────────

@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    body: UserUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:users"))],
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if body.name is not None:
        user.name = body.name
    if body.org_node_id is not None:
        if not session.get(OrgNode, body.org_node_id):
            raise HTTPException(status_code=400, detail="组织节点不存在")
        user.org_node_id = body.org_node_id
    if body.is_active is not None:
        user.is_active = body.is_active
    session.add(user)
    session.commit()
    session.refresh(user)
    return _to_response(session, user)


# ── POST /users/{id}/roles ────────────────────────────────────────────────────

@router.post("/users/{user_id}/roles", response_model=UserResponse)
def assign_roles(
    user_id: str,
    body: RoleAssignment,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # Remove existing roles
    existing = session.exec(select(UserRole).where(UserRole.user_id == user_id)).all()
    for ur in existing:
        session.delete(ur)
    session.flush()

    _assign_roles(session, user_id, body.role_names)
    session.commit()
    session.refresh(user)
    return _to_response(session, user)


# ── POST /users/{id}/scope ────────────────────────────────────────────────────

@router.post("/users/{user_id}/scope", response_model=UserResponse)
def assign_scope(
    user_id: str,
    body: ScopeAssignment,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:users"))],
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    existing = session.exec(select(UserDataScope).where(UserDataScope.user_id == user_id)).first()
    if existing:
        session.delete(existing)
        session.flush()

    import json
    node_ids_json = json.dumps(body.node_ids) if body.node_ids else None
    _assign_scope(session, user_id, body.scope, node_ids_json)
    session.commit()
    session.refresh(user)
    return _to_response(session, user)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assign_roles(session: Session, user_id: str, role_names: list[str]) -> None:
    for name in role_names:
        role = session.exec(select(Role).where(Role.name == name)).first()
        if role:
            session.add(UserRole(user_id=user_id, role_id=role.id))


def _assign_scope(session: Session, user_id: str, scope: str, node_ids: Optional[str]) -> None:
    session.add(UserDataScope(user_id=user_id, scope=scope, node_ids=node_ids))


def _to_response(session: Session, user: User) -> UserResponse:
    role_ids = session.exec(select(UserRole.role_id).where(UserRole.user_id == user.id)).all()
    roles = [r.name for r in session.exec(select(Role).where(Role.id.in_(role_ids))).all()] if role_ids else []  # type: ignore[attr-defined]
    scope_rec = session.exec(select(UserDataScope).where(UserDataScope.user_id == user.id)).first()
    return UserResponse(
        id=user.id, name=user.name, login=user.login,
        org_node_id=user.org_node_id, is_active=user.is_active,
        roles=roles, scope=scope_rec.scope if scope_rec else None,
    )
