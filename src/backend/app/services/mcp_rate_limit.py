"""MCP 端点限流（spec 005 FR-026）.

为什么不用 slowapi 的装饰器：MCP 端点是 mount 进来的 ASGI 子应用，不是
FastAPI 路由，装饰器挂不上去。这里在鉴权中间件里做等价的滑动窗口。

**与内置 Copilot 的限流完全隔离**：桶按密钥摘要分，与 chat 的 (IP, user) 桶
互不相干。2026-05-21 那次"一聊天就提示请求过多"正是两类流量被合进同一个桶，
这里不能重演。
"""

import threading
import time
from collections import defaultdict, deque

from sqlmodel import Session

from app.core.config import CFG_MCP_RATE_PER_DAY, CFG_MCP_RATE_PER_MINUTE
from app.models.config import SystemConfig

_MINUTE = 60
_DAY = 86400


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _trim(self, key: str, now: float, window: int) -> deque[float]:
        bucket = self._buckets[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        return bucket

    def check(self, key: str, per_minute: int, per_day: int) -> tuple[bool, str]:
        """返回 (是否放行, 超限时的可读说明)。"""
        now = time.time()
        with self._lock:
            day_bucket = self._trim(f"{key}:day", now, _DAY)
            if len(day_bucket) >= per_day:
                return False, f"这把密钥今天的调用次数已达上限（{per_day} 次/天），明天会自动恢复。"

            minute_bucket = self._trim(f"{key}:min", now, _MINUTE)
            if len(minute_bucket) >= per_minute:
                return False, f"调用太频繁了（上限 {per_minute} 次/分钟），请稍等一分钟再试。"

            minute_bucket.append(now)
            day_bucket.append(now)
            return True, ""

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


limiter = SlidingWindowLimiter()


def read_thresholds(session: Session) -> tuple[int, int]:
    """阈值走 SystemConfig，代码里不出现字面量（宪法原则三）。"""
    minute_cfg = session.get(SystemConfig, CFG_MCP_RATE_PER_MINUTE)
    day_cfg = session.get(SystemConfig, CFG_MCP_RATE_PER_DAY)
    return (
        int(minute_cfg.value) if minute_cfg else 30,
        int(day_cfg.value) if day_cfg else 500,
    )
