"""
Role & permission management API (T087).

GET  /roles                      — list all roles with their permissions
GET  /permissions                — list all permission codes
POST /roles                      — create role
PATCH /roles/{id}                — update role name/description
DELETE /roles/{id}               — delete non-system role
PUT /roles/{id}/permissions      — replace permissions for a role
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.auth import Permission, Role, RolePermission

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class RolePermissionUpdate(BaseModel):
    permission_codes: list[str]


class PermissionResponse(BaseModel):
    id: str
    code: str
    module: str
    name: str


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    is_system: bool
    permissions: list[str]  # list of permission codes


# ── Helpers ───────────────────────────────────────────────────────────────────

def _role_to_response(session: Session, role: Role) -> RoleResponse:
    rp_rows = session.exec(select(RolePermission).where(RolePermission.role_id == role.id)).all()
    perm_ids = [r.permission_id for r in rp_rows]
    if perm_ids:
        perms = session.exec(select(Permission).where(Permission.id.in_(perm_ids))).all()  # type: ignore[attr-defined]
        codes = [p.code for p in perms]
    else:
        codes = []
    return RoleResponse(
        id=role.id, name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=codes,
    )


# ── GET /permissions ──────────────────────────────────────────────────────────

@router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    return session.exec(select(Permission)).all()


# ── GET /roles ────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    roles = session.exec(select(Role)).all()
    return [_role_to_response(session, r) for r in roles]


# ── POST /roles ───────────────────────────────────────────────────────────────

@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    body: RoleCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    if session.exec(select(Role).where(Role.name == body.name)).first():
        raise HTTPException(status_code=400, detail="角色名称已存在")
    role = Role(id=str(uuid.uuid4()), name=body.name, description=body.description)
    session.add(role)
    session.commit()
    session.refresh(role)
    return _role_to_response(session, role)


# ── PATCH /roles/{id} ─────────────────────────────────────────────────────────

@router.patch("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: str,
    body: RoleUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色不可修改")
    if body.name is not None:
        role.name = body.name
    if body.description is not None:
        role.description = body.description
    session.add(role)
    session.commit()
    session.refresh(role)
    return _role_to_response(session, role)


# ── DELETE /roles/{id} ────────────────────────────────────────────────────────

@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: str,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色不可删除")
    # Remove permission assignments
    for rp in session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all():
        session.delete(rp)
    session.delete(role)
    session.commit()


# ── PUT /roles/{id}/permissions ───────────────────────────────────────────────

@router.put("/roles/{role_id}/permissions", response_model=RoleResponse)
def set_role_permissions(
    role_id: str,
    body: RolePermissionUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:roles"))],
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")

    # Remove existing
    for rp in session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all():
        session.delete(rp)
    session.flush()

    # Add new
    for code in body.permission_codes:
        perm = session.exec(select(Permission).where(Permission.code == code)).first()
        if perm:
            session.add(RolePermission(role_id=role_id, permission_id=perm.id))

    session.commit()
    session.refresh(role)
    return _role_to_response(session, role)
