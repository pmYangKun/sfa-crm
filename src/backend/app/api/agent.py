"""AI Agent API endpoints."""

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_client_ip, require_permission
from app.models.config import SystemConfig
from app.models.llm_config import LLMConfig, Skill
from app.models.org import User
from app.services import prompt_guard
from app.services.agent_service import (
    TOOL_DEFINITIONS,
    execute_tool,
    get_active_llm_config,
    get_active_skills,
    get_conversation_history,
    save_message,
)
from app.services.audit_service import write_audit_log
from app.services.chat_audit_writer import write_audit
from app.services.llm_circuit_breaker import check_circuit_open, increment_counter
from app.services.rate_limiter import limiter

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., max_length=2000)  # spec 002 FR-001


class LLMConfigRequest(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None


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
    """Full LLM config including API key + system prompt — called server-side only by Next.js API Route."""
    config = get_active_llm_config(session)
    if not config:
        return {"configured": False}
    # Read system prompt from config
    prompt_cfg = session.get(SystemConfig, "agent_system_prompt")
    system_prompt = prompt_cfg.value if prompt_cfg else ""
    return {
        "configured": True,
        "provider": config.provider,
        "model": config.model,
        "api_key": config.api_key,
        "system_prompt": system_prompt,
    }


@router.post("/agent/llm-config")
def save_llm_config(
    body: LLMConfigRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.manage")),
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

    # Update system prompt if provided
    if body.system_prompt is not None:
        prompt_cfg = session.get(SystemConfig, "agent_system_prompt")
        if prompt_cfg:
            prompt_cfg.value = body.system_prompt
            session.add(prompt_cfg)

    session.commit()
    return {"success": True}


@router.post("/agent/skills")
def create_skill(
    body: SkillCreateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.manage")),
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
@limiter.limit("10/minute")  # spec 002 FR-007
@limiter.limit("100/day")  # spec 002 FR-007
def chat(
    body: ChatRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("agent.chat")),
):
    session_id = body.session_id or str(uuid.uuid4())
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent")

    # ── Gate 1: Prompt Guard 黑名单（spec 002 FR-002）─────────────────────
    guard = prompt_guard.check(session, body.message)
    if guard.blocked:
        write_audit(
            session, user_id=current_user.id, ip=client_ip, user_agent=user_agent,
            input_text=body.message, output_text=guard.fixed_response,
            blocked_by="prompt_guard",
        )
        save_message(session, session_id, current_user.id, "user", body.message)
        save_message(session, session_id, current_user.id, "assistant", guard.fixed_response)
        session.commit()
        return {
            "session_id": session_id,
            "response": guard.fixed_response,
            "tool_calls": [],
            "blocked_by": "prompt_guard",
        }

    # ── Gate 2: 全站 LLM 熔断（spec 002 FR-009）────────────────────────────
    circuit = check_circuit_open(session)
    if circuit.open:
        write_audit(
            session, user_id=current_user.id, ip=client_ip, user_agent=user_agent,
            input_text=body.message,
            output_text="演示站当前调用量较高，请稍后再试",
            blocked_by="llm_circuit_breaker",
        )
        session.commit()
        return JSONResponse(
            status_code=503,
            content={
                "code": "LLM_CIRCUIT_BREAKER_OPEN",
                "message": "演示站当前调用量较高，请稍后再试",
                "retry_after_seconds": circuit.retry_after_seconds,
            },
            headers={"Retry-After": str(circuit.retry_after_seconds)},
        )

    # Save user message
    save_message(session, session_id, current_user.id, "user", body.message)

    # Get conversation history
    history = get_conversation_history(session, session_id)

    # Get LLM config
    llm_config = get_active_llm_config(session)

    if not llm_config:
        not_configured_msg = "AI 助手尚未配置，请联系管理员在系统配置中添加 LLM 配置。"
        save_message(session, session_id, current_user.id, "assistant", not_configured_msg)
        write_audit(
            session, user_id=current_user.id, ip=client_ip, user_agent=user_agent,
            input_text=body.message, output_text=not_configured_msg, blocked_by=None,
        )
        session.commit()
        return {
            "session_id": session_id,
            "response": not_configured_msg,
            "tool_calls": [],
        }

    # Placeholder LLM response（真实 LLM 调用在前端 /api/chat/route.ts 或 spec 002 Phase 6 后端代理）
    response_text = f"收到您的消息：「{body.message}」。AI Agent 功能已就绪，需要在系统配置中配置 LLM API Key 后才能正常工作。"

    save_message(session, session_id, current_user.id, "assistant", response_text)

    # spec 002: chat_audit + 全站 LLM 计数器累加（成功路径）
    write_audit(
        session, user_id=current_user.id, ip=client_ip, user_agent=user_agent,
        input_text=body.message, output_text=response_text, blocked_by=None,
    )
    increment_counter(session)

    write_audit_log(
        session, user_id=current_user.id, action="agent_chat",
        payload={"session_id": session_id, "message_preview": body.message[:100]},
        ip=client_ip,
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
