"""
KeyEvent API endpoints.

POST /leads/{id}/key-events         — record a key event on a lead
POST /customers/{id}/key-events     — record a key event on a customer
PATCH /key-events/{id}              — update mutable payload fields (e.g. confirm book read)
"""
import json
from datetime import datetime
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.customer import Customer
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.org import User
from app.services.lead_service import (
    confirm_small_course,
    record_big_course,
    record_book_sent,
)
from app.services.permission_service import get_visible_user_ids

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]

KeyEventType = Literal[
    "visited_kp",
    "book_sent",
    "attended_small_course",
    "purchased_big_course",
    "contact_relation_discovered",
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class KeyEventCreate(BaseModel):
    type: KeyEventType
    occurred_at: datetime
    # Type-specific fields (all optional; validation is at the Action layer)
    sent_at: Optional[datetime] = None          # book_sent
    course_name: Optional[str] = None           # attended_small_course
    contract_amount: Optional[float] = None     # purchased_big_course


class KeyEventResponse(BaseModel):
    id: str
    lead_id: Optional[str]
    customer_id: Optional[str]
    type: str
    payload: str
    created_by: str
    occurred_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class KeyEventPatch(BaseModel):
    payload_updates: dict[str, Any]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dispatch_key_event(
    session: Session,
    actor_id: str,
    body: KeyEventCreate,
    lead_id: str | None,
    customer_id: str | None,
) -> KeyEvent:
    """Route to the appropriate Action based on event type."""
    from app.services.lead_service import _record_key_event

    if body.type == "book_sent":
        return record_book_sent(
            session, actor_id,
            lead_id=lead_id,
            customer_id=customer_id,
            sent_at=body.sent_at or body.occurred_at,
        )
    elif body.type == "attended_small_course":
        return confirm_small_course(
            session, actor_id,
            lead_id=lead_id,
            customer_id=customer_id,
            attended_at=body.occurred_at,
            course_name=body.course_name,
        )
    elif body.type == "purchased_big_course":
        if body.contract_amount is None:
            raise ValueError("purchased_big_course 需要 contract_amount 字段")
        return record_big_course(
            session, actor_id,
            lead_id=lead_id,
            customer_id=customer_id,
            purchase_date=body.occurred_at,
            contract_amount=body.contract_amount,
        )
    else:
        # Generic event (visited_kp, contact_relation_discovered)
        return _record_key_event(
            session, actor_id,
            lead_id=lead_id,
            customer_id=customer_id,
            event_type=body.type,
            payload={},
            occurred_at=body.occurred_at,
        )


# ── POST /leads/{id}/key-events ───────────────────────────────────────────────

@router.post(
    "/leads/{lead_id}/key-events",
    response_model=KeyEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_lead_key_event(
    lead_id: str,
    body: KeyEventCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("key_event:create"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    try:
        return _dispatch_key_event(session, current_user.id, body, lead_id=lead_id, customer_id=None)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── POST /customers/{id}/key-events ──────────────────────────────────────────

@router.post(
    "/customers/{customer_id}/key-events",
    response_model=KeyEventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer_key_event(
    customer_id: str,
    body: KeyEventCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("key_event:create"))],
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    try:
        return _dispatch_key_event(session, current_user.id, body, lead_id=None, customer_id=customer_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── PATCH /key-events/{id} (T064) ─────────────────────────────────────────────

@router.patch("/key-events/{event_id}", response_model=KeyEventResponse)
def patch_key_event(
    event_id: str,
    body: KeyEventPatch,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("key_event:create"))],
):
    """
    Merge payload_updates into the event's existing payload.
    Used for post-recording updates: confirming book read, adding notes, etc.
    """
    event = session.get(KeyEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="关键事件不存在")

    existing_payload = json.loads(event.payload)
    existing_payload.update(body.payload_updates)
    event.payload = json.dumps(existing_payload, ensure_ascii=False)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event
