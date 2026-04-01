"""AI Agent API endpoints."""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_client_ip, require_permission
from app.models.llm_config import LLMConfig, Skill
from app.models.org import User
from app.services.agent_service import (
    TOOL_DEFINITIONS,
    execute_tool,
    get_active_llm_config,
    get_active_skills,
    get_conversation_history,
    save_message,
)
from app.services.audit_service import write_audit_log

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class LLMConfigRequest(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None


class SkillCreateRequest(BaseModel):
    name: str
    trigger: str
    content: str
    category: Optional[str] = None


@router.get("/agent/llm-config")
def get_llm_config(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    config = get_active_llm_config(session)
    if not config:
        return {"configured": False}
    return {
        "configured": True,
        "provider": config.provider,
        "model": config.model,
        # Don't expose API key to frontend
    }


@router.get("/agent/llm-config/full")
def get_llm_config_full(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    """Full LLM config including API key — called server-side only by Next.js API Route."""
    config = get_active_llm_config(session)
    if not config:
        return {"configured": False}
    return {
        "configured": True,
        "provider": config.provider,
        "model": config.model,
        "api_key": config.api_key,
    }


@router.post("/agent/llm-config")
def save_llm_config(
    body: LLMConfigRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.update")),
):
    """Create or update LLM config. Deactivates existing configs and creates a new active one."""
    # Deactivate all existing configs
    existing = session.exec(select(LLMConfig)).all()
    for c in existing:
        c.is_active = False
        session.add(c)

    # Create new active config
    new_config = LLMConfig(
        provider=body.provider,
        model=body.model,
        api_key=body.api_key or (existing[0].api_key if existing else ""),
    )
    new_config.is_active = True
    session.add(new_config)
    session.commit()
    return {"success": True}


@router.post("/agent/skills")
def create_skill(
    body: SkillCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.update")),
):
    skill = Skill(
        name=body.name,
        trigger=body.trigger,
        content=body.content,
        category=body.category,
    )
    session.add(skill)
    session.commit()
    return {"id": skill.id, "name": skill.name}


@router.get("/agent/skills")
def list_skills(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    skills = get_active_skills(session)
    return [
        {"id": s.id, "name": s.name, "trigger": s.trigger, "category": s.category}
        for s in skills
    ]


@router.get("/agent/tools")
def list_tools(
    current_user: User = Depends(require_permission("agent.chat")),
):
    return TOOL_DEFINITIONS


@router.post("/agent/chat")
def chat(
    body: ChatRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    session_id = body.session_id or str(uuid.uuid4())

    # Save user message
    save_message(session, session_id, current_user.id, "user", body.message)

    # Get conversation history
    history = get_conversation_history(session, session_id)

    # Get LLM config
    llm_config = get_active_llm_config(session)

    if not llm_config:
        save_message(session, session_id, current_user.id, "assistant", "AI 助手尚未配置，请联系管理员在系统配置中添加 LLM 配置。")
        session.commit()
        return {
            "session_id": session_id,
            "response": "AI 助手尚未配置，请联系管理员在系统配置中添加 LLM 配置。",
            "tool_calls": [],
        }

    # For now, return a placeholder response
    # Real implementation would call LLM API via httpx
    response_text = f"收到您的消息：「{body.message}」。AI Agent 功能已就绪，需要在系统配置中配置 LLM API Key 后才能正常工作。"

    save_message(session, session_id, current_user.id, "assistant", response_text)

    write_audit_log(
        session, user_id=current_user.id, action="agent_chat",
        payload={"session_id": session_id, "message_preview": body.message[:100]},
        ip=get_client_ip(request),
    )
    session.commit()

    return {
        "session_id": session_id,
        "response": response_text,
        "tool_calls": [],
    }


@router.post("/agent/execute-tool")
def execute_tool_endpoint(
    request: Request,
    tool_name: str,
    body: dict,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    result = execute_tool(session, tool_name, body, current_user.id)
    session.commit()
    return result
