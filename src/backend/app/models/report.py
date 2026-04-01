import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class DailyReport(SQLModel, table=True):
    __tablename__ = "daily_report"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    owner_id: str = Field(foreign_key="user.id", nullable=False, index=True)
    report_date: str = Field(nullable=False, index=True)  # 'YYYY-MM-DD'
    content: str = Field(nullable=False)
    status: str = Field(default="draft", nullable=False)  # draft | submitted
    submitted_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
