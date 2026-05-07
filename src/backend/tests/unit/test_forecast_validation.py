"""Unit tests for forecast_validation_service — spec 004 T015.

Mock LLM 三种 verdict + cache + timeout.
"""

import json
import time

import httpx
import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.lead import Lead
from app.models.lead_meddicc_evidence import LeadMeddiccEvidence
from app.models.llm_config import LLMConfig
from app.services import forecast_validation_service as fv


@pytest.fixture(autouse=True)
def _clear_cache():
    fv.clear_cache()
    yield
    fv.clear_cache()


@pytest.fixture
def session():
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401

    eng = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        from app.models.org import OrgNode, User

        s.add(OrgNode(id="org-1", name="root", type="root"))
        s.flush()
        s.add(User(id="user-1", login="u1", password_hash="x", name="U1", org_node_id="org-1"))
        s.flush()
        # LLMConfig with deepseek provider
        cfg = LLMConfig(
            id="llm-1",
            provider="deepseek",
            model="deepseek-chat",
            api_key="placeholder",
            is_active=True,
        )
        cfg.set_api_key("dummy-key")
        s.add(cfg)
        s.flush()

        s.add(Lead(
            id="lead-1",
            company_name="测试公司",
            region="华北",
            source="referral",
            owner_id="user-1",
            stage="active",
            forecast_category="进行中",
            meddicc_score=70,
            meddicc_completion=5,
        ))
        s.commit()
        yield s


class TestValidateForecast:
    def test_invalid_target_raises(self, session):
        with pytest.raises(ValueError):
            fv.validate_forecast("lead-1", "进行中", session)

    def test_support_verdict(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            return json.dumps({
                "verdict": "support",
                "reasoning": "MEDDICC 5 灯且有 champion 证据",
                "suggested_category": None,
                "missing_dimensions": [],
            }, ensure_ascii=False)

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "support"
        assert "champion" in result.reasoning.lower() or "5 灯" in result.reasoning

    def test_challenge_verdict(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            return json.dumps({
                "verdict": "challenge",
                "reasoning": "Champion 维度还空着",
                "suggested_category": "大概率",
                "missing_dimensions": ["Champion", "Decision Process"],
            }, ensure_ascii=False)

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "challenge"
        assert result.suggested_category == "大概率"
        assert "Champion" in result.missing_dimensions

    def test_abstain_verdict(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            return json.dumps({"verdict": "abstain", "reasoning": "上下文太薄"})

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "abstain"

    def test_invalid_verdict_falls_back_to_abstain(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            return json.dumps({"verdict": "no_idea", "reasoning": "..."})

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "abstain"

    def test_invalid_json_falls_back(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            return "this is not json"

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "abstain"

    def test_timeout_returns_abstain(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            raise httpx.TimeoutException("timeout!")

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "abstain"
        assert result.timed_out is True
        assert "AI" in result.reasoning

    def test_other_exceptions_fall_back(self, session, monkeypatch):
        def fake_call(sys_p, user_p, db, timeout):
            raise RuntimeError("network down")

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        result = fv.validate_forecast("lead-1", "必赢", session)
        assert result.verdict == "abstain"


class TestCache:
    def test_cache_hits_returns_cached(self, session, monkeypatch):
        calls = {"n": 0}

        def fake_call(sys_p, user_p, db, timeout):
            calls["n"] += 1
            return json.dumps({"verdict": "support", "reasoning": "ok"})

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        r1 = fv.validate_forecast("lead-1", "必赢", session)
        r2 = fv.validate_forecast("lead-1", "必赢", session)
        assert calls["n"] == 1  # 第二次命中 cache，没调 LLM
        assert r2.cached is True
        assert r1.verdict == r2.verdict == "support"

    def test_cache_keyed_by_target(self, session, monkeypatch):
        calls = {"n": 0}

        def fake_call(sys_p, user_p, db, timeout):
            calls["n"] += 1
            return json.dumps({"verdict": "support", "reasoning": "ok"})

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        fv.validate_forecast("lead-1", "必赢", session)
        fv.validate_forecast("lead-1", "大概率", session)
        # 不同 target → 不同 cache key → 调 2 次
        assert calls["n"] == 2

    def test_cache_disabled(self, session, monkeypatch):
        calls = {"n": 0}

        def fake_call(sys_p, user_p, db, timeout):
            calls["n"] += 1
            return json.dumps({"verdict": "support", "reasoning": "ok"})

        monkeypatch.setattr(fv, "_call_llm", fake_call)
        fv.validate_forecast("lead-1", "必赢", session, use_cache=False)
        fv.validate_forecast("lead-1", "必赢", session, use_cache=False)
        assert calls["n"] == 2
