"""Unit tests for spec 002 T033 — `/agent/llm-config/full` 响应不再包含 api_key 明文/密文。

Spec ref: specs/002-public-deploy-hardening/spec.md FR-029
         specs/002-public-deploy-hardening/contracts/api-contracts.md § 3
"""

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.api.agent import get_llm_config_full
from app.models.config import SystemConfig
from app.models.llm_config import LLMConfig


@pytest.fixture
def session(monkeypatch):
    """In-memory SQLite session + dev Fernet."""
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.delenv("LLM_KEY_FERNET_KEY", raising=False)
    from app.core import security
    security.reset_fernet_cache()

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def test_response_omits_api_key_field(session):
    """FR-029: api_key 字段必须从响应中完全剔除，无论是密文还是明文。"""
    cfg = LLMConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="placeholder")
    cfg.set_api_key("sk-ant-real-1234567890")
    cfg.is_active = True
    session.add(cfg)
    session.commit()

    # current_user 不被函数体使用，传 None 占位
    resp = get_llm_config_full(session=session, current_user=None)

    assert "api_key" not in resp, "api_key 字段必须从响应中删除（FR-029）"


def test_response_has_api_key_present_true_when_configured(session):
    """配置存在且 api_key 非空 → api_key_present=True（替代 api_key 字段告知前端配置状态）。"""
    cfg = LLMConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="placeholder")
    cfg.set_api_key("sk-ant-real-1234567890")
    cfg.is_active = True
    session.add(cfg)
    session.commit()

    resp = get_llm_config_full(session=session, current_user=None)

    assert resp["configured"] is True
    assert resp["api_key_present"] is True


def test_response_has_api_key_present_false_when_empty(session):
    """配置存在但 api_key 为空字符串 → api_key_present=False。"""
    cfg = LLMConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="")
    cfg.is_active = True
    session.add(cfg)
    session.commit()

    resp = get_llm_config_full(session=session, current_user=None)

    assert resp["configured"] is True
    assert resp["api_key_present"] is False


def test_response_when_not_configured(session):
    """无 LLMConfig → configured=False，不包含 api_key 也不包含 api_key_present。"""
    resp = get_llm_config_full(session=session, current_user=None)

    assert resp["configured"] is False
    assert "api_key" not in resp


def test_response_still_carries_provider_model_system_prompt(session):
    """删 api_key 不能误伤其它字段：provider / model / system_prompt 仍要返回（前端识别 provider 走对应 SDK）。"""
    cfg = LLMConfig(provider="deepseek", model="deepseek-chat", api_key="placeholder")
    cfg.set_api_key("sk-ds-test")
    cfg.is_active = True
    session.add(cfg)
    sp = SystemConfig(
        key="agent_system_prompt",
        value="你是 SFA CRM 助手",
        description="system prompt",
    )
    session.add(sp)
    session.commit()

    resp = get_llm_config_full(session=session, current_user=None)

    assert resp["provider"] == "deepseek"
    assert resp["model"] == "deepseek-chat"
    assert resp["system_prompt"] == "你是 SFA CRM 助手"
