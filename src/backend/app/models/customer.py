"""Customer model."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Customer(SQLModel, table=True):
    __tablename__ = "customer"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(unique=True, foreign_key="lead.id")
    company_name: str
    unified_code: Optional[str] = None
    region: str
    owner_id: str = Field(foreign_key="user.id")
    source: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
