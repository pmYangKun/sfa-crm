"""
Contact API endpoints.

POST /leads/{id}/contacts          — add contact to a lead
POST /customers/{id}/contacts      — add contact to a customer
POST /contacts/link                — manually link two contacts (relationship)
GET  /leads/{id}/contacts          — list contacts for a lead
GET  /customers/{id}/contacts      — list contacts for a customer
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.contact import Contact, ContactRelation
from app.models.customer import Customer
from app.models.lead import Lead
from app.models.org import User
from app.services.lead_service import add_contact, link_contacts
from app.services.permission_service import get_visible_user_ids

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    role: Optional[str] = None
    is_key_decision_maker: bool = False
    wechat_id: Optional[str] = None
    phone: Optional[str] = None


class ContactResponse(BaseModel):
    id: str
    lead_id: Optional[str]
    customer_id: Optional[str]
    name: str
    role: Optional[str]
    is_key_decision_maker: bool
    wechat_id: Optional[str]
    phone: Optional[str]

    model_config = {"from_attributes": True}


class LinkContactsRequest(BaseModel):
    contact_a_id: str
    contact_b_id: str
    note: Optional[str] = None


class ContactRelationResponse(BaseModel):
    id: str
    contact_a_id: str
    contact_b_id: str
    relation_type: str
    note: Optional[str]

    model_config = {"from_attributes": True}


# ── POST /leads/{id}/contacts ─────────────────────────────────────────────────

@router.post(
    "/leads/{lead_id}/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_lead_contact(
    lead_id: str,
    body: ContactCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:view"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    return add_contact(
        session, current_user.id,
        lead_id=lead_id,
        name=body.name,
        role=body.role,
        is_key_decision_maker=body.is_key_decision_maker,
        wechat_id=body.wechat_id,
        phone=body.phone,
    )


# ── POST /customers/{id}/contacts ─────────────────────────────────────────────

@router.post(
    "/customers/{customer_id}/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_customer_contact(
    customer_id: str,
    body: ContactCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("customer:view"))],
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    return add_contact(
        session, current_user.id,
        customer_id=customer_id,
        name=body.name,
        role=body.role,
        is_key_decision_maker=body.is_key_decision_maker,
        wechat_id=body.wechat_id,
        phone=body.phone,
    )


# ── GET /leads/{id}/contacts ──────────────────────────────────────────────────

@router.get("/leads/{lead_id}/contacts", response_model=list[ContactResponse])
def list_lead_contacts(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:view"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权访问")

    return session.exec(select(Contact).where(Contact.lead_id == lead_id)).all()


# ── GET /customers/{id}/contacts ──────────────────────────────────────────────

@router.get("/customers/{customer_id}/contacts", response_model=list[ContactResponse])
def list_customer_contacts(
    customer_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("customer:view"))],
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权访问")

    return session.exec(select(Contact).where(Contact.customer_id == customer_id)).all()


# ── POST /contacts/link (T072) ────────────────────────────────────────────────

@router.post(
    "/contacts/link",
    response_model=ContactRelationResponse,
    status_code=status.HTTP_201_CREATED,
)
def link_contacts_endpoint(
    body: LinkContactsRequest,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:view"))],
):
    for cid in (body.contact_a_id, body.contact_b_id):
        if not session.get(Contact, cid):
            raise HTTPException(status_code=404, detail=f"联系人 {cid} 不存在")

    return link_contacts(
        session,
        current_user.id,
        body.contact_a_id,
        body.contact_b_id,
        note=body.note,
    )
