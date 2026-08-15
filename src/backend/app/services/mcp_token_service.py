"""MCP 接入密钥服务（spec 005 FR-002 ~ FR-008）.

密钥形态（research.md Decision 2）：
- 不透明随机串 `sfa_ro_` + 32 字节 URL-safe 随机值
- 库里只存 SHA-256 摘要与 12 位前缀，明文只在发放时返回一次
- 选不透明串而非 JWT：本场景需要可吊销 + 可计数，两者都要落库查询，
  JWT「免查库」的优势因而消失，只剩轮转复杂度

身份映射（data-model.md §3）：sales → sales01，manager → manager01。
**不提供 admin 身份**（FR-001）。
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, func, select

from app.core.config import CFG_MCP_TOKEN_TTL_DAYS
from app.models.config import SystemConfig
from app.models.mcp_token import McpToken
from app.models.org import User

TOKEN_PREFIX = "sfa_ro_"
PREFIX_DISPLAY_LEN = 12

# persona → (演示账号 login, 展示名)
PERSONA_MAP: dict[str, tuple[str, str]] = {
    "sales": ("sales01", "销售 · 王小明"),
    "manager": ("manager01", "主管 · 陈队长"),
}


class PersonaNotAllowed(ValueError):
    """请求了不被支持的身份（含 admin）。"""


class PersonaAccountMissing(RuntimeError):
    """种子数据里找不到该身份对应的演示账号——必须显式报错，不得静默降级。"""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_ttl_days(session: Session) -> int:
    cfg = session.get(SystemConfig, CFG_MCP_TOKEN_TTL_DAYS)
    return int(cfg.value) if cfg else 7


def count_issued_today(session: Session, client_ip: str) -> int:
    """当日该来源 IP 已发放数量，用于发放频率限制（FR-007）。"""
    day_start = _now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    stmt = (
        select(func.count())
        .select_from(McpToken)
        .where(McpToken.created_ip == client_ip)
        .where(McpToken.created_at >= day_start)
    )
    return session.exec(stmt).one()


def issue_token(
    session: Session,
    persona: str,
    client_ip: Optional[str] = None,
) -> tuple[str, McpToken]:
    """发放一把密钥。返回 (明文, 记录)。明文此后不可再取。"""
    if persona not in PERSONA_MAP:
        raise PersonaNotAllowed(
            f"不支持的身份 '{persona}'，仅支持 {list(PERSONA_MAP)}"
        )

    login, _label = PERSONA_MAP[persona]
    user = session.exec(select(User).where(User.login == login)).first()
    if user is None:
        raise PersonaAccountMissing(
            f"演示账号 '{login}' 不存在于种子数据，无法发放 {persona} 身份密钥"
        )

    plain = TOKEN_PREFIX + secrets.token_urlsafe(32)
    ttl_days = get_ttl_days(session)

    record = McpToken(
        token_hash=_hash(plain),
        token_prefix=plain[:PREFIX_DISPLAY_LEN],
        user_id=user.id,
        persona=persona,
        scope="read",
        expires_at=(_now() + timedelta(days=ttl_days)).isoformat(),
        created_ip=client_ip,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return plain, record


def lookup(session: Session, plain_token: str) -> Optional[McpToken]:
    """按明文查记录。查不到返回 None（不区分"从未存在"与"已删"）。"""
    stmt = select(McpToken).where(McpToken.token_hash == _hash(plain_token))
    return session.exec(stmt).first()


def revoke(session: Session, plain_token: str) -> bool:
    record = lookup(session, plain_token)
    if record is None or record.revoked_at is not None:
        return False
    record.revoked_at = _now().isoformat()
    session.add(record)
    session.commit()
    return True


def mark_used(session: Session, record: McpToken) -> None:
    """成功调用后更新使用痕迹。失败不应阻断主流程。"""
    record.last_used_at = _now().isoformat()
    record.call_count = (record.call_count or 0) + 1
    session.add(record)
    session.commit()


def days_remaining(record: McpToken) -> int:
    try:
        expires = datetime.fromisoformat(record.expires_at)
    except ValueError:
        return 0
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    delta = expires - _now()
    return max(0, delta.days)


def persona_label(persona: str) -> str:
    return PERSONA_MAP.get(persona, ("", persona))[1]
