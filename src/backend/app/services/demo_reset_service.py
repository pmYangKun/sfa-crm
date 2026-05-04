"""半小时业务数据自动重置（spec 002 T024 / FR-012~019）.

Reset 策略：
- 清空业务表（lead / customer / contact / followup / key_event / notification / chat_audit / llm_call_counter）
- 保留账号配置（user / role / permission / org_node / user_data_scope / system_config / llm_config）
- 调用 seed_callable() 重新种入演示数据（默认 app.core.seed_data.seed）

事务策略（research.md Decision 4）：清空在传入 session 的事务里 commit；seed 部分在 seed
内部自己开 session（中间窗口毫秒级表为空，访客刷新会重试）。

时机推算：模块级 _last_reset_at 在每次 reset 完成后更新；get_next_reset_at 基于 last + interval 推算。
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Callable, Optional

from sqlmodel import Session, delete

from app.models.chat_audit import ChatAudit
from app.models.config import SystemConfig
from app.models.contact import Contact
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.llm_call_counter import LLMCallCounter
from app.models.notification import Notification

logger = logging.getLogger(__name__)

# 模块级状态：上次成功重置时间（UTC）
_last_reset_at: Optional[datetime] = None


def _is_enabled(session: Session) -> bool:
    cfg = session.get(SystemConfig, "demo_reset_enabled")
    if not cfg:
        return False
    return str(cfg.value).strip().lower() == "true"


def _interval_minutes(session: Session) -> int:
    cfg = session.get(SystemConfig, "demo_reset_interval_minutes")
    if not cfg or not cfg.value:
        return 30
    try:
        return max(1, int(cfg.value))
    except (TypeError, ValueError):
        return 30


def _default_seed() -> None:
    """默认 seed 调用方（生产路径）。延迟 import 避免测试循环依赖。"""
    from app.core.seed_data import seed
    seed()


def reset_business_data(
    session: Session,
    seed_callable: Optional[Callable[[], None]] = None,
) -> None:
    """清空业务表 + 重新种入。

    spec 002 FR-013 / FR-014：清 8 张业务表，保留账号配置 9 张表。

    Args:
        session: 已开启的 SQLModel session
        seed_callable: 可注入的种子函数（默认 app.core.seed_data.seed），便于测试
    """
    global _last_reset_at

    if not _is_enabled(session):
        logger.info("demo_reset_enabled=false, 跳过重置")
        return

    seed_fn = seed_callable if seed_callable is not None else _default_seed

    # ── Phase 1: 清空业务表（按外键依赖反序，叶子表先删）─────────────────
    # FK 拓扑：FollowUp/KeyEvent → Lead/Customer；Contact → Lead/Customer；
    #          Customer → Lead（lead_id FK，转化场景）；Notification/ChatAudit/
    #          LLMCallCounter 无业务对象 FK。
    # 因此 Lead 必须最后删（前一版把 Lead 在 Customer 前删，dev DB 有转化客户时
    # FK 冲突 → DELETE FROM lead 报 IntegrityError）。
    try:
        session.exec(delete(FollowUp))
        session.exec(delete(KeyEvent))
        session.exec(delete(Notification))
        session.exec(delete(Contact))
        session.exec(delete(Customer))     # 先 Customer（FK 指向 Lead）
        session.exec(delete(Lead))         # 再 Lead
        session.exec(delete(ChatAudit))
        session.exec(delete(LLMCallCounter))
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("demo reset 清空阶段失败")
        raise

    # ── Phase 2: 重新种入 ────────────────────────────────────────────────
    seed_fn()

    _last_reset_at = datetime.now(timezone.utc)
    logger.info("demo reset 完成 at %s", _last_reset_at.isoformat())


def get_next_reset_at(session: Session) -> Optional[datetime]:
    """返回下次重置 UTC 时间；enabled=false 返回 None。"""
    if not _is_enabled(session):
        return None
    interval = _interval_minutes(session)
    last = _last_reset_at or datetime.now(timezone.utc)
    return last + timedelta(minutes=interval)


def get_last_reset_at() -> Optional[datetime]:
    return _last_reset_at


def _set_last_reset_at_for_test(value: Optional[datetime]) -> None:
    """测试用：手动设置 _last_reset_at。"""
    global _last_reset_at
    _last_reset_at = value
