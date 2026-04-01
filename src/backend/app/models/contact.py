"""Contact and ContactRelation models."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Contact(SQLModel, table=True):
    __tablename__ = "contact"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id")
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id")
    name: str
    role: Optional[str] = None
    is_key_decision_maker: bool = Field(default=False)
    wechat_id: Optional[str] = None
    phone: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ContactRelation(SQLModel, table=True):
    __tablename__ = "contact_relation"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    contact_a_id: str = Field(foreign_key="contact.id")
    contact_b_id: str = Field(foreign_key="contact.id")
    relation_type: str  # spouse, relative, partner, friend
    note: Optional[str] = None
    created_by: str = Field(foreign_key="user.id")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
