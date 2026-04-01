"""LLMConfig, Skill, ConversationMessage models."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class LLMConfig(SQLModel, table=True):
    __tablename__ = "llm_config"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    provider: str  # anthropic, openai, deepseek, etc.
    model: str
    api_key: str
    is_active: bool = Field(default=False)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class Skill(SQLModel, table=True):
    __tablename__ = "skill"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    trigger: str
    content: str
    category: Optional[str] = None
    is_active: bool = Field(default=True)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ConversationMessage(SQLModel, table=True):
    __tablename__ = "conversation_message"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str
    user_id: str = Field(foreign_key="user.id")
    role: str  # user, assistant, tool
    content: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
