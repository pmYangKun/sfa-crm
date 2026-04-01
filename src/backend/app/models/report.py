"""DailyReport model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class DailyReport(SQLModel, table=True):
    __tablename__ = "daily_report"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    owner_id: str = Field(foreign_key="user.id")
    report_date: str  # YYYY-MM-DD
    content: str
    status: str = Field(default="draft")  # draft, submitted
    submitted_at: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
