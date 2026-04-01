"""Webhook endpoints for external system callbacks."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.config import settings
from app.core.database import get_session
from app.models.lead import Lead
from app.services.lead_service import convert_lead

router = APIRouter()


class OrderPaymentEvent(BaseModel):
    event: str
    order_type: str
    company_name: str
    unified_code: str | None = None
    amount: float
    paid_at: str


@router.post("/webhooks/order-payment")
def handle_order_payment(
    body: OrderPaymentEvent,
    request: Request,
    session: Session = Depends(get_session),
):
    # Verify webhook secret
    secret = request.headers.get("X-Webhook-Secret")
    if secret != settings.WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    # Match lead by unified_code or company_name
    lead = None
    if body.unified_code:
        lead = session.exec(
            select(Lead).where(Lead.unified_code == body.unified_code, Lead.stage == "active")
        ).first()

    if not lead:
        leads = session.exec(
            select(Lead).where(Lead.company_name == body.company_name, Lead.stage == "active")
        ).all()
        if len(leads) == 1:
            lead = leads[0]
        elif len(leads) > 1:
            return {"status": "ambiguous", "message": "多个匹配线索，请手动处理", "matched_count": len(leads)}
        else:
            return {"status": "not_found", "message": "未找到匹配线索"}

    # Convert lead
    _, customer = convert_lead(session, lead.owner_id or "system", lead.id)
    session.commit()
    return {"status": "converted", "customer_id": customer.id}
