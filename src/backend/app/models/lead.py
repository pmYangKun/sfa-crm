"""Lead model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Lead(SQLModel, table=True):
    __tablename__ = "lead"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    company_name: str
    unified_code: Optional[str] = Field(default=None, unique=True)
    region: str
    stage: str = Field(default="active")  # active, converted, lost
    pool: str = Field(default="public")  # private, public
    owner_id: Optional[str] = Field(default=None, foreign_key="user.id")
    source: str  # referral, organic, koc_sem, outbound
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    last_followup_at: Optional[str] = None
    converted_at: Optional[str] = None
    lost_at: Optional[str] = None
