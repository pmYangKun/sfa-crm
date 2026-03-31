from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class SystemConfig(SQLModel, table=True):
    __tablename__ = "system_config"

    key: str = Field(primary_key=True)
    value: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
