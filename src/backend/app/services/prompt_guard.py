"""Prompt Injection 黑名单拦截（spec 002 T017 / FR-002 / FR-003）.

软拦截策略：命中关键词 → 不调 LLM → 返回固定话术 → 写 chat_audit。
词表来自 SystemConfig.prompt_guard_keywords（JSON 数组），
带 60 秒进程内缓存避免每次 chat 查 DB。
"""

import json
import logging
import time
from dataclasses import dataclass

from sqlmodel import Session

from app.models.config import SystemConfig

logger = logging.getLogger(__name__)

# Cache: (timestamp, keywords_lower)
_cache: tuple[float, list[str]] | None = None
_CACHE_TTL_SECONDS = 60.0

FIXED_RESPONSE = "抱歉，这超出了我作为 SFA CRM 助手的能力范围"


@dataclass
class PromptGuardResult:
    blocked: bool
    fixed_response: str | None = None
    reason: str | None = None  # "prompt_guard" 当 blocked=True


def _load_keywords(session: Session) -> list[str]:
    """从 SystemConfig 加载黑名单词表（带缓存）。返回小写列表（已规范化）。"""
    global _cache
    now = time.time()
    if _cache is not None and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    config_row = session.get(SystemConfig, "prompt_guard_keywords")
    if not config_row or not config_row.value:
        _cache = (now, [])
        return []

    try:
        keywords = json.loads(config_row.value)
        if not isinstance(keywords, list):
            raise TypeError("prompt_guard_keywords value is not a JSON array")
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("prompt_guard_keywords 格式无效: %s — 跳过黑名单检查", exc)
        _cache = (now, [])
        return []

    keywords_lower = [str(k).strip().lower() for k in keywords if str(k).strip()]
    _cache = (now, keywords_lower)
    return keywords_lower


def reset_cache() -> None:
    """测试用：重置词表缓存。"""
    global _cache
    _cache = None


def check(session: Session, message: str) -> PromptGuardResult:
    """检测 message 是否命中黑名单（大小写不敏感子串包含）。"""
    keywords = _load_keywords(session)
    if not keywords:
        return PromptGuardResult(blocked=False)

    message_lower = message.lower()
    for kw in keywords:
        if kw and kw in message_lower:
            logger.info("prompt_guard hit: %r in input", kw)
            return PromptGuardResult(
                blocked=True,
                fixed_response=FIXED_RESPONSE,
                reason="prompt_guard",
            )
    return PromptGuardResult(blocked=False)
