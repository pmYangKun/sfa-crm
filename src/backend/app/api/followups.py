"""
FollowUp API endpoints.

POST /leads/{id}/followups        — log followup on a lead
POST /customers/{id}/followups    — log followup on a customer
GET  /leads/{id}/followups        — list followups for a lead
GET  /customers/{id}/followups    — list followups for a customer
"""
from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.lead import Lead
from app.models.org import User
from app.services.lead_service import log_followup
from app.services.permission_service import get_visible_user_ids

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class FollowUpCreate(BaseModel):
    type: Literal["phone", "wechat", "visit", "other"]
    content: str
    followed_at: datetime
    contact_id: Optional[str] = None


class FollowUpResponse(BaseModel):
    id: str
    lead_id: Optional[str]
    customer_id: Optional[str]
    contact_id: Optional[str]
    owner_id: str
    type: str
    source: str
    content: str
    followed_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ── POST /leads/{id}/followups ────────────────────────────────────────────────

@router.post(
    "/leads/{lead_id}/followups",
    response_model=FollowUpResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_lead_followup(
    lead_id: str,
    body: FollowUpCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("followup:create"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    return log_followup(
        session,
        current_user.id,
        lead_id=lead_id,
        contact_id=body.contact_id,
        followup_type=body.type,
        content=body.content,
        followed_at=body.followed_at,
    )


# ── POST /customers/{id}/followups ────────────────────────────────────────────

@router.post(
    "/customers/{customer_id}/followups",
    response_model=FollowUpResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer_followup(
    customer_id: str,
    body: FollowUpCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("followup:create"))],
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    return log_followup(
        session,
        current_user.id,
        customer_id=customer_id,
        contact_id=body.contact_id,
        followup_type=body.type,
        content=body.content,
        followed_at=body.followed_at,
    )


# ── GET /leads/{id}/followups (T061) ─────────────────────────────────────────

@router.get("/leads/{lead_id}/followups", response_model=list[FollowUpResponse])
def list_lead_followups(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("followup:view"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权访问")

    return session.exec(
        select(FollowUp)
        .where(FollowUp.lead_id == lead_id)
        .order_by(FollowUp.followed_at.desc())  # type: ignore[attr-defined]
    ).all()


# ── GET /customers/{id}/followups (T061) ─────────────────────────────────────

@router.get("/customers/{customer_id}/followups", response_model=list[FollowUpResponse])
def list_customer_followups(
    customer_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("followup:view"))],
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权访问")

    return session.exec(
        select(FollowUp)
        .where(FollowUp.customer_id == customer_id)
        .order_by(FollowUp.followed_at.desc())  # type: ignore[attr-defined]
    ).all()
