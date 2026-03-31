import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Role(SQLModel, table=True):
    __tablename__ = "role"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(nullable=False, unique=True)
    description: Optional[str] = Field(default=None)
    is_system: bool = Field(default=False, nullable=False)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class Permission(SQLModel, table=True):
    __tablename__ = "permission"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    code: str = Field(nullable=False, unique=True)   # e.g. 'lead.create'
    module: str = Field(nullable=False)               # e.g. 'lead'
    name: str = Field(nullable=False)


class RolePermission(SQLModel, table=True):
    __tablename__ = "role_permission"

    role_id: str = Field(foreign_key="role.id", primary_key=True)
    permission_id: str = Field(foreign_key="permission.id", primary_key=True)


class UserRole(SQLModel, table=True):
    __tablename__ = "user_role"

    user_id: str = Field(foreign_key="user.id", primary_key=True)
    role_id: str = Field(foreign_key="role.id", primary_key=True)


class UserDataScope(SQLModel, table=True):
    __tablename__ = "user_data_scope"

    user_id: str = Field(foreign_key="user.id", primary_key=True)
    scope: str = Field(nullable=False)  # self_only|current_node|current_and_below|selected_nodes|all
    node_ids: Optional[str] = Field(default=None)  # JSON array, only for selected_nodes
