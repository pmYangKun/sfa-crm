"""LLMCallCounter model — 全站 LLM 调用计数器（按小时桶，spec 002 FR-009）.

清空策略：半小时 demo_reset 时被清空（spec 002 FR-013）。
熔断判定：当前 hour_bucket 行的 count > llm_global_hourly_limit → 全站熔断 1 小时。
"""

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class LLMCallCounter(SQLModel, table=True):
    __tablename__ = "llm_call_counter"

    hour_bucket: str = Field(primary_key=True, max_length=10)  # YYYYMMDDHH
    count: int = Field(default=0)
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
