import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    __tablename__ = "notification"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True, nullable=False)
    type: str = Field(nullable=False)          # e.g. "lead_released"
    title: str = Field(nullable=False)
    body: str = Field(nullable=False)
    is_read: bool = Field(default=False, nullable=False)
    entity_type: Optional[str] = Field(default=None)  # e.g. "lead"
    entity_id: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
