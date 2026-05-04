"""LLMConfig, Skill, ConversationMessage models.

spec 002: api_key 字段物理存储为 Fernet 密文。访问明文通过 api_key_decrypted property，
写入明文通过 set_api_key()。schema 不变（仍是 TEXT NOT NULL），仅读写路径改造。
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class LLMConfig(SQLModel, table=True):
    __tablename__ = "llm_config"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    provider: str  # anthropic, openai, deepseek, etc.
    model: str
    api_key: str  # spec 002: Fernet 密文（gAAAAA... 开头）
    is_active: bool = Field(default=False)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def set_api_key(self, plaintext: str) -> None:
        """加密明文 api_key 并赋值到 self.api_key（spec 002 FR-027）."""
        from app.core.security import encrypt_api_key

        self.api_key = encrypt_api_key(plaintext)

    @property
    def api_key_decrypted(self) -> str:
        """返回解密后的明文 api_key。

        如果 api_key 已是 Fernet 密文（gAAAAA 开头）→ 解密返回明文。
        如果 api_key 是老明文数据（迁移前）→ fallback 返回原值（不抛异常）。
        """
        from app.core.security import decrypt_api_key

        if self.api_key.startswith("gAAAAA"):
            return decrypt_api_key(self.api_key)
        return self.api_key


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
