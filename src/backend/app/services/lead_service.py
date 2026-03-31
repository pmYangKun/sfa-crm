"""
Lead-related business actions.
Each function is an "Action" in the ontology sense — single-purpose,
audited, and callable from both REST API and AI tool use.
"""
import uuid
from datetime import datetime

from sqlmodel import Session, select

from app.models.contact import Contact, ContactRelation
from app.models.lead import Lead
from app.services.audit_service import log_action


# ── Contact management ────────────────────────────────────────────────────────

def add_contact(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None = None,
    customer_id: str | None = None,
    name: str,
    role: str | None = None,
    is_key_decision_maker: bool = False,
    wechat_id: str | None = None,
    phone: str | None = None,
) -> Contact:
    """
    Add a contact to a lead or customer.
    Automatically detects duplicate wechat_id / phone and creates
    a ContactRelation when a duplicate is found.
    """
    contact = Contact(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        customer_id=customer_id,
        name=name,
        role=role,
        is_key_decision_maker=is_key_decision_maker,
        wechat_id=wechat_id,
        phone=phone,
    )
    session.add(contact)
    session.flush()  # get contact.id before checking duplicates

    # Duplicate detection: wechat_id
    if wechat_id:
        duplicates = session.exec(
            select(Contact).where(
                Contact.wechat_id == wechat_id,
                Contact.id != contact.id,
            )
        ).all()
        for dup in duplicates:
            _create_relation(session, contact.id, dup.id, "same_wechat")

    # Duplicate detection: phone
    if phone:
        duplicates = session.exec(
            select(Contact).where(
                Contact.phone == phone,
                Contact.id != contact.id,
            )
        ).all()
        for dup in duplicates:
            _create_relation(session, contact.id, dup.id, "same_phone")

    session.commit()
    session.refresh(contact)

    log_action(
        session, actor_id, "contact:add",
        "lead" if lead_id else "customer",
        lead_id or customer_id or "",
        {"contact_id": contact.id},
    )
    return contact


def _create_relation(
    session: Session,
    contact_a_id: str,
    contact_b_id: str,
    relation_type: str,
) -> None:
    """Create ContactRelation, avoiding duplicates."""
    existing = session.exec(
        select(ContactRelation).where(
            ContactRelation.contact_a_id == contact_a_id,
            ContactRelation.contact_b_id == contact_b_id,
        )
    ).first()
    if not existing:
        relation = ContactRelation(
            id=str(uuid.uuid4()),
            contact_a_id=contact_a_id,
            contact_b_id=contact_b_id,
            relation_type=relation_type,
        )
        session.add(relation)


def link_contacts(
    session: Session,
    actor_id: str,
    contact_a_id: str,
    contact_b_id: str,
    note: str | None = None,
) -> ContactRelation:
    """Manually establish a contact relationship."""
    relation = ContactRelation(
        id=str(uuid.uuid4()),
        contact_a_id=contact_a_id,
        contact_b_id=contact_b_id,
        relation_type="manual",
        note=note,
    )
    session.add(relation)
    session.commit()
    session.refresh(relation)

    log_action(
        session, actor_id, "contact:link", "contact", contact_a_id,
        {"contact_b_id": contact_b_id, "note": note},
    )
    return relation


# ── Lead stage transitions ────────────────────────────────────────────────────

def mark_lead_lost(session: Session, actor_id: str, lead_id: str) -> Lead:
    lead = session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    lead.stage = "lost"
    lead.lost_at = datetime.utcnow()
    lead.pool = "public"
    session.add(lead)
    session.commit()
    session.refresh(lead)
    log_action(session, actor_id, "lead:mark_lost", "lead", lead_id, {})
    return lead
