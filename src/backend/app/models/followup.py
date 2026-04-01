import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FollowUp(SQLModel, table=True):
    __tablename__ = "followup"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id", index=True)
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id", index=True)
    contact_id: Optional[str] = Field(default=None, foreign_key="contact.id")
    owner_id: str = Field(foreign_key="user.id", nullable=False, index=True)
    type: str = Field(nullable=False)       # phone | wechat | visit | other
    source: str = Field(default="manual", nullable=False)  # manual | ai
    content: str = Field(nullable=False)
    followed_at: datetime = Field(nullable=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
