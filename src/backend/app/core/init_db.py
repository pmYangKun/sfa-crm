"""Database initialization: create tables, seed roles/permissions/users/config."""

import uuid

from passlib.context import CryptContext
from sqlmodel import Session, text

from app.core.database import create_db_and_tables, engine
from app.models.audit import AuditLog  # noqa: F401 — register table
from app.models.auth import (
    Permission,
    Role,
    RolePermission,
    UserDataScope,
    UserRole,
)
from app.models.config import SystemConfig
from app.models.contact import Contact, ContactRelation  # noqa: F401
from app.models.customer import Customer  # noqa: F401
from app.models.followup import FollowUp  # noqa: F401
from app.models.key_event import KeyEvent  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.llm_config import ConversationMessage, LLMConfig, Skill  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.org import OrgNode, User
from app.models.report import DailyReport  # noqa: F401

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Permission definitions (code format: module.action) ──────────────────────
PERMISSIONS = [
    # lead
    ("lead.view", "lead", "查看线索"),
    ("lead.create", "lead", "创建线索"),
    ("lead.assign", "lead", "分配线索"),
    ("lead.claim", "lead", "抢占线索"),
    ("lead.release", "lead", "释放线索"),
    ("lead.mark_lost", "lead", "标记流失"),
    # customer
    ("customer.view", "customer", "查看客户"),
    ("customer.reassign", "customer", "调配客户"),
    # followup
    ("followup.create", "followup", "录入跟进"),
    ("followup.view", "followup", "查看跟进"),
    # key event
    ("keyevent.create", "keyevent", "录入关键事件"),
    ("keyevent.view", "keyevent", "查看关键事件"),
    # report
    ("report.submit", "report", "提交日报"),
    ("report.view_team", "report", "查看团队日报"),
    # org
    ("org.manage", "org", "管理组织架构"),
    # user
    ("user.manage", "user", "管理用户"),
    # config
    ("config.manage", "config", "管理系统配置"),
    # agent
    ("agent.chat", "agent", "使用AI助手"),
]

# ── Role definitions ──────────────────────────────────────────────────────────
ROLES = {
    "销售": [
        "lead.view", "lead.create", "lead.claim", "lead.release", "lead.mark_lost",
        "customer.view",
        "followup.create", "followup.view",
        "keyevent.create", "keyevent.view",
        "report.submit",
        "agent.chat",
    ],
    "战队队长": [
        "lead.view", "lead.create", "lead.assign", "lead.claim", "lead.release", "lead.mark_lost",
        "customer.view", "customer.reassign",
        "followup.create", "followup.view",
        "keyevent.create", "keyevent.view",
        "report.submit", "report.view_team",
        "agent.chat",
    ],
    "大区总": [
        "lead.view", "lead.assign",
        "customer.view", "customer.reassign",
        "followup.view",
        "keyevent.view",
        "report.view_team",
        "agent.chat",
    ],
    "销售VP": [
        "lead.view", "lead.assign",
        "customer.view", "customer.reassign",
        "followup.view",
        "keyevent.view",
        "report.view_team",
        "agent.chat",
    ],
    "督导": [
        "lead.view",
        "customer.view",
        "followup.view",
        "keyevent.view",
        "report.view_team",
    ],
    "系统管理员": [p[0] for p in PERMISSIONS],  # all permissions
}

# ── System config defaults ────────────────────────────────────────────────────
DEFAULT_CONFIGS = [
    ("private_pool_limit", "100", "私有池线索上限"),
    ("followup_release_days", "10", "未跟进释放天数"),
    ("conversion_release_days", "30", "未成单释放天数"),
    ("claim_rate_limit", "10", "每分钟最大抢占次数"),
    ("daily_report_generate_at", "18:00", "日报生成时间"),
    ("name_similarity_threshold", "85", "公司名模糊匹配阈值（0-100）"),
    ("region_claim_rules", "{}", "各大区抢占规则 JSON"),
    ("agent_system_prompt", """你是 SFA CRM 的 AI 助手（Copilot）。你的职责是帮助销售团队高效管理线索、客户和跟进工作。

## 你的能力
- 查询工具：search_leads、get_lead_detail、get_followup_history、list_customers
- 导航工具：navigate_create_lead、navigate_log_followup、navigate_create_key_event、navigate_convert_lead、navigate_release_lead、navigate_mark_lost

## 关键规则
1. **查询操作**直接调用查询工具，获取数据后向用户展示结果
2. **写入操作**必须调用对应的 navigate_* 工具，工具会返回包含 url 字段的结果。你必须使用工具返回的 url（不要自己编造 URL），将其格式化为导航标记：[[nav:按钮文字|工具返回的url]]
3. **多步骤操作**一次展示所有步骤，每个步骤都要调用对应的 navigate 工具获取正确 URL，然后给出导航按钮
4. 用中文回答，语气专业简洁，像一个懂业务的助手
5. 回答时关注业务价值，不要暴露技术细节（如ID、API等）
6. 如果用户描述了与客户的沟通内容，主动建议录入跟进记录和关键事件

## 导航标记格式
[[nav:按钮文字|url]]

示例：navigate_create_lead 工具返回 {"url": "/leads/new?company_name=ABC&region=华北"}
你应输出：[[nav:去创建线索|/leads/new?company_name=ABC&region=华北]]

## ⚠️ URL 规则（严格遵守）
- 工具返回的数据中包含 detail_url 字段（如 "/leads/abc-123"），这是系统生成的正确链接
- 生成导航按钮时，必须使用 navigate_* 工具返回的 url，或查询工具返回的 detail_url
- **绝对禁止**自己拼接 /leads/xxx 这样的 URL，ID 是 UUID 格式，你无法猜出来
- 如果你想建议用户"录入跟进"或"记录事件"，必须先调用对应的 navigate_* 工具获取正确 URL""", "AI助手系统提示词"),
]


