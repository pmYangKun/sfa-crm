"""全站 LLM 调用熔断（spec 002 T018 / FR-009 / FR-010）.

按小时桶（YYYYMMDDHH）累加 LLM 成功调用次数；超 SystemConfig.llm_global_hourly_limit
则全站熔断到下个整点。

实现要点（research.md Decision 2）：
- 用 SQLite 原子表 llm_call_counter，不引入 Redis
- check_circuit_open(session) 是只读判定，不累加
- increment_counter(session) 在 LLM 成功调用后累加
- 半小时 demo_reset 时整张表被清空
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlmodel import Session

from app.models.config import SystemConfig
from app.models.llm_call_counter import LLMCallCounter

DEFAULT_GLOBAL_HOURLY_LIMIT = 200  # plan / contracts default


@dataclass
class CircuitState:
    open: bool
    retry_after_seconds: int = 0  # 触发熔断时为到下个整点的秒数


def _current_hour_bucket() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H")


def _seconds_to_next_hour() -> int:
    now = datetime.now(timezone.utc)
    next_hour = now.replace(minute=0, second=0, microsecond=0).replace(
        hour=(now.hour + 1) % 24
    )
    if next_hour <= now:
        next_hour = next_hour.replace(day=now.day + 1)
    return max(int((next_hour - now).total_seconds()), 1)


def _get_threshold(session: Session) -> int:
    config = session.get(SystemConfig, "llm_global_hourly_limit")
    if not config or not config.value:
        return DEFAULT_GLOBAL_HOURLY_LIMIT
    try:
        return int(config.value)
    except (TypeError, ValueError):
        return DEFAULT_GLOBAL_HOURLY_LIMIT


def check_circuit_open(session: Session) -> CircuitState:
    """只读判定当前小时桶是否已达熔断阈值。不修改计数器。"""
    threshold = _get_threshold(session)
    bucket = _current_hour_bucket()
    counter = session.get(LLMCallCounter, bucket)
    current_count = counter.count if counter else 0

    if current_count >= threshold:
        return CircuitState(open=True, retry_after_seconds=_seconds_to_next_hour())
    return CircuitState(open=False)


def increment_counter(session: Session) -> int:
    """在 LLM 成功调用后累加当前小时桶计数器，返回新计数。

    用 INSERT OR REPLACE 模式：不存在 → 建一行 count=1；存在 → +1。
    """
    bucket = _current_hour_bucket()
    counter = session.get(LLMCallCounter, bucket)
    now_iso = datetime.now(timezone.utc).isoformat()

    if counter is None:
        counter = LLMCallCounter(hour_bucket=bucket, count=1, updated_at=now_iso)
        session.add(counter)
    else:
        counter.count += 1
        counter.updated_at = now_iso
        session.add(counter)
    session.commit()
    return counter.count
