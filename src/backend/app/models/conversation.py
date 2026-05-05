"""Conversation model — 销售-客户对话原文记录（spec 003 T001）.

每条记录是 AI 抽 MEDDICC 证据的核心数据燃料。来源三种：
- manual: 演示用户在前端粘贴录入
- scenario_card: 场景卡批量注入（演示一键体验）
- mock_seed: init_db 启动时种入
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Conversation(SQLModel, table=True):
    __tablename__ = "conversation"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", index=True)
    recorded_at: str  # ISO 8601, 对话发生时间
    content: str  # 对话原文，建议 "销售：...\n客户：..." 多轮

    source: str = Field(default="manual")
    # source 枚举：manual / scenario_card / mock_seed

    scenario_card_id: Optional[str] = Field(default=None, index=True)
    # 来自哪张场景卡（仅 source=scenario_card 时有值）

    created_by: str = Field(foreign_key="user.id")
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
