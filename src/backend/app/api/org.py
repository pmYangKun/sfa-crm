"""Organization management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.org import OrgNode, User

router = APIRouter()


class OrgNodeCreate(BaseModel):
    name: str
    type: str
    parent_id: Optional[str] = None


class OrgNodeUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    parent_id: Optional[str] = None


@router.get("/org/nodes")
def list_org_nodes(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("org.manage")),
):
    nodes = session.exec(select(OrgNode)).all()
    return nodes


@router.post("/org/nodes")
def create_org_node(
    body: OrgNodeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("org.manage")),
):
    node = OrgNode(name=body.name, type=body.type, parent_id=body.parent_id)
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


@router.patch("/org/nodes/{node_id}")
def update_org_node(
    node_id: str,
    body: OrgNodeUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("org.manage")),
):
    node = session.get(OrgNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if body.name is not None:
        node.name = body.name
    if body.type is not None:
        node.type = body.type
    if body.parent_id is not None:
        node.parent_id = body.parent_id
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


@router.delete("/org/nodes/{node_id}")
def delete_org_node(
    node_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("org.manage")),
):
    node = session.get(OrgNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Check for active users
    users = session.exec(
        select(User).where(User.org_node_id == node_id, User.is_active == True)  # noqa: E712
    ).all()
    if users:
        raise HTTPException(status_code=400, detail={
            "code": "USER_HAS_ACTIVE_DATA",
            "message": f"该节点下有 {len(users)} 个活跃用户，无法删除",
        })

    # Check for child nodes
    children = session.exec(select(OrgNode).where(OrgNode.parent_id == node_id)).all()
    if children:
        raise HTTPException(status_code=400, detail="该节点有子节点，无法删除")

    session.delete(node)
    session.commit()
    return {"status": "deleted"}
