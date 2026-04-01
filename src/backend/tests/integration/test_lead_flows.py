"""
Integration tests for key lead management flows (T106):
- Lead deduplication
- Pool assignment (claim/release)
- Lead conversion flow
"""
import uuid
import pytest
from sqlmodel import select

from app.models.lead import Lead
from app.models.auth import Role, UserRole, UserDataScope, Permission, RolePermission
from app.models.org import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_sales_user(session, node_id, login):
    """Create a sales role user."""
    role = session.exec(select(Role).where(Role.name == "销售")).first()
    if not role:
        role = Role(id=str(uuid.uuid4()), name="销售", is_system=True)
        session.add(role)
        session.flush()
        # Add lead permissions
        for code, module, name in [
            ("lead:create", "lead", "创建线索"),
            ("lead:claim", "lead", "抢占线索"),
            ("lead:release", "lead", "释放线索"),
            ("lead:convert", "lead", "转化线索"),
            ("followup:create", "followup", "创建跟进"),
            ("customer:view", "customer", "查看客户"),
        ]:
            p = session.exec(select(Permission).where(Permission.code == code)).first()
            if not p:
                p = Permission(id=str(uuid.uuid4()), code=code, module=module, name=name)
                session.add(p)
                session.flush()
            if not session.exec(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == p.id,
                )
            ).first():
                session.add(RolePermission(role_id=role.id, permission_id=p.id))
        session.flush()

    user = User(
        id=str(uuid.uuid4()),
        name=f"销售-{login}",
        login=login,
        password_hash=pwd_context.hash("test123"),
        org_node_id=node_id,
    )
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role_id=role.id))
    session.add(UserDataScope(user_id=user.id, scope="self_only"))
    session.flush()
    return user


def get_token(client, login):
    resp = client.post("/auth/login", json={"login": login, "password": "test123"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestLeadDeduplication:
    """Lead creation should reject duplicates by unified_code."""

    def test_create_lead(self, client, auth_headers):
        resp = client.post("/leads", json={
            "company_name": "测试公司 A",
            "unified_code": "91110000TEST0001",
            "region": "华北",
            "source": "手工录入",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["company_name"] == "测试公司 A"
        assert data["stage"] == "new"

    def test_duplicate_unified_code_rejected(self, client, auth_headers):
        # First creation
        client.post("/leads", json={
            "company_name": "重复公司",
            "unified_code": "DUPL0001TEST9999",
            "region": "华南",
            "source": "手工录入",
        }, headers=auth_headers)
        # Second with same unified_code
        resp = client.post("/leads", json={
            "company_name": "重复公司2",
            "unified_code": "DUPL0001TEST9999",
            "region": "华南",
            "source": "手工录入",
        }, headers=auth_headers)
        assert resp.status_code == 409

    def test_create_lead_without_unified_code(self, client, auth_headers):
        """Leads without unified_code should be allowed."""
        resp = client.post("/leads", json={
            "company_name": "无统一码公司",
            "region": "华东",
            "source": "手工录入",
        }, headers=auth_headers)
        assert resp.status_code == 201


class TestLeadPoolFlow:
    """Test private pool → public pool → claim flow."""

    def test_release_to_public_pool(self, client, session, auth_headers, root_node, admin_user):
        # Create a lead assigned to admin_user
        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="待释放公司",
            region="华北",
            source="手工录入",
            stage="new",
            pool="private",
            owner_id=admin_user.id,
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/release", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pool"] == "public"
        assert data["owner_id"] is None

    def test_claim_public_lead(self, client, session, root_node, admin_user):
        # Create a second sales user
        sales = create_sales_user(session, root_node.id, f"sales_claim_{uuid.uuid4().hex[:6]}")
        token = get_token(client, sales.login)
        headers = {"Authorization": f"Bearer {token}"}

        # Put a lead in public pool
        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="公共池公司",
            region="华北",
            source="手工录入",
            stage="new",
            pool="public",
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/claim", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["pool"] == "private"
        assert data["owner_id"] == sales.id


class TestLeadConversionFlow:
    """Test the full lead → customer conversion flow."""

    def test_convert_lead_creates_customer(self, client, session, auth_headers, admin_user, root_node):
        # Create a lead
        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="待转化公司",
            unified_code=f"CONV{uuid.uuid4().hex[:12].upper()}",
            region="华北",
            source="手工录入",
            stage="negotiating",
            pool="private",
            owner_id=admin_user.id,
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/convert", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["stage"] == "converted"

        # Verify customer was created
        from app.models.customer import Customer
        customer = session.exec(
            select(Customer).where(Customer.lead_id == lead.id)
        ).first()
        assert customer is not None
        assert customer.company_name == "待转化公司"

    def test_cannot_convert_already_converted(self, client, session, auth_headers, admin_user):
        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="已转化公司",
            region="华北",
            source="手工录入",
            stage="converted",
            pool="private",
            owner_id=admin_user.id,
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/convert", headers=auth_headers)
        assert resp.status_code == 400

    def test_followup_recorded_on_lead(self, client, session, auth_headers, admin_user):
        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="跟进测试公司",
            region="华北",
            source="手工录入",
            stage="contacted",
            pool="private",
            owner_id=admin_user.id,
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/followups", json={
            "type": "call",
            "content": "初次电话沟通，客户有意向",
        }, headers=auth_headers)
        assert resp.status_code == 201

        # Verify last_followup_at updated
        session.refresh(lead)
        assert lead.last_followup_at is not None


class TestLeadAssignment:
    """Test lead assignment by manager."""

    def test_manager_assign_lead(self, client, session, auth_headers, admin_user, root_node):
        sales = create_sales_user(session, root_node.id, f"sales_assign_{uuid.uuid4().hex[:6]}")

        lead = Lead(
            id=str(uuid.uuid4()),
            company_name="待分配公司",
            region="华北",
            source="手工录入",
            stage="new",
            pool="public",
        )
        session.add(lead)
        session.flush()

        resp = client.post(f"/leads/{lead.id}/assign", json={
            "assignee_id": sales.id,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["owner_id"] == sales.id
        assert data["pool"] == "private"
