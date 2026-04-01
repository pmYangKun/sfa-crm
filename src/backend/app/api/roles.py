"""Role management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.auth import Permission, Role, RolePermission, UserRole
from app.models.org import User

router = APIRouter()


class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PermissionsUpdate(BaseModel):
    permission_ids: list[str]


@router.get("/roles")
def list_roles(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    roles = session.exec(select(Role)).all()
    result = []
    for role in roles:
        perm_ids = session.exec(
            select(RolePermission.permission_id).where(RolePermission.role_id == role.id)
        ).all()
        perms = []
        for pid in perm_ids:
            p = session.get(Permission, pid)
            if p:
                perms.append({"id": p.id, "code": p.code, "name": p.name})
        result.append({
            "id": role.id, "name": role.name, "description": role.description,
            "is_system": role.is_system, "permissions": perms,
        })
    return result


@router.get("/permissions")
def list_permissions(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    return session.exec(select(Permission)).all()


@router.post("/roles")
def create_role(
    body: RoleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    role = Role(name=body.name, description=body.description)
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


@router.patch("/roles/{role_id}/permissions")
def update_role_permissions(
    role_id: str,
    body: PermissionsUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Remove existing permissions
    existing = session.exec(
        select(RolePermission).where(RolePermission.role_id == role_id)
    ).all()
    for rp in existing:
        session.delete(rp)

    # Add new permissions
    for pid in body.permission_ids:
        session.add(RolePermission(role_id=role_id, permission_id=pid))

    session.commit()
    return {"status": "updated"}


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("user.manage")),
):
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="系统内置角色无法删除")

    users = session.exec(select(UserRole).where(UserRole.role_id == role_id)).all()
    if users:
        raise HTTPException(status_code=400, detail="有用户持有此角色，无法删除")

    # Remove permissions
    rps = session.exec(select(RolePermission).where(RolePermission.role_id == role_id)).all()
    for rp in rps:
        session.delete(rp)

    session.delete(role)
    session.commit()
    return {"status": "deleted"}
