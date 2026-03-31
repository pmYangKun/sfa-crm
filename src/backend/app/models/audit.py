import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="user.id")
    action: str = Field(nullable=False)        # e.g. 'assign_lead'
    entity_type: Optional[str] = Field(default=None)  # e.g. 'lead'
    entity_id: Optional[str] = Field(default=None)
    payload: Optional[str] = Field(default=None)       # JSON
    ip: Optional[str] = Field(default=None)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
