"""
Agent service (T098).

Reads active LLMConfig from DB, calls the LLM API (Anthropic or OpenAI compatible),
executes tool calls by dispatching to backend API functions, and persists conversation.
"""
import json
import uuid
from typing import Any

import httpx
from sqlmodel import Session, select

from app.models.llm_config import ConversationMessage, LLMConfig, Skill
from app.tools import ALL_TOOLS


# ── LLM call ─────────────────────────────────────────────────────────────────

def _get_active_config(session: Session) -> LLMConfig | None:
    return session.exec(select(LLMConfig).where(LLMConfig.is_active == True)).first()  # noqa: E712


def _call_anthropic(config: LLMConfig, messages: list[dict], system: str) -> dict:
    """Call Anthropic Messages API with tool use."""
    base = config.base_url or "https://api.anthropic.com"
    headers = {
        "x-api-key": config.api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": config.model_name,
        "max_tokens": 4096,
        "system": system,
        "messages": messages,
        "tools": ALL_TOOLS,
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{base}/v1/messages", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()


def _call_openai(config: LLMConfig, messages: list[dict], system: str) -> dict:
    """Call OpenAI-compatible chat completions API."""
    base = config.base_url or "https://api.openai.com"
    headers = {
        "Authorization": f"Bearer {config.api_key}",
        "content-type": "application/json",
    }
    openai_tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in ALL_TOOLS
    ]
    all_messages = [{"role": "system", "content": system}] + messages
    payload = {
        "model": config.model_name,
        "messages": all_messages,
        "tools": openai_tools,
        "max_tokens": 4096,
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(f"{base}/v1/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()


# ── Tool dispatch ─────────────────────────────────────────────────────────────

def _dispatch_tool(tool_name: str, tool_input: dict, actor_id: str, session: Session) -> Any:
    """Execute a tool call and return a JSON-serialisable result."""
    from app.services.lead_service import (
        assign_lead, convert_lead, release_lead,
    )
    from app.models.lead import Lead
    from app.models.customer import Customer
    from app.models.followup import FollowUp
    from sqlmodel import select

    if tool_name == "list_leads":
        stmt = select(Lead)
        if stage := tool_input.get("stage"):
            stmt = stmt.where(Lead.stage == stage)
        if pool := tool_input.get("pool"):
            stmt = stmt.where(Lead.pool == pool)
        limit = tool_input.get("limit", 20)
        leads = session.exec(stmt.limit(limit)).all()
        return [{"id": l.id, "company_name": l.company_name, "stage": l.stage, "pool": l.pool} for l in leads]

    elif tool_name == "get_lead":
        lead = session.get(Lead, tool_input["lead_id"])
        if not lead:
            return {"error": "线索不存在"}
        return {"id": lead.id, "company_name": lead.company_name, "stage": lead.stage,
                "pool": lead.pool, "region": lead.region, "owner_id": lead.owner_id}

    elif tool_name == "assign_lead":
        assign_lead(session, actor_id, tool_input["lead_id"], tool_input["assignee_id"])
        return {"ok": True}

    elif tool_name == "release_lead":
        release_lead(session, actor_id, tool_input["lead_id"])
        return {"ok": True}

    elif tool_name == "mark_lead_lost":
        lead = session.get(Lead, tool_input["lead_id"])
        if not lead:
            return {"error": "线索不存在"}
        lead.stage = "lost"
        from datetime import datetime
        lead.lost_at = datetime.utcnow()
        session.add(lead)
        session.commit()
        return {"ok": True}

    elif tool_name == "convert_lead":
        convert_lead(session, actor_id, tool_input["lead_id"])
        return {"ok": True}

    elif tool_name == "list_customers":
        stmt = select(Customer)
        limit = tool_input.get("limit", 20)
        customers = session.exec(stmt.limit(limit)).all()
        return [{"id": c.id, "company_name": c.company_name, "owner_id": c.owner_id} for c in customers]

    elif tool_name == "get_customer":
        c = session.get(Customer, tool_input["customer_id"])
        if not c:
            return {"error": "客户不存在"}
        return {"id": c.id, "company_name": c.company_name, "owner_id": c.owner_id, "created_at": c.created_at}

    elif tool_name == "log_followup":
        from app.models.followup import FollowUp
        from datetime import datetime
        entity_type = tool_input["entity_type"]
        entity_id = tool_input["entity_id"]
        fu = FollowUp(
            id=str(uuid.uuid4()),
            lead_id=entity_id if entity_type == "lead" else None,
            customer_id=entity_id if entity_type == "customer" else None,
            owner_id=actor_id,
            type=tool_input["type"],
            content=tool_input["content"],
            followed_at=datetime.utcnow().isoformat(),
        )
        session.add(fu)
        # Update last_followup_at on lead
        if entity_type == "lead":
            lead = session.get(Lead, entity_id)
            if lead:
                lead.last_followup_at = datetime.utcnow().isoformat()
                session.add(lead)
        session.commit()
        return {"ok": True, "followup_id": fu.id}

    elif tool_name == "list_followups":
        from app.models.followup import FollowUp
        entity_type = tool_input["entity_type"]
        entity_id = tool_input["entity_id"]
        stmt = select(FollowUp)
        if entity_type == "lead":
            stmt = stmt.where(FollowUp.lead_id == entity_id)
        else:
            stmt = stmt.where(FollowUp.customer_id == entity_id)
        fus = session.exec(stmt.order_by(FollowUp.followed_at.desc()).limit(20)).all()  # type: ignore[attr-defined]
        return [{"id": f.id, "type": f.type, "content": f.content, "followed_at": f.followed_at} for f in fus]

    elif tool_name == "record_key_event":
        from app.models.key_event import KeyEvent
        from datetime import datetime
        entity_type = tool_input["entity_type"]
        entity_id = tool_input["entity_id"]
        ke = KeyEvent(
            id=str(uuid.uuid4()),
            lead_id=entity_id if entity_type == "lead" else None,
            customer_id=entity_id if entity_type == "customer" else None,
            type=tool_input["type"],
            payload=json.dumps(tool_input.get("payload", {})),
            created_by=actor_id,
            occurred_at=datetime.utcnow().isoformat(),
        )
        session.add(ke)
        session.commit()
        return {"ok": True, "event_id": ke.id}

    elif tool_name == "list_skills":
        skills = session.exec(select(Skill).where(Skill.is_active == True)).all()  # noqa: E712
        return [{"id": s.id, "name": s.name, "description": s.description} for s in skills]

    elif tool_name == "get_my_stats":
        from datetime import datetime, date
        today = date.today().isoformat()
        from app.models.followup import FollowUp
        fus = session.exec(
            select(FollowUp).where(
                FollowUp.owner_id == actor_id,
                FollowUp.followed_at >= today,
            )
        ).all()
        return {"today_followups": len(fus)}

    elif tool_name == "search_knowledge":
        return {"result": f"知识库搜索功能待接入，查询词: {tool_input.get('query')}"}

    return {"error": f"未知工具: {tool_name}"}


# ── Agent loop ────────────────────────────────────────────────────────────────

DEFAULT_SYSTEM = """你是 SFA CRM 系统的 AI 销售助手，帮助销售团队管理线索、客户、跟进记录和日报。
你可以调用工具查询和操作 CRM 数据。请用中文回复，保持专业、简洁。"""


def run_agent(
    session: Session,
    actor_id: str,
    user_message: str,
    session_id: str | None = None,
    system_prompt: str | None = None,
) -> dict:
    """
    Run one turn of the agent loop.
    Returns: {"session_id": str, "response": str, "tool_calls": list}
    """
    config = _get_active_config(session)
    if not config:
        return {"session_id": session_id or str(uuid.uuid4()), "response": "AI 功能未配置，请联系管理员配置 LLM。", "tool_calls": []}

    if not session_id:
        session_id = str(uuid.uuid4())

    system = system_prompt or DEFAULT_SYSTEM
    messages: list[dict] = [{"role": "user", "content": user_message}]

    # Persist user message
    session.add(ConversationMessage(
        session_id=session_id, role="user", content=user_message,
    ))

    tool_calls_made = []
    final_response = ""

    # Agentic loop (max 5 tool rounds)
    for _ in range(5):
        if config.provider == "anthropic":
            llm_resp = _call_anthropic(config, messages, system)
            stop_reason = llm_resp.get("stop_reason")
            content = llm_resp.get("content", [])

            # Collect text
            text_parts = [b["text"] for b in content if b.get("type") == "text"]
            tool_use_blocks = [b for b in content if b.get("type") == "tool_use"]

            if not tool_use_blocks or stop_reason == "end_turn":
                final_response = " ".join(text_parts)
                break

            # Execute tools
            tool_results = []
            for tb in tool_use_blocks:
                tool_name = tb["name"]
                tool_input = tb.get("input", {})
                try:
                    result = _dispatch_tool(tool_name, tool_input, actor_id, session)
                except Exception as e:
                    result = {"error": str(e)}
                tool_calls_made.append({"name": tool_name, "input": tool_input, "result": result})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tb["id"],
                    "content": json.dumps(result, ensure_ascii=False),
                })

            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": tool_results})

        else:
            # OpenAI-compatible
            llm_resp = _call_openai(config, messages, system)
            choice = llm_resp["choices"][0]
            msg = choice["message"]
            finish_reason = choice.get("finish_reason")

            if finish_reason != "tool_calls" or not msg.get("tool_calls"):
                final_response = msg.get("content") or ""
                break

            messages.append(msg)
            tool_msgs = []
            for tc in msg["tool_calls"]:
                tool_name = tc["function"]["name"]
                tool_input = json.loads(tc["function"]["arguments"])
                try:
                    result = _dispatch_tool(tool_name, tool_input, actor_id, session)
                except Exception as e:
                    result = {"error": str(e)}
                tool_calls_made.append({"name": tool_name, "input": tool_input, "result": result})
                tool_msgs.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result, ensure_ascii=False),
                })
            messages.extend(tool_msgs)

    # Persist assistant response
    session.add(ConversationMessage(
        session_id=session_id, role="assistant", content=final_response,
        tool_input=json.dumps(tool_calls_made) if tool_calls_made else None,
    ))
    session.commit()

    return {
        "session_id": session_id,
        "response": final_response or "（无回复）",
        "tool_calls": tool_calls_made,
    }
