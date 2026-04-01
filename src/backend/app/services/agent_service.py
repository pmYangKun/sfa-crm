"""Agent service — LLM orchestration and tool dispatch."""

import json

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


TOOL_DEFINITIONS = [
    {
        "name": "search_leads",
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
        "name": "assign_lead",
        "description": "将线索分配给指定销售",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "sales_id": {"type": "string", "description": "销售用户ID"},
            },
            "required": ["lead_id", "sales_id"],
        },
    },
    {
        "name": "release_lead",
        "description": "释放线索回公共池",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
            },
            "required": ["lead_id"],
        },
    },
    {
        "name": "log_followup",
        "description": "为线索录入跟进记录",
        "parameters": {
            "type": "object",
            "properties": {
                "lead_id": {"type": "string", "description": "线索ID"},
                "type": {"type": "string", "enum": ["phone", "wechat", "visit", "other"]},
                "content": {"type": "string", "description": "跟进内容"},
            },
            "required": ["lead_id", "type", "content"],
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
    from app.models.lead import Lead
    from app.services.lead_service import (
        assign_lead as do_assign,
        release_lead as do_release,
        log_followup as do_followup,
    )

    try:
        if tool_name == "search_leads":
            stmt = select(Lead).where(Lead.stage == "active")
            if args.get("search"):
                stmt = stmt.where(Lead.company_name.contains(args["search"]))  # type: ignore
            if args.get("region"):
                stmt = stmt.where(Lead.region == args["region"])
            leads = session.exec(stmt.limit(10)).all()
            return {
                "success": True,
                "leads": [
                    {"id": l.id, "company_name": l.company_name, "region": l.region, "pool": l.pool, "owner_id": l.owner_id}
                    for l in leads
                ],
            }

        elif tool_name == "assign_lead":
            lead = do_assign(session, user_id, args["lead_id"], args["sales_id"])
            return {"success": True, "message": f"已将线索分配给 {args['sales_id']}"}

        elif tool_name == "release_lead":
            lead = do_release(session, user_id, args["lead_id"])
            return {"success": True, "message": "线索已释放至公共池"}

        elif tool_name == "log_followup":
            from datetime import datetime, timezone
            do_followup(
                session, user_id, lead_id=args["lead_id"],
                followup_type=args["type"], content=args["content"],
                followed_at=datetime.now(timezone.utc).isoformat(),
            )
            return {"success": True, "message": "跟进记录已添加"}

        else:
            return {"success": False, "message": f"Unknown tool: {tool_name}"}

    except Exception as e:
        return {"success": False, "message": str(e)}
