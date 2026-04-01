"""Key Event API endpoints."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import get_client_ip, require_permission
from app.models.key_event import KeyEvent
from app.models.org import User
from app.services.audit_service import write_audit_log

router = APIRouter()


class KeyEventCreate(BaseModel):
    type: str
    occurred_at: str
    payload: dict = {}


class KeyEventUpdate(BaseModel):
    payload: dict


class KeyEventResponse(BaseModel):
    id: str
    lead_id: Optional[str]
    customer_id: Optional[str]
    type: str
    payload: dict
    created_by: str
    occurred_at: str
    created_at: str


class KeyEventListResponse(BaseModel):
    total: int
    items: list[KeyEventResponse]


def _ke_to_response(ke: KeyEvent) -> KeyEventResponse:
    return KeyEventResponse(
        id=ke.id,
        lead_id=ke.lead_id,
        customer_id=ke.customer_id,
        type=ke.type,
        payload=json.loads(ke.payload) if isinstance(ke.payload, str) else ke.payload,
        created_by=ke.created_by,
        occurred_at=ke.occurred_at,
        created_at=ke.created_at,
    )


@router.post("/leads/{lead_id}/key-events", response_model=KeyEventResponse)
def create_lead_key_event(
    lead_id: str,
    body: KeyEventCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("keyevent.create")),
):
    ke = KeyEvent(
        lead_id=lead_id,
        type=body.type,
        payload=json.dumps(body.payload, ensure_ascii=False),
        created_by=current_user.id,
        occurred_at=body.occurred_at,
    )
    session.add(ke)
    write_audit_log(
        session, user_id=current_user.id, action=f"record_{body.type}",
        entity_type="lead", entity_id=lead_id, ip=get_client_ip(request),
    )
    session.commit()
    return _ke_to_response(ke)


@router.post("/customers/{customer_id}/key-events", response_model=KeyEventResponse)
def create_customer_key_event(
    customer_id: str,
    body: KeyEventCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("keyevent.create")),
):
    ke = KeyEvent(
        customer_id=customer_id,
        type=body.type,
        payload=json.dumps(body.payload, ensure_ascii=False),
        created_by=current_user.id,
        occurred_at=body.occurred_at,
    )
    session.add(ke)
    write_audit_log(
        session, user_id=current_user.id, action=f"record_{body.type}",
        entity_type="customer", entity_id=customer_id, ip=get_client_ip(request),
    )
    session.commit()
    return _ke_to_response(ke)


@router.patch("/key-events/{event_id}", response_model=KeyEventResponse)
def update_key_event(
    event_id: str,
    body: KeyEventUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("keyevent.create")),
):
    ke = session.get(KeyEvent, event_id)
    if not ke:
        raise HTTPException(status_code=404, detail="Key event not found")
    ke.payload = json.dumps(body.payload, ensure_ascii=False)
    session.add(ke)
    session.commit()
    return _ke_to_response(ke)


@router.get("/leads/{lead_id}/key-events", response_model=KeyEventListResponse)
def list_lead_key_events(
    lead_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("keyevent.view")),
):
    stmt = select(KeyEvent).where(KeyEvent.lead_id == lead_id)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(KeyEvent.occurred_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return KeyEventListResponse(total=total, items=[_ke_to_response(ke) for ke in items])


@router.get("/customers/{customer_id}/key-events", response_model=KeyEventListResponse)
def list_customer_key_events(
    customer_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("keyevent.view")),
):
    stmt = select(KeyEvent).where(KeyEvent.customer_id == customer_id)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(KeyEvent.occurred_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return KeyEventListResponse(total=total, items=[_ke_to_response(ke) for ke in items])
