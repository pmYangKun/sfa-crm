import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class KeyEvent(SQLModel, table=True):
    __tablename__ = "key_event"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: Optional[str] = Field(default=None, foreign_key="lead.id", index=True)
    customer_id: Optional[str] = Field(default=None, foreign_key="customer.id", index=True)
    type: str = Field(nullable=False, index=True)
    # visited_kp | book_sent | attended_small_course | purchased_big_course | contact_relation_discovered
    payload: str = Field(default="{}", nullable=False)  # JSON string
    created_by: str = Field(foreign_key="user.id", nullable=False)
    occurred_at: datetime = Field(nullable=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
