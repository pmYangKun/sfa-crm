"""Chat 审计日志写入（spec 002 T021 / FR-005）.

每条 chat 请求（含被拦截的）落 chat_audit 表，含输入摘要 / 输出摘要 / 拦截原因。
input_excerpt 截断 200 字 + 连续数字串脱敏（防泄漏手机号 / 身份证 / 密钥）。
"""

import logging
import re
from typing import Optional

from sqlmodel import Session

from app.models.chat_audit import ChatAudit

logger = logging.getLogger(__name__)

EXCERPT_MAX_LEN = 200
USER_AGENT_MAX_LEN = 500
DIGIT_RUN_REDACT = re.compile(r"\d{5,}")  # 5+ 连续数字 → ***


def _redact_excerpt(text: str) -> str:
    """截断到 200 字 + 5+ 连续数字脱敏。"""
    truncated = text[:EXCERPT_MAX_LEN]
    return DIGIT_RUN_REDACT.sub("***", truncated)


def write_audit(
    session: Session,
    *,
    user_id: Optional[str],
    ip: str,
    user_agent: Optional[str],
    input_text: str,
    output_text: Optional[str],
    blocked_by: Optional[str],
) -> None:
    """写一条 chat_audit 记录。失败不抛异常（fire-and-forget）。"""
    try:
        ua_truncated = user_agent[:USER_AGENT_MAX_LEN] if user_agent else None
        audit = ChatAudit(
            user_id=user_id,
            client_ip=ip,
            user_agent=ua_truncated,
            input_length=len(input_text),
            input_excerpt=_redact_excerpt(input_text),
            output_excerpt=_redact_excerpt(output_text) if output_text else None,
            blocked_by=blocked_by,
        )
        session.add(audit)
        # NOTE: 不在此处 session.commit() —— 由调用方决定 commit 时机
        # （chat 端点的请求处理结束时统一 commit；半小时重置事务里也不会 dangling）
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("chat_audit 写入失败（不影响主路径）: %s", exc)
