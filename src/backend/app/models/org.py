"""OrgNode and User models."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class OrgNode(SQLModel, table=True):
    __tablename__ = "org_node"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    type: str  # 'root', 'region', 'team', 'custom'
    parent_id: Optional[str] = Field(default=None, foreign_key="org_node.id")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    parent: Optional["OrgNode"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "OrgNode.id"},
    )
    children: list["OrgNode"] = Relationship(back_populates="parent")
    users: list["User"] = Relationship(back_populates="org_node")


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    login: str = Field(unique=True)
    password_hash: str
    org_node_id: str = Field(foreign_key="org_node.id")
    is_active: bool = Field(default=True)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    org_node: Optional[OrgNode] = Relationship(back_populates="users")
