"""T011 — MCP 密钥生命周期单测（spec 005 FR-002 ~ FR-008）."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.config import SystemConfig
from app.models.mcp_token import McpToken
from app.models.org import OrgNode, User
from app.services import mcp_token_service as svc


@pytest.fixture
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys = ON")
        cur.close()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        node = OrgNode(name="总部", type="region")
        s.add(node)
        s.commit()
        s.refresh(node)
        for login, name in (("sales01", "王小明"), ("manager01", "陈队长")):
            s.add(
                User(
                    name=name,
                    login=login,
                    password_hash="x",
                    org_node_id=node.id,
                )
            )
        s.add(SystemConfig(key="mcp_token_ttl_days", value="7"))
        s.commit()
        yield s


def test_issue_returns_plaintext_once_and_stores_only_hash(session):
    plain, record = svc.issue_token(session, "manager", client_ip="1.2.3.4")

    assert plain.startswith("sfa_ro_")
    assert record.token_prefix == plain[:12]
    # 库里存的是摘要，不是明文
    assert record.token_hash != plain
    assert len(record.token_hash) == 64
    stored = session.get(McpToken, record.id)
    assert plain not in (stored.token_hash, stored.token_prefix + "…")


def test_persona_maps_to_expected_account(session):
    _, sales = svc.issue_token(session, "sales")
    _, manager = svc.issue_token(session, "manager")

    assert session.get(User, sales.user_id).login == "sales01"
    assert session.get(User, manager.user_id).login == "manager01"


def test_admin_persona_is_rejected(session):
    """FR-001：不提供管理员身份。"""
    with pytest.raises(svc.PersonaNotAllowed):
        svc.issue_token(session, "admin")


def test_unknown_persona_is_rejected(session):
    with pytest.raises(svc.PersonaNotAllowed):
        svc.issue_token(session, "vp")


def test_missing_demo_account_raises_instead_of_silent_fallback(session):
    """种子数据缺账号时必须显式报错，不得降级到别的账号。"""
    user = session.exec(
        __import__("sqlmodel").select(User).where(User.login == "sales01")
    ).first()
    session.delete(user)
    session.commit()

    with pytest.raises(svc.PersonaAccountMissing):
        svc.issue_token(session, "sales")


def test_lookup_roundtrip(session):
    plain, record = svc.issue_token(session, "sales")
    found = svc.lookup(session, plain)
    assert found is not None and found.id == record.id
    assert svc.lookup(session, "sfa_ro_not-a-real-token") is None


def test_valid_token_is_valid(session):
    _, record = svc.issue_token(session, "sales")
    assert record.is_valid() is True


def test_expired_token_is_invalid(session):
    _, record = svc.issue_token(session, "sales")
    record.expires_at = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    assert record.is_valid() is False


def test_revoked_token_is_invalid(session):
    plain, record = svc.issue_token(session, "sales")
    assert svc.revoke(session, plain) is True
    session.refresh(record)
    assert record.is_valid() is False
    # 重复吊销返回 False，不报错
    assert svc.revoke(session, plain) is False


def test_mark_used_increments_counter(session):
    _, record = svc.issue_token(session, "sales")
    assert record.call_count == 0
    svc.mark_used(session, record)
    svc.mark_used(session, record)
    session.refresh(record)
    assert record.call_count == 2
    assert record.last_used_at is not None


def test_count_issued_today_tracks_source_ip(session):
    svc.issue_token(session, "sales", client_ip="9.9.9.9")
    svc.issue_token(session, "manager", client_ip="9.9.9.9")
    svc.issue_token(session, "sales", client_ip="8.8.8.8")

    assert svc.count_issued_today(session, "9.9.9.9") == 2
    assert svc.count_issued_today(session, "8.8.8.8") == 1
    assert svc.count_issued_today(session, "7.7.7.7") == 0


def test_ttl_comes_from_system_config_not_hardcoded(session):
    """宪法原则三：阈值可配置。"""
    cfg = session.get(SystemConfig, "mcp_token_ttl_days")
    cfg.value = "30"
    session.add(cfg)
    session.commit()

    _, record = svc.issue_token(session, "sales")
    assert 28 <= svc.days_remaining(record) <= 30
