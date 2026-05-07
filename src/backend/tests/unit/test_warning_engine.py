"""Unit tests for warning_engine — spec 004 §5.1.

每条规则 1 正例 + 1 反例 + 边界 case。Engine 是纯函数（接收 Lead + WarningContext），
无 DB 依赖，单测最快路径直接构造对象不走 SQLite。

batch 路径单独测一个集成 case（用 in-memory SQLite）。
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.lead import Lead
from app.services.warning_engine import (
    DEFAULT_THRESHOLDS,
    WarningContext,
    compute_warnings_batch,
    compute_warnings_for_lead,
    rule_big_deal_thin_evidence,
    rule_brag_without_evidence,
    rule_close_imminent_low_score,
    rule_no_champion_after_followups,
    rule_overdue_not_closed,
    rule_silent_deal,
    rule_single_contact_exposed,
)


NOW = datetime(2026, 5, 7, 12, 0, 0, tzinfo=timezone.utc)


def _ctx(**overrides) -> WarningContext:
    base = dict(
        today=NOW,
        last_activity_at=None,
        followup_count=0,
        contacts_count=0,
        lit_dimensions=set(),
        team_amount_median=None,
        thresholds=dict(DEFAULT_THRESHOLDS),
    )
    base.update(overrides)
    return WarningContext(**base)


def _lead(**overrides) -> Lead:
    base = dict(
        id="lead-1",
        company_name="测试公司",
        region="华北",
        source="referral",
        owner_id="user-1",
        stage="active",
        forecast_category="进行中",
        created_at=(NOW - timedelta(days=10)).isoformat(),
        last_followup_at=(NOW - timedelta(days=3)).isoformat(),
    )
    base.update(overrides)
    return Lead(**base)


# ── Rule 1: silent_deal ──────────────────────────────────────────────────────


class TestSilentDeal:
    def test_triggers_when_no_activity_for_long(self):
        lead = _lead(last_followup_at=(NOW - timedelta(days=20)).isoformat())
        ctx = _ctx(last_activity_at=lead.last_followup_at)
        w = rule_silent_deal(lead, ctx)
        assert w is not None
        assert w.code == "silent_deal"
        assert "14" in w.mitigation

    def test_silent_when_no_activity_at_all_but_lead_old(self):
        lead = _lead(
            last_followup_at=None,
            created_at=(NOW - timedelta(days=20)).isoformat(),
        )
        ctx = _ctx(last_activity_at=None)
        assert rule_silent_deal(lead, ctx) is not None

    def test_does_not_trigger_when_recent(self):
        lead = _lead(last_followup_at=(NOW - timedelta(days=3)).isoformat())
        ctx = _ctx(last_activity_at=lead.last_followup_at)
        assert rule_silent_deal(lead, ctx) is None

    def test_does_not_trigger_for_non_active_stage(self):
        lead = _lead(stage="converted", last_followup_at=(NOW - timedelta(days=30)).isoformat())
        ctx = _ctx(last_activity_at=lead.last_followup_at)
        assert rule_silent_deal(lead, ctx) is None


# ── Rule 2: brag_without_evidence ─────────────────────────────────────────────


class TestBragWithoutEvidence:
    def test_triggers_when_must_win_but_low_lit(self):
        lead = _lead(forecast_category="必赢")
        ctx = _ctx(lit_dimensions={"metrics", "pain"})  # 只 2 灯 < 5
        w = rule_brag_without_evidence(lead, ctx)
        assert w is not None
        assert w.code == "brag_without_evidence"
        assert "Champion" in w.mitigation or "Economic" in w.mitigation  # 缺失维度被列出

    def test_does_not_trigger_when_5_lit(self):
        lead = _lead(forecast_category="必赢")
        ctx = _ctx(lit_dimensions={"metrics", "pain", "champion", "economic_buyer", "decision_criteria"})
        assert rule_brag_without_evidence(lead, ctx) is None

    def test_does_not_trigger_for_other_categories(self):
        lead = _lead(forecast_category="进行中")
        ctx = _ctx(lit_dimensions=set())
        assert rule_brag_without_evidence(lead, ctx) is None


# ── Rule 3: close_imminent_low_score ──────────────────────────────────────────


class TestCloseImminentLowScore:
    def test_triggers_when_close_soon_and_low_score(self):
        cd = (NOW + timedelta(days=7)).date().isoformat()
        lead = _lead(close_date=cd, meddicc_score=45)
        w = rule_close_imminent_low_score(lead, _ctx())
        assert w is not None
        assert w.code == "close_imminent_low_score"

    def test_does_not_trigger_when_score_high(self):
        cd = (NOW + timedelta(days=7)).date().isoformat()
        lead = _lead(close_date=cd, meddicc_score=80)
        assert rule_close_imminent_low_score(lead, _ctx()) is None

    def test_does_not_trigger_when_close_far(self):
        cd = (NOW + timedelta(days=60)).date().isoformat()
        lead = _lead(close_date=cd, meddicc_score=45)
        assert rule_close_imminent_low_score(lead, _ctx()) is None

    def test_does_not_trigger_when_no_close_date(self):
        lead = _lead(close_date=None, meddicc_score=10)
        assert rule_close_imminent_low_score(lead, _ctx()) is None


# ── Rule 4: overdue_not_closed ────────────────────────────────────────────────


class TestOverdueNotClosed:
    def test_triggers_when_close_date_passed(self):
        cd = (NOW - timedelta(days=5)).date().isoformat()
        lead = _lead(close_date=cd)
        w = rule_overdue_not_closed(lead, _ctx())
        assert w is not None
        assert w.code == "overdue_not_closed"

    def test_does_not_trigger_when_future(self):
        cd = (NOW + timedelta(days=5)).date().isoformat()
        lead = _lead(close_date=cd)
        assert rule_overdue_not_closed(lead, _ctx()) is None

    def test_does_not_trigger_when_already_won(self):
        cd = (NOW - timedelta(days=5)).date().isoformat()
        lead = _lead(close_date=cd, stage="converted")
        assert rule_overdue_not_closed(lead, _ctx()) is None


# ── Rule 5: no_champion_after_followups ───────────────────────────────────────


class TestNoChampionAfterFollowups:
    def test_triggers_when_followups_high_no_champion(self):
        lead = _lead()
        ctx = _ctx(followup_count=5, lit_dimensions={"metrics", "pain"})
        w = rule_no_champion_after_followups(lead, ctx)
        assert w is not None
        assert "5 次" in w.mitigation

    def test_does_not_trigger_when_champion_lit(self):
        lead = _lead()
        ctx = _ctx(followup_count=5, lit_dimensions={"champion"})
        assert rule_no_champion_after_followups(lead, ctx) is None

    def test_does_not_trigger_when_low_followups(self):
        lead = _lead()
        ctx = _ctx(followup_count=2, lit_dimensions=set())
        assert rule_no_champion_after_followups(lead, ctx) is None


# ── Rule 6: single_contact_exposed ────────────────────────────────────────────


class TestSingleContactExposed:
    def test_triggers_when_one_contact_old_lead(self):
        lead = _lead(created_at=(NOW - timedelta(days=45)).isoformat())
        ctx = _ctx(contacts_count=1)
        w = rule_single_contact_exposed(lead, ctx)
        assert w is not None
        assert "45" in w.mitigation

    def test_does_not_trigger_when_two_contacts(self):
        lead = _lead(created_at=(NOW - timedelta(days=45)).isoformat())
        ctx = _ctx(contacts_count=2)
        assert rule_single_contact_exposed(lead, ctx) is None

    def test_does_not_trigger_when_lead_young(self):
        lead = _lead(created_at=(NOW - timedelta(days=10)).isoformat())
        ctx = _ctx(contacts_count=1)
        assert rule_single_contact_exposed(lead, ctx) is None


# ── Rule 7: big_deal_thin_evidence ────────────────────────────────────────────


class TestBigDealThinEvidence:
    def test_triggers_when_big_amount_low_lit(self):
        lead = _lead(amount=600000)
        ctx = _ctx(team_amount_median=100000, lit_dimensions={"pain"})
        w = rule_big_deal_thin_evidence(lead, ctx)
        assert w is not None
        assert w.code == "big_deal_thin_evidence"
        assert "600,000" in w.mitigation

    def test_does_not_trigger_when_normal_amount(self):
        lead = _lead(amount=100000)
        ctx = _ctx(team_amount_median=100000, lit_dimensions={"pain"})
        assert rule_big_deal_thin_evidence(lead, ctx) is None

    def test_does_not_trigger_when_evidence_strong(self):
        lead = _lead(amount=600000)
        ctx = _ctx(
            team_amount_median=100000,
            lit_dimensions={"metrics", "pain", "champion", "economic_buyer", "decision_criteria"},
        )
        assert rule_big_deal_thin_evidence(lead, ctx) is None

    def test_does_not_trigger_when_no_median(self):
        lead = _lead(amount=600000)
        ctx = _ctx(team_amount_median=None, lit_dimensions=set())
        assert rule_big_deal_thin_evidence(lead, ctx) is None


# ── Aggregation ───────────────────────────────────────────────────────────────


class TestComputeWarningsForLead:
    def test_multiple_rules_can_fire(self):
        lead = _lead(
            forecast_category="必赢",
            last_followup_at=(NOW - timedelta(days=20)).isoformat(),
        )
        ctx = _ctx(
            last_activity_at=lead.last_followup_at,
            lit_dimensions={"pain"},  # 只 1 灯
        )
        warnings = compute_warnings_for_lead(lead, ctx)
        codes = {w.code for w in warnings}
        assert "silent_deal" in codes
        assert "brag_without_evidence" in codes


# ── Batch path（in-memory SQLite）─────────────────────────────────────────────


@pytest.fixture
def session():
    # 必须先 import 全部 model，让 SQLModel.metadata 集齐 FK target 表
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
        yield s


class TestBatch:
    def test_batch_returns_only_lead_with_warnings(self, session):
        from app.models.contact import Contact
        from app.models.org import OrgNode, User

        org = OrgNode(id="org-1", name="总部", type="root")
        u = User(id="user-1", login="u1", password_hash="x", name="U1", org_node_id="org-1")
        session.add(org)
        session.add(u)
        session.flush()

        l1 = Lead(
            id="l1",
            company_name="A",
            region="华北",
            source="referral",
            owner_id="user-1",
            stage="active",
            forecast_category="进行中",
            created_at=(NOW - timedelta(days=20)).isoformat(),
            last_followup_at=(NOW - timedelta(days=20)).isoformat(),
        )
        l2 = Lead(
            id="l2",
            company_name="B",
            region="华北",
            source="referral",
            owner_id="user-1",
            stage="active",
            forecast_category="进行中",
            created_at=(NOW - timedelta(days=2)).isoformat(),
            last_followup_at=(NOW - timedelta(days=1)).isoformat(),
        )
        session.add(l1)
        session.add(l2)
        session.commit()

        result = compute_warnings_batch([l1, l2], session, today=NOW)
        # l1 沉默 → 触发 silent_deal；l2 健康 → 无 warning
        assert "l1" in result
        assert "l2" not in result
        assert any(w.code == "silent_deal" for w in result["l1"])
