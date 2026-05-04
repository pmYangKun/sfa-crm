"""Unit tests for spec 002 llm_circuit_breaker service (T015/T018).

Spec ref: specs/002-public-deploy-hardening/spec.md FR-009 / FR-010
         specs/002-public-deploy-hardening/research.md Decision 2
"""

from unittest.mock import MagicMock

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.llm_call_counter import LLMCallCounter  # noqa: F401
from app.models.config import SystemConfig


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        # Seed default threshold = 5（更容易在测试中触发）
        s.add(SystemConfig(key="llm_global_hourly_limit", value="5", description="test"))
        s.commit()
        yield s


def test_first_call_passes(session):
    from app.services.llm_circuit_breaker import check_circuit_open

    state = check_circuit_open(session)
    assert state.open is False


def test_under_threshold_stays_closed(session):
    from app.services.llm_circuit_breaker import check_circuit_open, increment_counter

    for _ in range(4):
        increment_counter(session)
    state = check_circuit_open(session)
    assert state.open is False


def test_at_threshold_opens(session):
    from app.services.llm_circuit_breaker import check_circuit_open, increment_counter

    for _ in range(5):
        increment_counter(session)
    state = check_circuit_open(session)
    assert state.open is True
    assert state.retry_after_seconds > 0
    assert state.retry_after_seconds <= 3600


def test_increment_counter_persists(session):
    from app.services.llm_circuit_breaker import increment_counter

    increment_counter(session)
    increment_counter(session)
    increment_counter(session)
    rows = session.exec(__import__("sqlmodel").select(LLMCallCounter)).all()
    assert len(rows) == 1
    assert rows[0].count == 3


def test_no_threshold_config_defaults_to_safe(session):
    """SystemConfig.llm_global_hourly_limit 不存在 → 用 plan 默认值 200，不抛异常"""
    from app.services.llm_circuit_breaker import check_circuit_open

    # 删掉 config 行
    cfg = session.get(SystemConfig, "llm_global_hourly_limit")
    session.delete(cfg)
    session.commit()

    state = check_circuit_open(session)
    assert state.open is False  # default 200, 0 calls → closed


def test_check_does_not_increment(session):
    """check_circuit_open 是只读判定，不该修改计数器"""
    from app.services.llm_circuit_breaker import check_circuit_open

    check_circuit_open(session)
    rows = session.exec(__import__("sqlmodel").select(LLMCallCounter)).all()
    assert len(rows) == 0  # 没有 increment_counter 应该没行
