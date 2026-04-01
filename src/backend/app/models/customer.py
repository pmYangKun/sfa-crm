import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Customer(SQLModel, table=True):
    __tablename__ = "customer"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", unique=True, nullable=False, index=True)
    company_name: str = Field(nullable=False, index=True)
    unified_code: Optional[str] = Field(default=None, index=True)
    region: str = Field(nullable=False, index=True)
    owner_id: str = Field(foreign_key="user.id", nullable=False, index=True)
    source: str = Field(nullable=False)  # referral | organic | koc_sem | outbound
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
