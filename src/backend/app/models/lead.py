from datetime import datetime
from typing import Optional
from sqlmodel import Field, Relationship, SQLModel


class Lead(SQLModel, table=True):
    __tablename__ = "lead"

    id: str = Field(primary_key=True)
    company_name: str = Field(index=True)
    unified_code: Optional[str] = Field(default=None, index=True)
    region: str = Field(index=True)
    stage: str = Field(default="active", index=True)   # active | converted | lost
    pool: str = Field(default="private", index=True)   # private | public
    owner_id: Optional[str] = Field(default=None, foreign_key="user.id", index=True)
    source: str  # referral | organic | koc_sem | outbound
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    last_followup_at: Optional[datetime] = Field(default=None)
    converted_at: Optional[datetime] = Field(default=None)
    lost_at: Optional[datetime] = Field(default=None)
