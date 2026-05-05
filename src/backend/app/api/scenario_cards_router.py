"""Scenario card API endpoints（spec 003 T019）."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.lead import Lead
from app.models.org import User
from app.services.meddicc_extractor import analyze
from app.services.rate_limiter import limiter
from app.services.scenario_cards import (
    SCENARIO_CARDS,
    apply_card,
    get_card,
    list_cards_for_lead,
)

router = APIRouter()


class ScenarioCardOut(BaseModel):
    id: str
    title: str
    description: str
    applies_to_lead_company: str
    applied: bool
    conversation_count: int


class ScenarioCardListResponse(BaseModel):
    lead_id: str
    lead_company: str
    cards: list[ScenarioCardOut]


@router.get("/leads/{lead_id}/scenario-cards", response_model=ScenarioCardListResponse)
def list_scenario_cards(
    lead_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")
    cards = list_cards_for_lead(lead, session)
    return ScenarioCardListResponse(
        lead_id=lead_id,
        lead_company=lead.company_name,
        cards=[ScenarioCardOut(**c) for c in cards],
    )


@router.post("/leads/{lead_id}/scenario-cards/{card_id}/apply")
@limiter.limit("10/minute;100/day")
def apply_scenario_card(
    lead_id: str,
    card_id: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.create")),
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    card = get_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="场景卡不存在")

    if card["applies_to_lead_company"] != lead.company_name:
        raise HTTPException(status_code=400, detail="该卡不适用于此线索")

    # 检查是否已应用过
    cards_status = list_cards_for_lead(lead, session)
    target = next((c for c in cards_status if c["id"] == card_id), None)
    if target and target["applied"]:
        raise HTTPException(status_code=400, detail="该卡已应用过，无需重复")

    inserted_ids = apply_card(card_id, lead, current_user.id, session)
    session.commit()

    # 同步触发 analyze
    try:
        analyze(lead_id, session, current_user_id=current_user.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("analyze 失败但保留场景卡数据: %s", e)
        # fallback recompute（用现有数据先把 score 拍出来）
        from app.services.score_calculator import recompute
        recompute(lead_id, session, mark_analyzed=True)
        session.commit()

    from app.api.meddicc import _build_dashboard
    dashboard = _build_dashboard(lead_id, session)

    from datetime import datetime, timezone
    return {
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "card_id": card_id,
        "inserted_conversation_ids": inserted_ids,
        "dashboard": dashboard.model_dump(),
    }
