"""Spec 004 — LeadMeddiccHistory snapshot table.

每条 lead 的 MEDDICC Score 历史快照，支持：
- lead 详情页趋势图（FR-018, FR-019, FR-022）
- forecast_category 变更 audit 留痕
- 启动时 backfill baseline（FR-020）
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

# 三种 snapshot 触发场景
TRIGGER_REASONS = ["analyze", "forecast_change", "backfill"]


class LeadMeddiccHistory(SQLModel, table=True):
    __tablename__ = "lead_meddicc_history"

    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", index=True)
    snapshot_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # MEDDICC 维度状态（snapshot 时点）
    meddicc_score: Optional[float] = Field(default=None)
    meddicc_completion: int = Field(default=0)
    dimensions_json: Optional[str] = Field(default=None)
    # dimensions_json 形如 {"metrics": {"evidence_count": 3, "lit": true}, ...}

    # spec 004 新加字段（snapshot 时点）
    forecast_category: Optional[str] = Field(default=None)
    amount: Optional[float] = Field(default=None)

    # 触发场景
    trigger_reason: str = Field(default="analyze")
