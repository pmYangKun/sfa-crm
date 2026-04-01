"""Lead business logic — Ontology Actions."""

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models.contact import Contact, ContactRelation
from app.models.lead import Lead
from app.services.audit_service import write_audit_log


def create_lead_contacts(
    session: Session,
    lead_id: str,
    contacts_data: list[dict],
    created_by: str,
) -> list[Contact]:
    """Create contacts for a lead, auto-detecting duplicates via wechat_id/phone."""
    created = []
    for c in contacts_data:
        contact = Contact(
            lead_id=lead_id,
            name=c["name"],
            role=c.get("role"),
            is_key_decision_maker=c.get("is_key_decision_maker", False),
            wechat_id=c.get("wechat_id"),
            phone=c.get("phone"),
        )
        session.add(contact)
        session.flush()

        # Check for duplicate contacts (same wechat_id or phone)
        duplicates = []
        if contact.wechat_id:
            dups = session.exec(
                select(Contact).where(
                    Contact.wechat_id == contact.wechat_id,
                    Contact.id != contact.id,
                )
            ).all()
            duplicates.extend(dups)
        if contact.phone:
            dups = session.exec(
                select(Contact).where(
                    Contact.phone == contact.phone,
                    Contact.id != contact.id,
                )
            ).all()
            duplicates.extend(dups)

        # Auto-create ContactRelation for duplicates
        seen = set()
        for dup in duplicates:
            if dup.id in seen:
                continue
            seen.add(dup.id)
            a_id, b_id = sorted([contact.id, dup.id])
            existing_rel = session.exec(
                select(ContactRelation).where(
                    ContactRelation.contact_a_id == a_id,
                    ContactRelation.contact_b_id == b_id,
                )
            ).first()
            if not existing_rel:
                session.add(ContactRelation(
                    contact_a_id=a_id,
                    contact_b_id=b_id,
                    relation_type="partner",
                    note="系统自动检测到重复联系人",
                    created_by=created_by,
                ))

        created.append(contact)
    return created


def assign_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
    assignee_id: str,
    *,
    private_pool_limit: int = 100,
    ip: str | None = None,
) -> Lead:
    """Assign a lead to a sales person."""
    lead = session.get(Lead, lead_id)
    if not lead or lead.stage != "active":
        raise ValueError("线索不存在或状态不允许操作")

    # Check assignee private pool count
    count = len(session.exec(
        select(Lead.id).where(
            Lead.owner_id == assignee_id,
            Lead.pool == "private",
            Lead.stage == "active",
        )
    ).all())
    if count >= private_pool_limit:
        raise ValueError(f"该销售私有池已满（当前 {count} / 上限 {private_pool_limit}）")

    lead.owner_id = assignee_id
    lead.pool = "private"
    session.add(lead)

    write_audit_log(
        session,
        user_id=actor_id,
        action="assign_lead",
        entity_type="lead",
        entity_id=lead_id,
        payload={"assignee_id": assignee_id},
        ip=ip,
    )
    return lead


def claim_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
    *,
    private_pool_limit: int = 100,
    ip: str | None = None,
) -> Lead:
    """Claim a lead from the public pool."""
    lead = session.get(Lead, lead_id)
    if not lead or lead.stage != "active":
        raise ValueError("线索不存在或状态不允许操作")
    if lead.pool != "public":
        raise ValueError("该线索已被其他销售抢占")

    count = len(session.exec(
        select(Lead.id).where(
            Lead.owner_id == actor_id,
            Lead.pool == "private",
            Lead.stage == "active",
        )
    ).all())
    if count >= private_pool_limit:
        raise ValueError(f"私有池已满（当前 {count} / 上限 {private_pool_limit}）")

    lead.owner_id = actor_id
    lead.pool = "private"
    session.add(lead)

    write_audit_log(
        session,
        user_id=actor_id,
        action="claim_lead",
        entity_type="lead",
        entity_id=lead_id,
        ip=ip,
    )
    return lead


def release_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
    *,
    ip: str | None = None,
) -> Lead:
    """Release a lead back to the public pool."""
    lead = session.get(Lead, lead_id)
    if not lead or lead.stage != "active":
        raise ValueError("线索不存在或状态不允许操作")

    lead.owner_id = None
    lead.pool = "public"
    session.add(lead)

    write_audit_log(
        session,
        user_id=actor_id,
        action="release_lead",
        entity_type="lead",
        entity_id=lead_id,
        ip=ip,
    )
    return lead


def mark_lead_lost(
    session: Session,
    actor_id: str,
    lead_id: str,
    *,
    ip: str | None = None,
) -> Lead:
    """Mark a lead as lost."""
    lead = session.get(Lead, lead_id)
    if not lead or lead.stage != "active":
        raise ValueError("线索不存在或状态不允许操作")

    lead.stage = "lost"
    lead.lost_at = datetime.now(timezone.utc).isoformat()
    session.add(lead)

    write_audit_log(
        session,
        user_id=actor_id,
        action="mark_lead_lost",
        entity_type="lead",
        entity_id=lead_id,
        ip=ip,
    )
    return lead


def convert_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
    *,
    ip: str | None = None,
):
    """Convert a lead to a customer. Returns (lead, customer)."""
    from app.models.customer import Customer

    lead = session.get(Lead, lead_id)
    if not lead or lead.stage != "active":
        raise ValueError("线索不存在或状态不允许操作")

    lead.stage = "converted"
    lead.converted_at = datetime.now(timezone.utc).isoformat()
    session.add(lead)

    customer = Customer(
        lead_id=lead.id,
        company_name=lead.company_name,
        unified_code=lead.unified_code,
        region=lead.region,
        owner_id=lead.owner_id or actor_id,
        source=lead.source,
    )
    session.add(customer)
    session.flush()

    # Migrate contacts from lead to customer
    contacts = session.exec(
        select(Contact).where(Contact.lead_id == lead_id)
    ).all()
    for contact in contacts:
        contact.lead_id = None
        contact.customer_id = customer.id
        session.add(contact)

    write_audit_log(
        session,
        user_id=actor_id,
        action="convert_lead",
        entity_type="lead",
        entity_id=lead_id,
        payload={"customer_id": customer.id},
        ip=ip,
    )
    return lead, customer


def log_followup(
    session: Session,
    actor_id: str,
    lead_id: str | None = None,
    customer_id: str | None = None,
    *,
    contact_id: str | None = None,
    followup_type: str,
    content: str,
    followed_at: str,
    source: str = "manual",
    ip: str | None = None,
):
    """Log a followup and update last_followup_at."""
    from app.models.followup import FollowUp

    followup = FollowUp(
        lead_id=lead_id,
        customer_id=customer_id,
        contact_id=contact_id,
        owner_id=actor_id,
        type=followup_type,
        source=source,
        content=content,
        followed_at=followed_at,
    )
    session.add(followup)

    # Update last_followup_at on lead
    if lead_id:
        lead = session.get(Lead, lead_id)
        if lead:
            lead.last_followup_at = followed_at
            session.add(lead)

    write_audit_log(
        session,
        user_id=actor_id,
        action="log_followup",
        entity_type="lead" if lead_id else "customer",
        entity_id=lead_id or customer_id,
        ip=ip,
    )
    return followup
