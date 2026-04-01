"""Agent service — LLM orchestration and tool dispatch."""

import json
from urllib.parse import quote

import httpx
from sqlmodel import Session, select

from app.models.llm_config import ConversationMessage, LLMConfig, Skill


def get_active_llm_config(session: Session) -> LLMConfig | None:
    return session.exec(
        select(LLMConfig).where(LLMConfig.is_active == True)  # noqa: E712
    ).first()


def get_active_skills(session: Session) -> list[Skill]:
    return list(session.exec(
        select(Skill).where(Skill.is_active == True)  # noqa: E712
    ).all())


def get_conversation_history(session: Session, session_id: str, limit: int = 20) -> list[dict]:
    messages = session.exec(
        select(ConversationMessage)
        .where(ConversationMessage.session_id == session_id)
        .order_by(ConversationMessage.created_at.desc())  # type: ignore
        .limit(limit)
    ).all()
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages]


def save_message(session: Session, session_id: str, user_id: str, role: str, content: str):
    msg = ConversationMessage(
        session_id=session_id,
        user_id=user_id,
        role=role,
        content=content,
    )
    session.add(msg)


# ── Tool definitions ─────────────────────────────────────────────────────────
# "mode": "read" → 直接执行返回数据
# "mode": "navigate" → 返回导航指令，引导用户到 GUI 操作

TOOL_DEFINITIONS = [
    # ── 读操作 ──
    {
        "name": "search_leads",
        "mode": "read",
        "description": "搜索线索，可按公司名、大区筛选",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "公司名关键词"},
                "region": {"type": "string", "description": "大区"},
            },
        },
    },
    {
        "name": "get_lead_detail",
        "mode": "read",
        "description": "查看指定线索的详细信息（含联系人）",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "get_followup_history",
        "mode": "read",
        "description": "查看指定线索的跟进记录历史",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "list_customers",
        "mode": "read",
        "description": "查看客户列表",
        "parameters": {
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "公司名关键词"},
            },
        },
    },
    # ── 写操作（返回导航） ──
    {
        "name": "navigate_create_lead",
        "mode": "navigate",
        "description": "引导用户去创建新线索",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string", "description": "公司名称（预填）"},
                "region": {"type": "string", "description": "大区（预填）"},
                "source": {"type": "string", "description": "来源（预填）"},
            },
        },
    },
    {
        "name": "navigate_log_followup",
        "mode": "navigate",
        "description": "引导用户去录入跟进记录",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_create_key_event",
        "mode": "navigate",
        "description": "引导用户去记录关键事件（拜访KP、赠书、小课、大课等）",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_convert_lead",
        "mode": "navigate",
        "description": "引导用户去将线索转化为客户",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_release_lead",
        "mode": "navigate",
        "description": "引导用户去释放线索回公共池",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "navigate_mark_lost",
        "mode": "navigate",
        "description": "引导用户去标记线索为流失",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "company_name": {"type": "string", "description": "公司名称（用于显示）"},
            },
            "required": ["lead_id"],
        },
    },
]


def execute_tool(
    session: Session,
    tool_name: str,
    args: dict,
    user_id: str,
) -> dict:
    """Execute a tool and return the result."""
    from app.models.contact import Contact
    from app.models.customer import Customer
    from app.models.followup import FollowUp
    from app.models.lead import Lead
    from app.models.org import User

    try:
        # ── Read tools ────────────────────────────────────────────────
        if tool_name == "search_leads":
            stmt = select(Lead).where(Lead.stage == "active")
            if args.get("search"):
                stmt = stmt.where(Lead.company_name.contains(args["search"]))  # type: ignore
            if args.get("region"):
                stmt = stmt.where(Lead.region == args["region"])
            leads = session.exec(stmt.limit(10)).all()
            results = []
            for l in leads:
                owner_name = None
                if l.owner_id:
                    owner = session.get(User, l.owner_id)
                    owner_name = owner.name if owner else None
                results.append({
                    "id": l.id,
                    "company_name": l.company_name,
                    "region": l.region,
                    "pool": l.pool,
                    "owner": owner_name or "公共池",
                    "source": l.source,
                })
            return {"success": True, "count": len(results), "leads": results}

        elif tool_name == "get_lead_detail":
            lead = session.get(Lead, args["lead_id"])
            if not lead:
                return {"success": False, "message": "线索不存在"}
            owner_name = None
            if lead.owner_id:
                owner = session.get(User, lead.owner_id)
                owner_name = owner.name if owner else None
            contacts = session.exec(
                select(Contact).where(Contact.lead_id == lead.id)
            ).all()
            return {
                "success": True,
                "lead": {
                    "id": lead.id,
                    "company_name": lead.company_name,
                    "region": lead.region,
                    "stage": lead.stage,
                    "pool": lead.pool,
                    "owner": owner_name or "公共池",
                    "source": lead.source,
                    "created_at": lead.created_at,
                    "last_followup_at": lead.last_followup_at,
                },
                "contacts": [
                    {"name": c.name, "role": c.role, "phone": c.phone, "is_kp": c.is_key_decision_maker}
                    for c in contacts
                ],
            }

        elif tool_name == "get_followup_history":
            followups = session.exec(
                select(FollowUp)
                .where(FollowUp.lead_id == args["lead_id"])
                .order_by(FollowUp.followed_at.desc())  # type: ignore
                .limit(20)
            ).all()
            type_labels = {"phone": "电话", "wechat": "微信", "visit": "拜访", "other": "其他"}
            return {
                "success": True,
                "count": len(followups),
                "followups": [
                    {
                        "type": type_labels.get(f.type, f.type),
                        "content": f.content,
                        "followed_at": f.followed_at,
                    }
                    for f in followups
                ],
            }

        elif tool_name == "list_customers":
            stmt = select(Customer)
            if args.get("search"):
                stmt = stmt.where(Customer.company_name.contains(args["search"]))  # type: ignore
            customers = session.exec(stmt.limit(10)).all()
            results = []
            for c in customers:
                owner = session.get(User, c.owner_id)
                results.append({
                    "id": c.id,
                    "company_name": c.company_name,
                    "region": c.region,
                    "owner": owner.name if owner else "未知",
                    "source": c.source,
                })
            return {"success": True, "count": len(results), "customers": results}

        # ── Navigate tools (write operations → return navigation) ─────
        elif tool_name == "navigate_create_lead":
            params = []
            if args.get("company_name"):
                params.append(f"company_name={quote(args['company_name'])}")
            if args.get("region"):
                params.append(f"region={quote(args['region'])}")
            if args.get("source"):
                params.append(f"source={quote(args['source'])}")
            url = "/leads/new" + ("?" + "&".join(params) if params else "")
            return {
                "action": "navigate",
                "label": f"创建线索{': ' + args['company_name'] if args.get('company_name') else ''}",
                "url": url,
            }

        elif tool_name == "navigate_log_followup":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"录入跟进{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#followup",
            }

        elif tool_name == "navigate_create_key_event":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"记录关键事件{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#keyevent",
            }

        elif tool_name == "navigate_convert_lead":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"转化客户{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        elif tool_name == "navigate_release_lead":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"释放线索{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        elif tool_name == "navigate_mark_lost":
            lead_id = args["lead_id"]
            name = args.get("company_name", "")
            return {
                "action": "navigate",
                "label": f"标记流失{': ' + name if name else ''}",
                "url": f"/leads/{lead_id}#actions",
            }

        else:
            return {"success": False, "message": f"Unknown tool: {tool_name}"}

    except Exception as e:
        return {"success": False, "message": str(e)}
