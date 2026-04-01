"""Integration tests for critical lead flows: uniqueness, pool, conversion."""

import uuid

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.lead import Lead
from app.models.org import OrgNode, User
from app.models.contact import Contact
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.audit import AuditLog
from app.services.uniqueness_service import check_uniqueness, strip_legal_suffix
from app.services.lead_service import (
    assign_lead,
    claim_lead,
    release_lead,
    convert_lead,
    log_followup,
)


@pytest.fixture
def session():
    """In-memory SQLite session for tests."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        # Seed minimal data
        org = OrgNode(id="org-root", name="总部", type="root")
        s.add(org)
        s.flush()

        user_a = User(id="user-a", login="sales01", password_hash="x", name="张三", org_node_id="org-root")
        user_b = User(id="user-b", login="sales02", password_hash="x", name="李四", org_node_id="org-root")
        s.add(user_a)
        s.add(user_b)
        s.flush()
        yield s


# ── Uniqueness Tests ──────────────────────────────────────────────────────────


class TestUniqueness:
    def test_strip_legal_suffix(self):
        assert strip_legal_suffix("华为技术有限公司") == "华为技术"
        assert strip_legal_suffix("京东集团股份有限公司") == "京东"
        assert strip_legal_suffix("华为") == "华为"

    def test_exact_match_by_unified_code(self, session):
        session.add(Lead(
            company_name="华为技术有限公司", unified_code="91440300",
            region="华南", source="referral", owner_id="user-a", pool="private",
        ))
        session.flush()

        result = check_uniqueness(session, "华为科技", "91440300")
        assert result["status"] == "exact"
        assert result["existing_lead"].company_name == "华为技术有限公司"

    def test_fuzzy_match_above_threshold(self, session):
        session.add(Lead(
            company_name="华为技术有限公司", region="华南", source="referral",
        ))
        session.flush()

        result = check_uniqueness(session, "华为技术股份有限公司", None, threshold=80)
        assert result["status"] == "similar"
        assert len(result["similar_leads"]) >= 1

    def test_no_match(self, session):
        session.add(Lead(
            company_name="华为技术有限公司", region="华南", source="referral",
        ))
        session.flush()

        result = check_uniqueness(session, "完全不同的公司名称", None)
        assert result["status"] == "ok"


# ── Pool Assignment Tests ─────────────────────────────────────────────────────


class TestPoolAssignment:
    def _make_lead(self, session, pool="public", owner_id=None) -> Lead:
        lead = Lead(
            company_name=f"测试公司_{uuid.uuid4().hex[:6]}",
            region="华北", source="organic", pool=pool, owner_id=owner_id,
        )
        session.add(lead)
        session.flush()
        return lead

    def test_assign_lead(self, session):
        lead = self._make_lead(session, pool="public")
        result = assign_lead(session, "user-a", lead.id, "user-b")
        assert result.pool == "private"
        assert result.owner_id == "user-b"

    def test_claim_lead_from_public(self, session):
        lead = self._make_lead(session, pool="public")
        result = claim_lead(session, "user-a", lead.id)
        assert result.pool == "private"
        assert result.owner_id == "user-a"

    def test_claim_private_lead_fails(self, session):
        lead = self._make_lead(session, pool="private", owner_id="user-b")
        with pytest.raises(ValueError, match="已被其他销售抢占"):
            claim_lead(session, "user-a", lead.id)

    def test_private_pool_limit_enforced(self, session):
        # Fill pool to limit
        for _ in range(3):
            self._make_lead(session, pool="private", owner_id="user-a")

        new_lead = self._make_lead(session, pool="public")
        with pytest.raises(ValueError, match="私有池已满"):
            claim_lead(session, "user-a", new_lead.id, private_pool_limit=3)

    def test_release_lead(self, session):
        lead = self._make_lead(session, pool="private", owner_id="user-a")
        result = release_lead(session, "user-a", lead.id)
        assert result.pool == "public"
        assert result.owner_id is None


# ── Conversion Flow Tests ────────────────────────────────────────────────────


class TestConversionFlow:
    def test_convert_lead_to_customer(self, session):
        lead = Lead(
            company_name="转化测试公司", region="华东",
            source="referral", pool="private", owner_id="user-a",
        )
        session.add(lead)
        session.flush()

        # Add a contact
        contact = Contact(lead_id=lead.id, name="联系人A")
        session.add(contact)
        session.flush()

        result_lead, customer = convert_lead(session, "user-a", lead.id)
        session.flush()

        assert result_lead.stage == "converted"
        assert result_lead.converted_at is not None
        assert customer.company_name == "转化测试公司"
        assert customer.owner_id == "user-a"
        assert customer.lead_id == lead.id

        # Contact should have migrated to customer
        session.refresh(contact)
        assert contact.lead_id is None
        assert contact.customer_id == customer.id

    def test_convert_already_converted_fails(self, session):
        lead = Lead(
            company_name="已转化公司", region="华东",
            source="referral", pool="private", owner_id="user-a", stage="converted",
        )
        session.add(lead)
        session.flush()

        with pytest.raises(ValueError, match="状态不允许"):
            convert_lead(session, "user-a", lead.id)

    def test_followup_updates_last_followup_at(self, session):
        lead = Lead(
            company_name="跟进测试公司", region="华南",
            source="organic", pool="private", owner_id="user-a",
        )
        session.add(lead)
        session.flush()

        ts = "2026-04-01T10:00:00+00:00"
        log_followup(
            session, "user-a", lead_id=lead.id,
            followup_type="phone", content="电话沟通", followed_at=ts,
        )
        session.flush()

        session.refresh(lead)
        assert lead.last_followup_at == ts
