"""API tests for forecast validation — spec 004 T026."""

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture
def client_and_session(monkeypatch):
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401
    from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
    from app.models.lead import Lead
    from app.models.org import OrgNode, User
    from app.models.llm_config import LLMConfig

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

        cfg = LLMConfig(
            id="llm-1", provider="deepseek", model="deepseek-chat",
            api_key="placeholder", is_active=True,
        )
        cfg.set_api_key("dummy")
        s.add(cfg)

        s.add(Lead(
            id="lead-1", company_name="A", region="华北", source="referral",
            owner_id="admin1", stage="active", forecast_category="进行中",
            meddicc_score=70, meddicc_completion=5,
        ))
        s.commit()

    from app.main import app
    from app.core.database import get_session
    from app.core.deps import get_current_user, security
    from app.services import forecast_validation_service as fv

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

    fv.clear_cache()

    client = TestClient(app)
    yield client, eng, monkeypatch

    app.dependency_overrides.clear()
    fv.clear_cache()


class TestForecastValidationAPI:
    def test_happy_path_with_mocked_llm(self, client_and_session, monkeypatch):
        client, _, _mp = client_and_session
        from app.services import forecast_validation_service as fv

        def fake_call(sys_p, user_p, db, timeout):
            return json.dumps({
                "verdict": "support",
                "reasoning": "证据充分",
                "suggested_category": None,
                "missing_dimensions": [],
            }, ensure_ascii=False)

        monkeypatch.setattr(fv, "_call_llm", fake_call)

        resp = client.post(
            "/api/v1/leads/lead-1/validate-forecast",
            json={"target_category": "必赢"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["verdict"] == "support"
        assert data["reasoning"] == "证据充分"

    def test_invalid_target_400(self, client_and_session):
        client, _, _ = client_and_session
        resp = client.post(
            "/api/v1/leads/lead-1/validate-forecast",
            json={"target_category": "进行中"},
        )
        assert resp.status_code == 400

    def test_missing_lead_404(self, client_and_session):
        client, _, _ = client_and_session
        resp = client.post(
            "/api/v1/leads/nonexistent/validate-forecast",
            json={"target_category": "必赢"},
        )
        assert resp.status_code == 404

    def test_timeout_returns_abstain(self, client_and_session, monkeypatch):
        client, _, _ = client_and_session
        from app.services import forecast_validation_service as fv
        import httpx

        def fake_call(sys_p, user_p, db, timeout):
            raise httpx.TimeoutException("timeout!")

        monkeypatch.setattr(fv, "_call_llm", fake_call)

        resp = client.post(
            "/api/v1/leads/lead-1/validate-forecast",
            json={"target_category": "必赢"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["verdict"] == "abstain"
