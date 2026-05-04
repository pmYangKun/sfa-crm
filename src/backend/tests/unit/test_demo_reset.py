"""Unit tests for spec 002 demo_reset_service (T023/T024).

Spec ref: specs/002-public-deploy-hardening/spec.md FR-012~019
         specs/002-public-deploy-hardening/research.md Decision 4
"""

from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

# Register tables
from app.models.chat_audit import ChatAudit
from app.models.config import SystemConfig
from app.models.contact import Contact
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.llm_call_counter import LLMCallCounter
from app.models.notification import Notification
from app.models.org import OrgNode, User


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})

    # 关键：开 FK pragma，否则测试不会暴露 demo_reset 的删表顺序错误
    # （生产 DB 走 app/core/database.py 默认 ON，测试 in-memory 必须手动开）
    @event.listens_for(engine, "connect")
    def _set_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        # 保留表种子（user / org_node / system_config）
        org = OrgNode(id="org-root", name="root", type="root")
        s.add(org)
        s.flush()
        s.add(User(id="u-1", login="sales01", password_hash="x", name="王小明", org_node_id="org-root"))
        s.add(SystemConfig(key="demo_reset_enabled", value="true", description="t"))
        s.add(SystemConfig(key="demo_reset_interval_minutes", value="30", description="t"))
        s.commit()
        yield s


def _seed_some_business_data(s: Session) -> None:
    """种入少量业务数据用于测试 reset 是否清空。FK 拓扑：Customer/Contact/
    FollowUp/KeyEvent → Lead；所以先 flush Lead 让 SQLAlchemy 不要重排序。"""
    s.add(Lead(id="lead-1", company_name="测试公司A", region="华北", source="referral", owner_id="u-1", pool="private"))
    s.add(Lead(id="lead-2", company_name="测试公司B", region="华南", source="organic", owner_id="u-1", pool="public"))
    s.flush()  # 让 lead-1 / lead-2 在 FK 引用前先落 DB
    s.add(Customer(id="cust-1", lead_id="lead-1", company_name="测试客户", region="华北", owner_id="u-1", source="referral"))
    s.add(Contact(id="ct-1", lead_id="lead-1", name="张三"))
    s.add(FollowUp(id="fu-1", lead_id="lead-1", owner_id="u-1", type="phone", content="x", followed_at="2026-05-04T00:00:00Z"))
    s.add(KeyEvent(id="ke-1", lead_id="lead-1", created_by="u-1", type="visited_kp", occurred_at="2026-05-04T00:00:00Z"))
    s.add(Notification(id="n-1", user_id="u-1", type="info", title="t", content="hi"))
    s.add(ChatAudit(client_ip="1.2.3.4", input_length=5, input_excerpt="hello"))
    s.add(LLMCallCounter(hour_bucket="2026050414", count=42))
    s.commit()


def test_reset_clears_business_tables(session):
    """业务表（lead / customer / contact / followup / key_event / notification / chat_audit / llm_call_counter）全清空"""
    from app.services.demo_reset_service import reset_business_data

    _seed_some_business_data(session)
    assert len(session.exec(select(Lead)).all()) == 2

    # 注入 noop seed 避免依赖全局 engine
    reset_business_data(session, seed_callable=lambda: None)

    assert len(session.exec(select(Lead)).all()) == 0
    assert len(session.exec(select(Customer)).all()) == 0
    assert len(session.exec(select(Contact)).all()) == 0
    assert len(session.exec(select(FollowUp)).all()) == 0
    assert len(session.exec(select(KeyEvent)).all()) == 0
    assert len(session.exec(select(Notification)).all()) == 0
    assert len(session.exec(select(ChatAudit)).all()) == 0
    assert len(session.exec(select(LLMCallCounter)).all()) == 0


def test_reset_preserves_user_and_config(session):
    """user / org_node / system_config 保留不动"""
    from app.services.demo_reset_service import reset_business_data

    _seed_some_business_data(session)
    reset_business_data(session, seed_callable=lambda: None)

    assert len(session.exec(select(User)).all()) == 1  # 1 个种子用户
    assert len(session.exec(select(OrgNode)).all()) == 1  # 1 个种子组织
    cfg = session.get(SystemConfig, "demo_reset_enabled")
    assert cfg is not None
    assert cfg.value == "true"


def test_reset_calls_seed_callable(session):
    """reset 完成后调用 seed_callable 一次"""
    from app.services.demo_reset_service import reset_business_data

    calls = []
    reset_business_data(session, seed_callable=lambda: calls.append(1))

    assert calls == [1]


def test_reset_rolls_back_on_seed_failure(session):
    """seed_callable 抛异常 → reset 已 commit 的清空保留，但异常向上传播让调用方知道"""
    from app.services.demo_reset_service import reset_business_data

    _seed_some_business_data(session)

    def bad_seed():
        raise RuntimeError("seed failed")

    with pytest.raises(RuntimeError, match="seed failed"):
        reset_business_data(session, seed_callable=bad_seed)


def test_reset_disabled_skips(session):
    """demo_reset_enabled=false → reset 不执行"""
    from app.services.demo_reset_service import reset_business_data

    cfg = session.get(SystemConfig, "demo_reset_enabled")
    cfg.value = "false"
    session.add(cfg)
    session.commit()

    _seed_some_business_data(session)
    seed_called = []
    reset_business_data(session, seed_callable=lambda: seed_called.append(1))

    # 关闭时不清不种
    assert len(session.exec(select(Lead)).all()) == 2
    assert seed_called == []


def test_get_next_reset_at_after_reset(session, monkeypatch):
    """reset 后 _last_reset_at 更新；get_next_reset_at 返回 last + interval"""
    import app.services.demo_reset_service as svc

    # 强制 _last_reset_at 重置
    svc._last_reset_at = None
    svc.reset_business_data(session, seed_callable=lambda: None)

    next_at = svc.get_next_reset_at(session)
    assert next_at is not None
    delta = next_at - datetime.now(timezone.utc)
    # 30 min interval, 应该在 30 min 附近
    assert timedelta(minutes=29) < delta < timedelta(minutes=31)


def test_get_next_reset_at_returns_none_when_disabled(session):
    """enabled=false → get_next_reset_at 返回 None"""
    from app.services.demo_reset_service import get_next_reset_at

    cfg = session.get(SystemConfig, "demo_reset_enabled")
    cfg.value = "false"
    session.add(cfg)
    session.commit()

    assert get_next_reset_at(session) is None
