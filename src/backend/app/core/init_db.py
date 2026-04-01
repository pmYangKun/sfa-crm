import uuid
from pathlib import Path

from passlib.context import CryptContext
from sqlalchemy import text
from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
from app.models.config import SystemConfig
from app.models.llm_config import ConversationMessage, LLMConfig, Skill
from app.models.org import OrgNode, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# Initial data
# ---------------------------------------------------------------------------

SYSTEM_ROLES = [
    {"name": "系统管理员", "description": "全系统管理权限", "is_system": True},
    {"name": "销售VP", "description": "销售副总裁，查看全部数据", "is_system": True},
    {"name": "大区总", "description": "大区负责人，管理大区内数据", "is_system": True},
    {"name": "战队队长", "description": "团队负责人，管理团队数据", "is_system": True},
    {"name": "督导", "description": "督导，只读全量数据", "is_system": True},
    {"name": "销售", "description": "一线销售，管理自己的线索和客户", "is_system": True},
]

PERMISSIONS = [
    # lead
    ("lead.create", "lead", "创建线索"),
    ("lead.view", "lead", "查看线索"),
    ("lead.assign", "lead", "分配线索"),
    ("lead.claim", "lead", "抢占线索"),
    ("lead.release", "lead", "释放线索"),
    ("lead.convert", "lead", "转化线索"),
    ("lead.mark_lost", "lead", "标记丢失"),
    # customer
    ("customer.view", "customer", "查看客户"),
    ("customer.reassign", "customer", "转移客户"),
    # followup
    ("followup.create", "followup", "创建跟进"),
    ("followup.view", "followup", "查看跟进"),
    # key_event
    ("key_event.create", "key_event", "创建关键事件"),
    # report
    ("report.submit", "report", "提交日报"),
    ("report.view_team", "report", "查看团队日报"),
    # admin
    ("admin.org", "admin", "组织管理"),
    ("admin.users", "admin", "用户管理"),
    ("admin.roles", "admin", "角色权限管理"),
    ("admin.config", "admin", "系统配置"),
    ("admin.audit", "admin", "操作日志"),
]

SYSTEM_CONFIGS = [
    ("private_pool_limit", "100", "私有池线索上限"),
    ("followup_release_days", "10", "未跟进释放天数"),
    ("conversion_release_days", "30", "未成单释放天数"),
    ("claim_rate_limit", "10", "每分钟最大抢占次数"),
    ("daily_report_generate_at", "18:00", "日报生成时间"),
    ("name_similarity_threshold", "85", "公司名模糊匹配阈值（0-100）"),
    ("region_claim_rules", "{}", "各大区抢占规则 JSON"),
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_lead_owner ON lead(owner_id, stage)",
    "CREATE INDEX IF NOT EXISTS idx_lead_pool ON lead(pool, region)",
    "CREATE INDEX IF NOT EXISTS idx_lead_unified_code ON lead(unified_code) WHERE unified_code IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_customer_owner ON customer(owner_id)",
    "CREATE INDEX IF NOT EXISTS idx_followup_lead ON followup(lead_id, followed_at)",
    "CREATE INDEX IF NOT EXISTS idx_followup_customer ON followup(customer_id, followed_at)",
    "CREATE INDEX IF NOT EXISTS idx_key_event_lead ON key_event(lead_id, type)",
    "CREATE INDEX IF NOT EXISTS idx_key_event_customer ON key_event(customer_id, type)",
    "CREATE INDEX IF NOT EXISTS idx_contact_wechat ON contact(wechat_id) WHERE wechat_id IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_contact_phone ON contact(phone) WHERE phone IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_message(session_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at)",
]


def init_db():
    # Ensure data directory exists
    Path("data").mkdir(exist_ok=True)

    # Create all tables
    create_db_and_tables()

    with Session(engine) as session:
        _seed_roles(session)
        _seed_permissions(session)
        _seed_configs(session)
        _seed_initial_users(session)
        _create_indexes(session)
        session.commit()

    print("Database initialized successfully.")


def _seed_roles(session: Session):
    existing = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Role)
    ).all()
    if existing:
        return
    for r in SYSTEM_ROLES:
        session.add(Role(id=str(uuid.uuid4()), **r))


def _seed_permissions(session: Session):
    from sqlmodel import select

    existing = session.exec(select(Permission)).all()
    if existing:
        return
    for code, module, name in PERMISSIONS:
        session.add(Permission(id=str(uuid.uuid4()), code=code, module=module, name=name))


def _seed_configs(session: Session):
    from sqlmodel import select

    existing = session.exec(select(SystemConfig)).all()
    if existing:
        return
    for key, value, description in SYSTEM_CONFIGS:
        session.add(SystemConfig(key=key, value=value, description=description))


def _seed_initial_users(session: Session):
    from sqlmodel import select

    if session.exec(select(User)).first():
        return

    # Root org node
    root = OrgNode(id=str(uuid.uuid4()), name="总部", type="root")
    session.add(root)
    session.flush()

    # Admin user
    admin_id = str(uuid.uuid4())
    admin = User(
        id=admin_id,
        name="系统管理员",
        login="admin",
        password_hash=pwd_context.hash("admin123"),
        org_node_id=root.id,
    )
    session.add(admin)
    session.flush()

    # Assign admin role
    admin_role = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Role).where(Role.name == "系统管理员")
    ).first()
    if admin_role:
        session.add(UserRole(user_id=admin_id, role_id=admin_role.id))
        session.add(UserDataScope(user_id=admin_id, scope="all"))

    # Test users
    sales_role = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Role).where(Role.name == "销售")
    ).first()
    manager_role = session.exec(
        __import__("sqlmodel", fromlist=["select"]).select(Role).where(Role.name == "战队队长")
    ).first()

    sales_id = str(uuid.uuid4())
    session.add(User(
        id=sales_id,
        name="测试销售01",
        login="sales01",
        password_hash=pwd_context.hash("test123"),
        org_node_id=root.id,
    ))
    if sales_role:
        session.add(UserRole(user_id=sales_id, role_id=sales_role.id))
        session.add(UserDataScope(user_id=sales_id, scope="self_only"))

    manager_id = str(uuid.uuid4())
    session.add(User(
        id=manager_id,
        name="测试队长01",
        login="manager01",
        password_hash=pwd_context.hash("test123"),
        org_node_id=root.id,
    ))
    if manager_role:
        session.add(UserRole(user_id=manager_id, role_id=manager_role.id))
        session.add(UserDataScope(user_id=manager_id, scope="current_and_below"))


def _create_indexes(session: Session):
    for sql in INDEXES:
        try:
            session.exec(text(sql))
        except Exception:
            pass  # Index may not exist yet if table hasn't been created


if __name__ == "__main__":
    init_db()
