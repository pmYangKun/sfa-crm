"""API tests for GET /leads/{lead_id}/meddicc-history + PUT /leads/{lead_id} — spec 004 T027."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def _ts(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


@pytest.fixture
def client_and_session():
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401
    from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
    from app.models.lead import Lead
    from app.models.lead_meddicc_history import LeadMeddiccHistory
    from app.models.org import OrgNode, User

    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(eng)

    with Session(eng) as s:
        s.add(OrgNode(id="root", name="root", type="root"))
        s.flush()
        s.add(User(id="admin1", login="admin", password_hash="x", name="管理员", org_node_id="root"))
        s.flush()
        s.add(UserDataScope(user_id="admin1", scope="all"))
        perm = Permission(id="p1", code="lead.view", module="lead", name="查看")
        s.add(perm)
        role = Role(id="r1", name="系统管理员", is_system=True)
        s.add(role)
        s.flush()
        s.add(RolePermission(role_id="r1", permission_id="p1"))
        s.add(UserRole(user_id="admin1", role_id="r1"))
        s.flush()

        s.add(Lead(
            id="lead-1", company_name="A", region="华北", source="referral",
            owner_id="admin1", stage="active", forecast_category="进行中",
            meddicc_score=70, meddicc_completion=5,
        ))
        # 2 history snapshots
        s.add(LeadMeddiccHistory(
            lead_id="lead-1", snapshot_at=_ts(5),
            meddicc_score=50, meddicc_completion=3, trigger_reason="backfill",
        ))
        s.add(LeadMeddiccHistory(
            lead_id="lead-1", snapshot_at=_ts(1),
            meddicc_score=70, meddicc_completion=5, trigger_reason="analyze",
        ))
        s.commit()

    from app.main import app
    from app.core.database import get_session
    from app.core.deps import get_current_user, security

    def _override_session():
        with Session(eng) as ses:
            yield ses

    def _override_user():
        with Session(eng) as ses:
            return ses.get(User, "admin1")

    def _override_security():
        return None

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[security] = _override_security

    client = TestClient(app)
    yield client, eng

    app.dependency_overrides.clear()


class TestMeddiccHistoryAPI:
    def test_get_history_returns_snapshots(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/leads/lead-1/meddicc-history")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["lead_id"] == "lead-1"
        assert len(data["snapshots"]) == 2
        # ascending
        assert data["snapshots"][0]["meddicc_score"] == 50
        assert data["snapshots"][1]["meddicc_score"] == 70

    def test_history_404_when_lead_missing(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/leads/nonexistent/meddicc-history")
        assert resp.status_code == 404


class TestUpdateLead:
    def test_update_amount_close_date(self, client_and_session):
        client, eng = client_and_session
        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"amount": 250000, "close_date": "2026-08-15"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["amount"] == 250000
        assert data["close_date"] == "2026-08-15"

    def test_update_forecast_writes_snapshot(self, client_and_session):
        client, eng = client_and_session
        from app.models.lead_meddicc_history import LeadMeddiccHistory

        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"forecast_category": "必赢"},
        )
        assert resp.status_code == 200, resp.text

        # 验证 snapshot 已写
        with Session(eng) as s:
            from sqlmodel import select
            snaps = s.exec(
                select(LeadMeddiccHistory).where(
                    LeadMeddiccHistory.lead_id == "lead-1",
                    LeadMeddiccHistory.trigger_reason == "forecast_change",
                )
            ).all()
            assert len(snaps) == 1
            assert snaps[0].forecast_category == "必赢"

    def test_won_syncs_stage_to_converted(self, client_and_session):
        client, eng = client_and_session
        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"forecast_category": "已赢单"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == "converted"
        assert data["converted_at"] is not None

    def test_lost_syncs_stage_to_lost(self, client_and_session):
        client, eng = client_and_session
        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"forecast_category": "已丢单"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == "lost"
        assert data["lost_at"] is not None

    def test_invalid_forecast_400(self, client_and_session):
        client, _ = client_and_session
        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"forecast_category": "未知"},
        )
        assert resp.status_code == 400

    def test_invalid_amount_400(self, client_and_session):
        client, _ = client_and_session
        resp = client.put(
            "/api/v1/leads/lead-1",
            json={"amount": -1000},
        )
        assert resp.status_code == 400
