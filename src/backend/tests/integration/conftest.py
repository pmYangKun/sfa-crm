"""
Integration test fixtures (T106).
Uses an in-memory SQLite DB and a TestClient against the real FastAPI app.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.main import app
from app.core.database import get_session
from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
from app.models.config import SystemConfig
from app.models.org import OrgNode, User
from app.models.lead import Lead
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.llm_config import LLMConfig, Skill, ConversationMessage
from app.models.report import DailyReport
from app.models.contact import Contact

import uuid
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


TEST_DB_URL = "sqlite://"  # in-memory


@pytest.fixture(name="engine", scope="session")
def engine_fixture():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture(name="client")
def client_fixture(session):
    def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="root_node")
def root_node_fixture(session):
    node = OrgNode(id=str(uuid.uuid4()), name="总部", type="root")
    session.add(node)
    session.flush()
    return node


@pytest.fixture(name="admin_role")
def admin_role_fixture(session):
    role = Role(id=str(uuid.uuid4()), name="系统管理员", is_system=True)
    session.add(role)
    session.flush()
    # Add permissions
    for code, module, name in [
        ("admin:users", "admin", "用户管理"),
        ("admin:org", "admin", "组织管理"),
        ("lead:create", "lead", "创建线索"),
        ("lead:claim", "lead", "抢占线索"),
        ("lead:assign", "lead", "分配线索"),
        ("lead:release", "lead", "释放线索"),
        ("lead:convert", "lead", "转化线索"),
        ("lead:mark_lost", "lead", "标记丢失"),
        ("followup:create", "followup", "创建跟进"),
        ("customer:view", "customer", "查看客户"),
    ]:
        existing = session.exec(select(Permission).where(Permission.code == code)).first()
        if not existing:
            perm = Permission(id=str(uuid.uuid4()), code=code, module=module, name=name)
            session.add(perm)
            session.flush()
            session.add(RolePermission(role_id=role.id, permission_id=perm.id))
    session.flush()
    return role


@pytest.fixture(name="admin_user")
def admin_user_fixture(session, root_node, admin_role):
    user = User(
        id=str(uuid.uuid4()),
        name="测试管理员",
        login="test_admin",
        password_hash=pwd_context.hash("test123"),
        org_node_id=root_node.id,
    )
    session.add(user)
    session.flush()
    session.add(UserRole(user_id=user.id, role_id=admin_role.id))
    session.add(UserDataScope(user_id=user.id, scope="all"))
    session.add(SystemConfig(key="private_pool_limit", value="100", description="私有池线索上限"))
    session.add(SystemConfig(key="followup_release_days", value="10", description="未跟进释放天数"))
    session.add(SystemConfig(key="conversion_release_days", value="30", description="未成单释放天数"))
    session.add(SystemConfig(key="claim_rate_limit", value="10", description="每分钟最大抢占次数"))
    session.add(SystemConfig(key="region_claim_rules", value="{}", description="大区抢占规则"))
    session.flush()
    return user


@pytest.fixture(name="auth_token")
def auth_token_fixture(client, admin_user):
    resp = client.post("/auth/login", json={"login": "test_admin", "password": "test123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
