"""KeyEvent model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class KeyEvent(SQLModel, table=True):
    __tablename__ = "key_event"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id")
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id")
    type: str  # visited_kp, book_sent, attended_small_course, purchased_big_course, contact_relation_discovered
    payload: str = Field(default="{}")  # JSON
    created_by: str = Field(foreign_key="user.id")
    occurred_at: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
