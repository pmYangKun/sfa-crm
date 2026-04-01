"""Contact management API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_client_ip, require_permission
from app.models.contact import Contact, ContactRelation
from app.models.org import User
from app.services.audit_service import write_audit_log
from app.services.lead_service import create_lead_contacts

router = APIRouter()


class ContactCreate(BaseModel):
    name: str
    role: Optional[str] = None
    is_key_decision_maker: bool = False
    wechat_id: Optional[str] = None
    phone: Optional[str] = None


class LinkContactsRequest(BaseModel):
    contact_a_id: str
    contact_b_id: str
    relation_type: str
    note: Optional[str] = None


@router.post("/leads/{lead_id}/contacts")
def add_lead_contact(
    lead_id: str,
    body: ContactCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.create")),
):
    contacts = create_lead_contacts(
        session, lead_id, [body.model_dump()], created_by=current_user.id
    )
    session.commit()
    return contacts[0] if contacts else None


@router.post("/customers/{customer_id}/contacts")
def add_customer_contact(
    customer_id: str,
    body: ContactCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("customer.view")),
):
    contact = Contact(
        customer_id=customer_id,
        name=body.name,
        role=body.role,
        is_key_decision_maker=body.is_key_decision_maker,
        wechat_id=body.wechat_id,
        phone=body.phone,
    )
    session.add(contact)
    session.commit()
    return contact


@router.post("/contacts/link")
def link_contacts(
    body: LinkContactsRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    a_id, b_id = sorted([body.contact_a_id, body.contact_b_id])
    if a_id == b_id:
        raise HTTPException(status_code=400, detail="Cannot link a contact to itself")

    existing = session.exec(
        select(ContactRelation).where(
            ContactRelation.contact_a_id == a_id,
            ContactRelation.contact_b_id == b_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Relation already exists")

    relation = ContactRelation(
        contact_a_id=a_id,
        contact_b_id=b_id,
        relation_type=body.relation_type,
        note=body.note,
        created_by=current_user.id,
    )
    session.add(relation)

    write_audit_log(
        session, user_id=current_user.id, action="link_contacts",
        entity_type="contact_relation", payload={"a": a_id, "b": b_id, "type": body.relation_type},
        ip=get_client_ip(request),
    )
    session.commit()
    return relation
