"""
Agent API (T097, T100).

GET  /agent/llm-config            — get active LLM config (admin)
GET  /agent/llm-configs           — list all LLM configs
POST /agent/llm-configs           — create LLM config
PATCH /agent/llm-configs/{id}     — update LLM config
DELETE /agent/llm-configs/{id}    — delete LLM config
POST /agent/llm-configs/{id}/activate — set as active config

GET  /agent/skills                — list skills
POST /agent/skills                — create skill
PATCH /agent/skills/{id}          — update skill
DELETE /agent/skills/{id}         — delete skill

POST /agent/chat                  — single-turn chat (T100)
"""
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.audit import AuditLog
from app.models.llm_config import LLMConfig, Skill
from app.models.org import User
from app.services.agent_service import run_agent
from app.tools import ALL_TOOLS

router = APIRouter(prefix="/agent", tags=["agent"])
SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class LLMConfigCreate(BaseModel):
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None


class LLMConfigResponse(BaseModel):
    id: str
    provider: str
    model_name: str
    base_url: Optional[str]
    is_active: bool
    created_at: str


class SkillCreate(BaseModel):
    name: str
    description: str
    system_prompt: Optional[str] = None


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: Optional[str]
    is_active: bool
    created_at: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    skill_id: Optional[str] = None  # optional: use a specific Skill's system prompt


class ChatResponse(BaseModel):
    session_id: str
    response: str
    tool_calls: list


# ── LLM Config endpoints ──────────────────────────────────────────────────────

@router.get("/llm-configs", response_model=list[LLMConfigResponse])
def list_llm_configs(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    configs = session.exec(select(LLMConfig)).all()
    return [LLMConfigResponse(
        id=c.id, provider=c.provider, model_name=c.model_name,
        base_url=c.base_url, is_active=c.is_active, created_at=c.created_at,
    ) for c in configs]


@router.get("/llm-config", response_model=Optional[LLMConfigResponse])
def get_active_llm_config(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    config = session.exec(select(LLMConfig).where(LLMConfig.is_active == True)).first()  # noqa: E712
    if not config:
        return None
    return LLMConfigResponse(
        id=config.id, provider=config.provider, model_name=config.model_name,
        base_url=config.base_url, is_active=config.is_active, created_at=config.created_at,
    )


@router.post("/llm-configs", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED)
def create_llm_config(
    body: LLMConfigCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    config = LLMConfig(
        id=str(uuid.uuid4()),
        provider=body.provider,
        model_name=body.model_name,
        api_key=body.api_key,
        base_url=body.base_url,
    )
    session.add(config)
    session.commit()
    session.refresh(config)
    return LLMConfigResponse(
        id=config.id, provider=config.provider, model_name=config.model_name,
        base_url=config.base_url, is_active=config.is_active, created_at=config.created_at,
    )


@router.post("/llm-configs/{config_id}/activate", response_model=LLMConfigResponse)
def activate_llm_config(
    config_id: str,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    # Deactivate all
    for c in session.exec(select(LLMConfig)).all():
        c.is_active = False
        session.add(c)
    config = session.get(LLMConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    config.is_active = True
    session.add(config)
    session.commit()
    session.refresh(config)
    return LLMConfigResponse(
        id=config.id, provider=config.provider, model_name=config.model_name,
        base_url=config.base_url, is_active=config.is_active, created_at=config.created_at,
    )


@router.delete("/llm-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_llm_config(
    config_id: str,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    config = session.get(LLMConfig, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    session.delete(config)
    session.commit()


# ── Skill endpoints ───────────────────────────────────────────────────────────

@router.get("/skills", response_model=list[SkillResponse])
def list_skills(
    session: SessionDep,
    _: Annotated[None, Depends(get_current_user)],
):
    return session.exec(select(Skill)).all()


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(
    body: SkillCreate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    skill = Skill(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        system_prompt=body.system_prompt,
    )
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: str,
    body: SkillUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    skill = session.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill 不存在")
    if body.name is not None:
        skill.name = body.name
    if body.description is not None:
        skill.description = body.description
    if body.system_prompt is not None:
        skill.system_prompt = body.system_prompt
    if body.is_active is not None:
        skill.is_active = body.is_active
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(
    skill_id: str,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    skill = session.get(Skill, skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill 不存在")
    session.delete(skill)
    session.commit()


# ── GET /agent/chat-config (server-side Next.js reads this to instantiate provider) ──

class ChatConfigResponse(BaseModel):
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str]


@router.get("/chat-config", response_model=Optional[ChatConfigResponse])
def get_chat_config(
    session: SessionDep,
    _: Annotated[None, Depends(get_current_user)],
):
    """Returns full LLM config (including api_key) for use by the Next.js server-side route."""
    config = session.exec(select(LLMConfig).where(LLMConfig.is_active == True)).first()  # noqa: E712
    if not config:
        return None
    return ChatConfigResponse(
        provider=config.provider,
        model_name=config.model_name,
        api_key=config.api_key,
        base_url=config.base_url,
    )


# ── GET /agent/tools (for frontend to know what tools exist) ──────────────────

@router.get("/tools")
def list_tools(
    _: Annotated[None, Depends(get_current_user)],
):
    return [{"name": t["name"], "description": t["description"]} for t in ALL_TOOLS]


# ── POST /agent/chat (T100) ───────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def agent_chat(
    body: ChatRequest,
    request: Request,
    session: SessionDep,
    actor: CurrentUser,
):
    # Load skill system prompt if requested
    system_prompt = None
    if body.skill_id:
        skill = session.get(Skill, body.skill_id)
        if skill and skill.system_prompt:
            system_prompt = skill.system_prompt

    result = run_agent(
        session=session,
        actor_id=actor.id,
        user_message=body.message,
        session_id=body.session_id,
        system_prompt=system_prompt,
    )

    # Audit log
    import json
    session.add(AuditLog(
        user_id=actor.id,
        action="agent_chat",
        entity_type="conversation",
        entity_id=result["session_id"],
        payload=json.dumps({"message_preview": body.message[:100]}, ensure_ascii=False),
        ip=request.client.host if request.client else None,
    ))
    session.commit()

    return ChatResponse(**result)
