"""API tests for manager_pipeline — spec 004 T025."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine


def _ts(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


@pytest.fixture
def client_and_session():
    """Build a TestClient with overridden DB session + auth dep."""
    # Import all models for metadata
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401
    from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
    from app.models.lead import Lead
    from app.models.org import OrgNode, User

    from sqlalchemy.pool import StaticPool
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
        s.add(OrgNode(id="team1", name="team", type="team", parent_id="root"))
        s.flush()
        s.add(User(id="admin1", login="admin", password_hash="x", name="管理员", org_node_id="root"))
        s.add(User(id="mgr1", login="m1", password_hash="x", name="经理", org_node_id="team1"))
        s.add(User(id="s1", login="sales01", password_hash="x", name="王小明", org_node_id="team1"))
        s.flush()
        s.add(UserDataScope(user_id="admin1", scope="all"))
        s.add(UserDataScope(user_id="mgr1", scope="current_and_below"))
        s.add(UserDataScope(user_id="s1", scope="self_only"))
        # Create lead.view permission + assign to a role 系统管理员
        perm = Permission(id="p1", code="lead.view", module="lead", name="查看")
        s.add(perm)
        role = Role(id="r1", name="系统管理员", is_system=True)
        s.add(role)
        s.flush()
        s.add(RolePermission(role_id="r1", permission_id="p1"))
        s.add(UserRole(user_id="admin1", role_id="r1"))
        s.add(UserRole(user_id="mgr1", role_id="r1"))
        s.add(UserRole(user_id="s1", role_id="r1"))
        s.flush()

        # Some leads
        s.add(Lead(
            id="l1", company_name="A公司", region="华北", source="referral",
            owner_id="s1", stage="active", forecast_category="必赢",
            meddicc_score=70, meddicc_completion=5, amount=100000,
            created_at=_ts(20), last_followup_at=_ts(2),
        ))
        s.add(Lead(
            id="l2", company_name="B公司", region="华北", source="referral",
            owner_id="s1", stage="active", forecast_category="进行中",
            meddicc_score=40, meddicc_completion=2, amount=50000,
            created_at=_ts(40), last_followup_at=_ts(20),
        ))
        s.commit()

    # Override session + auth deps in app
    from app.main import app
    from app.core.database import engine as real_engine, get_session
    from app.core.deps import get_current_user, security
    from app.models.org import User as _U

    def _override_session():
        with Session(eng) as ses:
            yield ses

    def _override_user():
        with Session(eng) as ses:
            user = ses.get(_U, "admin1")
            return user

    def _override_security():
        # Bypass HTTPBearer 检查
        return None

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[security] = _override_security

    client = TestClient(app)
    yield client, eng

    app.dependency_overrides.clear()


class TestPipelineAPI:
    def test_get_pipeline_happy_path(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/manager/pipeline")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "leads" in data
        assert "total" in data
        assert "category_counts" in data
        assert data["total"] == 2

    def test_filter_by_forecast(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/manager/pipeline?forecast_category=必赢")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["leads"][0]["company_name"] == "A公司"

    def test_invalid_sort_400(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/manager/pipeline?sort_by=bogus")
        assert resp.status_code == 400

    def test_team_rollup(self, client_and_session):
        client, _ = client_and_session
        resp = client.get("/api/v1/manager/team-rollup")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "rows" in data
        assert "total" in data
