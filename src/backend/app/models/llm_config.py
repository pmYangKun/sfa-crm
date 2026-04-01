"""
LLMConfig, Skill, and ConversationMessage models (T095, T096).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class LLMConfig(SQLModel, table=True):
    __tablename__ = "llm_config"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    provider: str = Field(nullable=False)        # anthropic | openai
    model_name: str = Field(nullable=False)      # e.g. claude-opus-4-6
    api_key: str = Field(nullable=False)
    base_url: Optional[str] = Field(default=None)  # for custom endpoints
    is_active: bool = Field(default=False)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class Skill(SQLModel, table=True):
    __tablename__ = "skill"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = Field(nullable=False)
    description: str = Field(nullable=False)
    system_prompt: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ConversationMessage(SQLModel, table=True):
    __tablename__ = "conversation_message"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(nullable=False, index=True)
    role: str = Field(nullable=False)            # user | assistant | tool
    content: Optional[str] = Field(default=None)
    tool_name: Optional[str] = Field(default=None)
    tool_input: Optional[str] = Field(default=None)  # JSON
    tool_result: Optional[str] = Field(default=None)  # JSON
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
