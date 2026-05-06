"""LeadMeddiccEvidence model — 单条 MEDDICC 维度证据（spec 003 T002）.

每条证据 first-class，含来源指针 + confidence。
不加 status 字段（spec 003 brainstorm 阶段已去除 HITL）。
"""

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

# MEDDICC 7 维度枚举（与 LLM prompt 输出严格一致）
DIMENSIONS = [
    "metrics",
    "economic_buyer",
    "decision_criteria",
    "decision_process",
    "pain",
    "champion",
    "competition",
]

SOURCE_TYPES = ["conversation", "followup", "key_event"]


class LeadMeddiccEvidence(SQLModel, table=True):
    __tablename__ = "lead_meddicc_evidence"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    lead_id: str = Field(foreign_key="lead.id", index=True)

    dimension: str = Field(index=True)
    # 枚举：DIMENSIONS

    source_type: str
    # 枚举：SOURCE_TYPES

    source_id: str
    # 不加 FK 约束（多目标，SQLModel 不支持 polymorphic FK）；service 层 post-validate

    evidence_text: str  # ≤200 字
    confidence: float = Field(default=0.0)  # 0-1

    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
