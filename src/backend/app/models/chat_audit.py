"""ChatAudit model — 每条 chat 请求的审计日志（spec 002 FR-005）.

清空策略：半小时 demo_reset 时被清空（spec 002 FR-013）。
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ChatAudit(SQLModel, table=True):
    __tablename__ = "chat_audit"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: Optional[str] = Field(default=None, foreign_key="user.id")
    client_ip: str
    user_agent: Optional[str] = Field(default=None, max_length=500)
    input_length: int
    input_excerpt: str  # 首 200 字 + 数字脱敏
    output_excerpt: Optional[str] = Field(default=None)  # 被拦截的也记固定话术
    blocked_by: Optional[str] = Field(default=None)
    """拦截原因枚举：prompt_guard / rate_limit_minute / rate_limit_day /
    llm_circuit_breaker / None=未拦截"""
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
