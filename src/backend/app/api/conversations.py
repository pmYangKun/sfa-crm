"""Conversation API endpoints（spec 003 T030 — US2）."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.org import User
from app.services.meddicc_extractor import analyze
from app.services.rate_limiter import limiter

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────


class ConversationCreate(BaseModel):
    recorded_at: str
    content: str = Field(..., min_length=1, max_length=50000)


class ConversationOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    lead_id: str
    recorded_at: str
    content: str
    source: str
    scenario_card_id: Optional[str]
    created_by: str
    created_at: str


class ConversationListResponse(BaseModel):
    lead_id: str
    count: int
    conversations: list[ConversationOut]


# 延迟 import 避免 schema 循环依赖
def _lazy_dashboard(lead_id: str, db: Session):
    from app.api.meddicc import _build_dashboard, DashboardData
    return _build_dashboard(lead_id, db)


class ConversationCreateResponse(BaseModel):
    conversation: ConversationOut
    # dashboard 字段在路由中动态填充（避免循环 import）
    dashboard: dict


class ConversationDeleteResponse(BaseModel):
    deleted: bool
    lead_id: str
    dashboard: dict


# ── Endpoints ──────────────────────────────────────────────────────


@router.get("/leads/{lead_id}/conversations", response_model=ConversationListResponse)
def list_conversations(
    lead_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    if not session.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="线索不存在")

    convs = session.exec(
        select(Conversation)
        .where(Conversation.lead_id == lead_id)
        .order_by(Conversation.recorded_at.desc())  # type: ignore
    ).all()
    return ConversationListResponse(
        lead_id=lead_id,
        count=len(convs),
        conversations=[ConversationOut.model_validate(c) for c in convs],
    )


@router.post("/leads/{lead_id}/conversations")
@limiter.limit("10/minute;100/day")
def create_conversation(
    lead_id: str,
    body: ConversationCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.create")),
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    # 校验 recorded_at 不能在未来（容错 5 分钟时钟偏差）
    try:
        rec_dt = datetime.fromisoformat(body.recorded_at.replace("Z", "+00:00"))
        if rec_dt.tzinfo is None:
            rec_dt = rec_dt.replace(tzinfo=timezone.utc)
        from datetime import timedelta
        if rec_dt > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise HTTPException(status_code=400, detail="对话时间不能在未来")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="对话时间格式错误")

    conv = Conversation(
        lead_id=lead_id,
        recorded_at=body.recorded_at,
        content=body.content,
        source="manual",
        scenario_card_id=None,
        created_by=current_user.id,
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)

    # 同步触发 analyze
    try:
        analyze(lead_id, session, current_user_id=current_user.id)
    except Exception as e:
        # 即使 analyze 失败，conversation 已存，前端能看到对话；下一次手动重新分析即可
        import logging
        logging.getLogger(__name__).warning("analyze 失败但保留对话: %s", e)

    return {
        "conversation": ConversationOut.model_validate(conv).model_dump(),
        "dashboard": _lazy_dashboard(lead_id, session).model_dump(),
    }


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.create")),
):
    conv = session.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    lead_id = conv.lead_id
    session.delete(conv)
    session.commit()

    # 同步触发 analyze 重算
    try:
        analyze(lead_id, session, current_user_id=current_user.id)
    except Exception:
        # 重算失败不阻塞删除
        from app.services.score_calculator import recompute
        recompute(lead_id, session, mark_analyzed=True)
        session.commit()

    return {
        "deleted": True,
        "lead_id": lead_id,
        "dashboard": _lazy_dashboard(lead_id, session).model_dump(),
    }
