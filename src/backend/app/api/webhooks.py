"""
Webhook endpoints for external system integrations.

POST /webhooks/order-payment
  Receives payment events from the course-order system.
  Matches the payer to an active Lead and triggers conversion.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, or_, select

from app.core.database import get_session
from app.models.customer import Customer
from app.models.lead import Lead
from app.services.lead_service import convert_lead

router = APIRouter()

SessionDep = Session


# ── Schema ────────────────────────────────────────────────────────────────────

class OrderPaymentEvent(BaseModel):
    order_id: str
    company_name: str
    unified_code: Optional[str] = None
    amount: float
    payment_at: str  # ISO 8601 string


class ConvertResult(BaseModel):
    customer_id: str
    lead_id: str
    company_name: str
    message: str


# ── POST /webhooks/order-payment ──────────────────────────────────────────────

@router.post(
    "/order-payment",
    response_model=ConvertResult,
    status_code=status.HTTP_200_OK,
)
def order_payment_webhook(
    event: OrderPaymentEvent,
    session: Session = Depends(get_session),
):
    """
    Match the paying company to an active Lead and convert it.

    Matching priority:
    1. Exact unified_code match (most reliable)
    2. Exact company_name match among active leads
    """
    lead = _find_lead(session, event)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到匹配的活跃线索（company_name={event.company_name}）",
        )

    # Idempotency: if already converted, return existing customer
    existing = session.exec(
        select(Customer).where(Customer.lead_id == lead.id)
    ).first()
    if existing:
        return ConvertResult(
            customer_id=existing.id,
            lead_id=lead.id,
            company_name=lead.company_name,
            message="已转化（幂等返回）",
        )

    if not lead.owner_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="线索暂无归属人，无法自动转化，请手动处理",
        )

    customer = convert_lead(session, "webhook:order-payment", lead.id)
    return ConvertResult(
        customer_id=customer.id,
        lead_id=lead.id,
        company_name=customer.company_name,
        message="转化成功",
    )


def _find_lead(session: Session, event: OrderPaymentEvent) -> Lead | None:
    # 1. Unified code exact match
    if event.unified_code:
        lead = session.exec(
            select(Lead).where(
                Lead.unified_code == event.unified_code,
                Lead.stage == "active",
            )
        ).first()
        if lead:
            return lead

    # 2. Company name exact match
    return session.exec(
        select(Lead).where(
            Lead.company_name == event.company_name,
            Lead.stage == "active",
        )
    ).first()
