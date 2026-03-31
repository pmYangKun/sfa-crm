import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class OrgNode(SQLModel, table=True):
    __tablename__ = "org_node"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(nullable=False)
    type: str = Field(nullable=False)  # root | region | team | custom
    parent_id: Optional[str] = Field(default=None, foreign_key="org_node.id")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    parent: Optional["OrgNode"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "OrgNode.id"},
    )
    children: list["OrgNode"] = Relationship(back_populates="parent")
    users: list["User"] = Relationship(back_populates="org_node")


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(nullable=False)
    login: str = Field(nullable=False, unique=True)
    password_hash: str = Field(nullable=False)
    org_node_id: str = Field(foreign_key="org_node.id", nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    org_node: Optional[OrgNode] = Relationship(back_populates="users")
