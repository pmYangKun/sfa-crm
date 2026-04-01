"""Follow-up API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import get_client_ip, require_permission
from app.models.followup import FollowUp
from app.models.org import User
from app.services.lead_service import log_followup

router = APIRouter()


class FollowUpCreate(BaseModel):
    type: str
    content: str
    followed_at: str
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
    followed_at: str
    created_at: str


class FollowUpListResponse(BaseModel):
    total: int
    items: list[FollowUpResponse]


@router.post("/leads/{lead_id}/followups", response_model=FollowUpResponse)
def create_lead_followup(
    lead_id: str,
    body: FollowUpCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.create")),
):
    fu = log_followup(
        session, current_user.id,
        lead_id=lead_id,
        contact_id=body.contact_id,
        followup_type=body.type,
        content=body.content,
        followed_at=body.followed_at,
        ip=get_client_ip(request),
    )
    session.commit()
    return fu


@router.post("/customers/{customer_id}/followups", response_model=FollowUpResponse)
def create_customer_followup(
    customer_id: str,
    body: FollowUpCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.create")),
):
    fu = log_followup(
        session, current_user.id,
        customer_id=customer_id,
        contact_id=body.contact_id,
        followup_type=body.type,
        content=body.content,
        followed_at=body.followed_at,
        ip=get_client_ip(request),
    )
    session.commit()
    return fu


@router.get("/leads/{lead_id}/followups", response_model=FollowUpListResponse)
def list_lead_followups(
    lead_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.view")),
):
    stmt = select(FollowUp).where(FollowUp.lead_id == lead_id)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(FollowUp.followed_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return FollowUpListResponse(total=total, items=items)


@router.get("/customers/{customer_id}/followups", response_model=FollowUpListResponse)
def list_customer_followups(
    customer_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("followup.view")),
):
    stmt = select(FollowUp).where(FollowUp.customer_id == customer_id)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(FollowUp.followed_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return FollowUpListResponse(total=total, items=items)