def init_db():
    import os
    # Ensure the data directory exists for SQLite file
    db_path = os.getenv("DATABASE_URL", "sqlite:///data/sfa_crm.db")
    if db_path.startswith("sqlite:///"):
        db_file = db_path.replace("sqlite:///", "")
        os.makedirs(os.path.dirname(db_file) or ".", exist_ok=True)

    create_db_and_tables()

    with Session(engine) as session:
        # ── Org nodes ─────────────────────────────────────────────────────
        root = OrgNode(id=str(uuid.uuid4()), name="总部", type="root")
        session.add(root)
        session.flush()

        region_north = OrgNode(
            id=str(uuid.uuid4()), name="华北大区", type="region", parent_id=root.id
        )
        region_south = OrgNode(
            id=str(uuid.uuid4()), name="华南大区", type="region", parent_id=root.id
        )
        session.add_all([region_north, region_south])
        session.flush()

        team_north1 = OrgNode(
            id=str(uuid.uuid4()), name="华北一队", type="team", parent_id=region_north.id
        )
        session.add(team_north1)
        session.flush()

        # ── Permissions ───────────────────────────────────────────────────
        perm_map: dict[str, str] = {}  # code -> id
        for code, module, name in PERMISSIONS:
            perm_id = str(uuid.uuid4())
            perm_map[code] = perm_id
            session.add(Permission(id=perm_id, code=code, module=module, name=name))
        session.flush()

        # ── Roles ─────────────────────────────────────────────────────────
        role_map: dict[str, str] = {}  # name -> id
        for role_name in ROLES:
            role_id = str(uuid.uuid4())
            role_map[role_name] = role_id
            session.add(Role(id=role_id, name=role_name, is_system=True))
        session.flush()

        # ── Role-Permission mapping ───────────────────────────────────────
        for role_name, perm_codes in ROLES.items():
            for code in perm_codes:
                session.add(
                    RolePermission(
                        role_id=role_map[role_name],
                        permission_id=perm_map[code],
                    )
                )
        session.flush()

        # ── Users ─────────────────────────────────────────────────────────
        admin_user = User(
            id=str(uuid.uuid4()),
            name="管理员",
            login="admin",
            password_hash=pwd_context.hash("12345"),
            org_node_id=root.id,
        )
        session.add(admin_user)
        session.flush()

        session.add(UserRole(user_id=admin_user.id, role_id=role_map["系统管理员"]))
        session.add(UserDataScope(user_id=admin_user.id, scope="all"))
        session.flush()

        sales_user = User(
            id=str(uuid.uuid4()),
            name="销售01",
            login="sales01",
            password_hash=pwd_context.hash("12345"),
            org_node_id=team_north1.id,
        )
        session.add(sales_user)
        session.flush()

        session.add(UserRole(user_id=sales_user.id, role_id=role_map["销售"]))
        session.add(UserDataScope(user_id=sales_user.id, scope="self_only"))
        session.flush()

        manager_user = User(
            id=str(uuid.uuid4()),
            name="队长01",
            login="manager01",
            password_hash=pwd_context.hash("12345"),
            org_node_id=team_north1.id,
        )
        session.add(manager_user)
        session.flush()

        session.add(UserRole(user_id=manager_user.id, role_id=role_map["战队队长"]))
        session.add(
            UserDataScope(user_id=manager_user.id, scope="current_and_below")
        )
        session.flush()

        # ── System config ─────────────────────────────────────────────────
        for key, value, desc in DEFAULT_CONFIGS:
            session.add(SystemConfig(key=key, value=value, description=desc))

        session.commit()

        # ── Indexes (T014) ────────────────────────────────────────────────
        index_statements = [
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
            "CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id)",
            "CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at)",
            "CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_message(session_id, created_at)",
        ]
        for stmt in index_statements:
            try:
                session.exec(text(stmt))
            except Exception:
                pass  # Table may not exist yet; indexes created when tables exist


    # ── LLM config from env ────────────────────────────────────────────────
    _init_llm_config(session)


def _init_llm_config(session: Session):
    """Read LLM_PROVIDER / LLM_MODEL / LLM_API_KEY from .env and seed LLMConfig."""
    import os
    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        return  # No key configured, skip

    provider = os.getenv("LLM_PROVIDER", "deepseek")
    model = os.getenv("LLM_MODEL", "deepseek-chat")

    config = LLMConfig(
        id=str(uuid.uuid4()),
        provider=provider,
        model=model,
        api_key=api_key,
        is_active=True,
    )
    session.add(config)
    session.commit()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
