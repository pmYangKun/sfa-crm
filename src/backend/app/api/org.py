"""
Organization management API (T085).

GET  /org/nodes              — list all org nodes
POST /org/nodes              — create an org node
PATCH /org/nodes/{id}        — update node name/type
DELETE /org/nodes/{id}       — deactivate (only if no active users attached)
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.org import OrgNode, User

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class OrgNodeCreate(BaseModel):
    name: str
    type: str  # root | region | team | custom
    parent_id: Optional[str] = None


class OrgNodeResponse(BaseModel):
    id: str
    name: str
    type: str
    parent_id: Optional[str]
    created_at: str
    user_count: int = 0

    model_config = {"from_attributes": False}


class OrgNodeUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None


@router.get("/org/nodes", response_model=list[OrgNodeResponse])
def list_org_nodes(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:org"))],
):
    nodes = session.exec(select(OrgNode)).all()
    result = []
    for node in nodes:
        count = len(session.exec(select(User).where(User.org_node_id == node.id, User.is_active == True)).all())  # noqa: E712
        result.append(OrgNodeResponse(
            id=node.id, name=node.name, type=node.type,
            parent_id=node.parent_id, created_at=node.created_at,
            user_count=count,
        ))
    return result


@router.post("/org/nodes", response_model=OrgNodeResponse, status_code=status.HTTP_201_CREATED)
def create_org_node(
    body: OrgNodeCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:org"))],
):
    if body.parent_id and not session.get(OrgNode, body.parent_id):
        raise HTTPException(status_code=400, detail="父节点不存在")

    node = OrgNode(id=str(uuid.uuid4()), name=body.name, type=body.type, parent_id=body.parent_id)
    session.add(node)
    session.commit()
    session.refresh(node)
    return OrgNodeResponse(id=node.id, name=node.name, type=node.type,
                           parent_id=node.parent_id, created_at=node.created_at)


@router.patch("/org/nodes/{node_id}", response_model=OrgNodeResponse)
def update_org_node(
    node_id: str,
    body: OrgNodeUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:org"))],
):
    node = session.get(OrgNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    if body.name:
        node.name = body.name
    if body.type:
        node.type = body.type
    session.add(node)
    session.commit()
    session.refresh(node)
    count = len(session.exec(select(User).where(User.org_node_id == node.id, User.is_active == True)).all())  # noqa: E712
    return OrgNodeResponse(id=node.id, name=node.name, type=node.type,
                           parent_id=node.parent_id, created_at=node.created_at, user_count=count)


@router.delete("/org/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org_node(
    node_id: str,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:org"))],
):
    node = session.get(OrgNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")

    active_users = session.exec(
        select(User).where(User.org_node_id == node_id, User.is_active == True)  # noqa: E712
    ).all()
    if active_users:
        raise HTTPException(status_code=400, detail=f"节点下有 {len(active_users)} 名活跃用户，无法删除")

    session.delete(node)
    session.commit()
