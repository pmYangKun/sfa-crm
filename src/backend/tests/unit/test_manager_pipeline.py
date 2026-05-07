"""Unit tests for manager_pipeline_service — spec 004 T017."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.auth import UserDataScope
from app.models.lead import Lead
from app.models.org import OrgNode, User
from app.services import manager_pipeline_service as mps


def _ts(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


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
        # Org tree: root → team
        s.add(OrgNode(id="root", name="root", type="root"))
        s.flush()
        s.add(OrgNode(id="team1", name="team", type="team", parent_id="root"))
        s.flush()
        # Users
        s.add(User(id="admin1", login="admin", password_hash="x", name="管理员", org_node_id="root"))
        s.add(User(id="mgr1", login="m1", password_hash="x", name="经理", org_node_id="team1"))
        s.add(User(id="s1", login="sales01", password_hash="x", name="王小明", org_node_id="team1"))
        s.add(User(id="s2", login="sales02", password_hash="x", name="李思远", org_node_id="team1"))
        s.flush()
        # DataScopes
        s.add(UserDataScope(user_id="admin1", scope="all"))
        s.add(UserDataScope(user_id="mgr1", scope="current_and_below"))
        s.add(UserDataScope(user_id="s1", scope="self_only"))
        s.add(UserDataScope(user_id="s2", scope="self_only"))
        s.flush()
        # Leads
        s.add(Lead(
            id="l1", company_name="A", region="华北", source="referral",
            owner_id="s1", stage="active", forecast_category="必赢",
            meddicc_score=70, meddicc_completion=5, amount=100000,
            created_at=_ts(20), last_followup_at=_ts(2),
        ))
        s.add(Lead(
            id="l2", company_name="B", region="华北", source="referral",
            owner_id="s1", stage="active", forecast_category="进行中",
            meddicc_score=40, meddicc_completion=2, amount=50000,
            created_at=_ts(40), last_followup_at=_ts(20),  # silent
        ))
        s.add(Lead(
            id="l3", company_name="C", region="华北", source="referral",
            owner_id="s2", stage="active", forecast_category="大概率",
            meddicc_score=85, meddicc_completion=6, amount=200000,
            created_at=_ts(10), last_followup_at=_ts(1),
        ))
        s.add(Lead(
            id="l4", company_name="D", region="华北", source="referral",
            owner_id="s2", stage="converted", forecast_category="已赢单",
            meddicc_score=90, meddicc_completion=7, amount=150000,
            created_at=_ts(60), last_followup_at=_ts(1),
            converted_at=_ts(2),
        ))
        s.commit()
        yield s


def _user(s: Session, uid: str) -> User:
    return s.get(User, uid)


class TestQueryPipeline:
    def test_admin_sees_all(self, session):
        result = mps.query_pipeline(_user(session, "admin1"), session)
        assert result["total"] == 4
        # category_counts
        assert result["category_counts"]["必赢"] == 1
        assert result["category_counts"]["进行中"] == 1
        assert result["category_counts"]["大概率"] == 1
        assert result["category_counts"]["已赢单"] == 1

    def test_manager_sees_team(self, session):
        result = mps.query_pipeline(_user(session, "mgr1"), session)
        # mgr01 in team1，team1 contains s1, s2, mgr1 — 4 leads visible
        assert result["total"] == 4

    def test_sales_only_sees_self(self, session):
        result = mps.query_pipeline(_user(session, "s1"), session)
        # s1 owns l1, l2 — only those
        assert result["total"] == 2
        names = {l["company_name"] for l in result["leads"]}
        assert names == {"A", "B"}

    def test_filter_by_forecast_category(self, session):
        result = mps.query_pipeline(
            _user(session, "admin1"), session, forecast_category="必赢"
        )
        assert result["total"] == 1
        assert result["leads"][0]["company_name"] == "A"

    def test_filter_by_owner(self, session):
        result = mps.query_pipeline(
            _user(session, "admin1"), session, owner_id="s2"
        )
        assert result["total"] == 2
        names = {l["company_name"] for l in result["leads"]}
        assert names == {"C", "D"}

    def test_sort_by_score_asc(self, session):
        result = mps.query_pipeline(_user(session, "admin1"), session, sort_by="score_asc")
        scores = [l["meddicc_score"] for l in result["leads"] if l["meddicc_score"] is not None]
        assert scores == sorted(scores)

    def test_sort_by_amount_desc(self, session):
        result = mps.query_pipeline(_user(session, "admin1"), session, sort_by="amount_desc")
        amounts = [l["amount"] for l in result["leads"] if l["amount"] is not None]
        assert amounts == sorted(amounts, reverse=True)

    def test_warnings_in_response(self, session):
        # l2 应该至少有 silent_deal warning (last_followup 20 days ago)
        result = mps.query_pipeline(_user(session, "admin1"), session)
        l2_data = next(l for l in result["leads"] if l["id"] == "l2")
        codes = {w["code"] for w in l2_data["warnings"]}
        assert "silent_deal" in codes

    def test_invalid_forecast_category_raises(self, session):
        with pytest.raises(ValueError):
            mps.query_pipeline(_user(session, "admin1"), session, forecast_category="未知")


class TestQueryTeamRollup:
    def test_admin_sees_all_sales(self, session):
        result = mps.query_team_rollup(_user(session, "admin1"), session)
        # all users
        names = {r["sales"]["name"] for r in result["rows"]}
        assert "王小明" in names
        assert "李思远" in names

    def test_manager_sees_team_only(self, session):
        result = mps.query_team_rollup(_user(session, "mgr1"), session)
        # team1 has mgr1, s1, s2
        names = {r["sales"]["name"] for r in result["rows"]}
        assert "王小明" in names
        assert "李思远" in names

    def test_aggregates_active_leads(self, session):
        result = mps.query_team_rollup(_user(session, "admin1"), session)
        s1_row = next(r for r in result["rows"] if r["sales"]["id"] == "s1")
        # s1 has 2 active leads (l1, l2); l4 is converted not active
        assert s1_row["active_lead_count"] == 2
        assert s1_row["total_amount"] == 150000  # 100000 + 50000

    def test_excludes_converted_leads(self, session):
        result = mps.query_team_rollup(_user(session, "admin1"), session)
        s2_row = next(r for r in result["rows"] if r["sales"]["id"] == "s2")
        # s2 has 1 active (l3) + 1 converted (l4) → only 1 counts
        assert s2_row["active_lead_count"] == 1


class TestChatHelpers:
    def test_scan_team_warnings(self, session):
        result = mps.scan_team_warnings(_user(session, "admin1"), session)
        # l2 should have warnings (silent)
        lead_ids = {l["id"] for l in result["leads"]}
        assert "l2" in lead_ids
        assert result["total_warnings"] >= 1

    def test_team_meddicc_summary(self, session):
        result = mps.team_meddicc_summary(_user(session, "admin1"), session)
        assert "team_avg_score" in result
        assert "lit_density_per_dim" in result
        # 7 dims keys all present
        from app.models.lead_meddicc_evidence import DIMENSIONS
        assert all(d in result["lit_density_per_dim"] for d in DIMENSIONS)

    def test_top_attention_deals(self, session):
        result = mps.top_attention_deals(_user(session, "admin1"), session, limit=3)
        assert len(result["leads"]) <= 3

    def test_forecast_category_distribution(self, session):
        result = mps.forecast_category_distribution(_user(session, "admin1"), session)
        cats = {b["category"] for b in result["buckets"]}
        assert cats == {"进行中", "必赢", "大概率", "乐观估算", "已赢单", "已丢单"}
