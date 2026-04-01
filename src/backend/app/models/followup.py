"""FollowUp model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class FollowUp(SQLModel, table=True):
    __tablename__ = "followup"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id")
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id")
    contact_id: Optional[str] = Field(default=None, foreign_key="contact.id")
    owner_id: str = Field(foreign_key="user.id")
    type: str  # phone, wechat, visit, other
    source: str = Field(default="manual")  # manual, ai
    content: str
    followed_at: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
