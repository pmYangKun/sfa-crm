"""McpToken model — MCP 开放平台的接入密钥（spec 005 FR-002 ~ FR-008）.

属基础设施实体（凭证），非 Ontology 业务对象，豁免理由见
specs/005-mcp-open-platform/plan.md 的 Complexity Tracking。

清空策略：**永不随 demo_reset 清空**。`demo_reset_service` 采用显式删除列表，
本表不在其中即可满足 spec 005 FR-030 —— 访客配好客户端后不能因为半小时重置
就断连。禁止把 McpToken 加入那份删除列表。
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class McpToken(SQLModel, table=True):
    __tablename__ = "mcp_token"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)

    token_hash: str = Field(unique=True, index=True)
    """密钥明文的 SHA-256 十六进制摘要。明文只在发放响应里返回一次，不入库。"""

    token_prefix: str
    """明文前 12 位（如 sfa_ro_a3f9），供页面与日志展示，便于用户辨认自己的密钥。"""

    user_id: str = Field(foreign_key="user.id", index=True)
    """密钥映射到的演示账号。真实权限与数据范围由该账号既有的 RBAC / DataScope 决定。"""

    persona: str
    """sales | manager —— 仅用于展示与统计，不作为权限依据。"""

    scope: str = Field(default="read")
    """本期恒为 read。预留给写操作那一版的 draft / write。"""

    expires_at: str = Field(index=True)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    created_ip: Optional[str] = Field(default=None)
    last_used_at: Optional[str] = Field(default=None)
    call_count: int = Field(default=0)
    revoked_at: Optional[str] = Field(default=None)

    def is_valid(self, now: Optional[datetime] = None) -> bool:
        """有效性单一判据：未吊销 且 未过期（data-model.md §1）。"""
        if self.revoked_at is not None:
            return False
        now = now or datetime.now(timezone.utc)
        try:
            expires = datetime.fromisoformat(self.expires_at)
        except ValueError:
            return False
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > now
