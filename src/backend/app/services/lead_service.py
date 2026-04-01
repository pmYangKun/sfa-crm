"""
Lead-related business actions.
Each function is an "Action" in the ontology sense — single-purpose,
audited, and callable from both REST API and AI tool use.
"""
import json
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.models.config import SystemConfig
from app.models.contact import Contact, ContactRelation
from app.models.customer import Customer
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.org import OrgNode, User
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_private_pool_limit(session: Session, user_id: str) -> None:
    """Raise ValueError if user's active private-pool leads are at capacity."""
    config = session.get(SystemConfig, "private_pool_limit")
    limit = int(config.value) if config else 100

    count = len(session.exec(
        select(Lead).where(
            Lead.owner_id == user_id,
            Lead.pool == "private",
            Lead.stage == "active",
        )
    ).all())
    if count >= limit:
        raise ValueError(f"私有池已满（上限 {limit} 条），请先释放部分线索")


def _get_user_region(session: Session, user: User) -> str | None:
    """Walk up the OrgNode tree to find the nearest node of type 'region'."""
    node_id = user.org_node_id
    visited: set[str] = set()
    while node_id and node_id not in visited:
        visited.add(node_id)
        node = session.get(OrgNode, node_id)
        if not node:
            break
        if node.type == "region":
            return node.name
        node_id = node.parent_id
    return None


# ── Lead assignment ───────────────────────────────────────────────────────────

def assign_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
    assignee_id: str,
) -> Lead:
    """
    Assign a lead to a salesperson (manager action).
    Checks assignee's private pool capacity before assigning.
    Permission check (lead:assign) is enforced at the API layer.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    if lead.stage != "active":
        raise ValueError("只能分配活跃线索")

    assignee = session.get(User, assignee_id)
    if not assignee or not assignee.is_active:
        raise ValueError("受让人不存在或已停用")

    _check_private_pool_limit(session, assignee_id)

    lead.owner_id = assignee_id
    lead.pool = "private"
    session.add(lead)
    session.commit()
    session.refresh(lead)

    log_action(session, actor_id, "lead:assign", "lead", lead_id, {"assignee_id": assignee_id})
    return lead


# ── Region claim rules (T042) ─────────────────────────────────────────────────

def _check_region_claim_rules(session: Session, lead: Lead, actor: User) -> None:
    """
    Apply region-specific claim rules loaded from SystemConfig.region_claim_rules.

    Three modes:
      - "any"              : anyone can claim (default when no rule)
      - "same_region_only" : claimant must belong to the same region as the lead
      - "priority"         : same-region claimant has exclusive window (priority_minutes),
                             after which anyone can claim
    """
    config = session.get(SystemConfig, "region_claim_rules")
    if not config or not config.value or config.value in ("{}", ""):
        return  # No rules configured → allow all

    rules: dict = json.loads(config.value)
    rule = rules.get(lead.region) or rules.get("default")
    if rule is None:
        return  # No rule for this region → allow all

    if isinstance(rule, str):
        mode = rule
        priority_minutes = 30
    else:
        mode = rule.get("mode", "any")
        priority_minutes = int(rule.get("priority_minutes", 30))

    if mode == "any":
        return

    actor_region = _get_user_region(session, actor)

    if mode == "same_region_only":
        if actor_region != lead.region:
            raise ValueError(f"本线索归属 {lead.region} 大区，仅限同大区成员抢占")

    elif mode == "priority":
        window_end = lead.created_at + timedelta(minutes=priority_minutes)
        now = datetime.utcnow()
        if now < window_end and actor_region != lead.region:
            remaining = max(1, int((window_end - now).total_seconds() / 60))
            raise ValueError(
                f"大区优先窗口期内（剩余约 {remaining} 分钟），仅限 {lead.region} 大区抢占"
            )


# ── Lead claim ────────────────────────────────────────────────────────────────

def claim_lead(session: Session, actor: User, lead_id: str) -> Lead:
    """
    Claim a public-pool lead (salesperson self-service).
    Concurrent protection: the UPDATE is issued inside the same SQLite transaction
    that verified pool == 'public', preventing double-claim.
    Permission check (lead:claim) and rate limiting are enforced at the API layer.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    if lead.pool != "public":
        raise ValueError("线索已被他人抢占或不在公共池中")
    if lead.stage != "active":
        raise ValueError("只能抢占活跃线索")

    _check_region_claim_rules(session, lead, actor)
    _check_private_pool_limit(session, actor.id)

    lead.owner_id = actor.id
    lead.pool = "private"
    session.add(lead)
    session.commit()
    session.refresh(lead)

    log_action(session, actor.id, "lead:claim", "lead", lead_id, {})
    return lead


# ── Lead release (T043) ───────────────────────────────────────────────────────

def release_lead(session: Session, actor_id: str, lead_id: str) -> Lead:
    """
    Manually release a private-pool lead back to the public pool.
    Actor must be the current owner or have lead:assign permission
    (higher-level permission check enforced at API layer).
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    if lead.stage != "active":
        raise ValueError("只有活跃线索可手动释放")
    if lead.pool != "private":
        raise ValueError("线索已在公共池中")

    lead.owner_id = None
    lead.pool = "public"
    session.add(lead)
    session.commit()
    session.refresh(lead)

    log_action(session, actor_id, "lead:release", "lead", lead_id, {})
    return lead


# ── Lead conversion (T051) ────────────────────────────────────────────────────

def convert_lead(
    session: Session,
    actor_id: str,
    lead_id: str,
) -> Customer:
    """
    Convert an active lead to a Customer.
    - Creates a Customer record mirroring the lead's core fields.
    - Migrates contacts from lead → customer.
    - Marks lead.stage = 'converted'.
    Permission check (lead:convert) is enforced at the API layer.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    if lead.stage != "active":
        raise ValueError("只能转化活跃线索")
    if not lead.owner_id:
        raise ValueError("线索必须有归属人才能转化")

    # Idempotency check
    existing = session.exec(
        select(Customer).where(Customer.lead_id == lead_id)
    ).first()
    if existing:
        raise ValueError("线索已转化为客户")

    customer = Customer(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        company_name=lead.company_name,
        unified_code=lead.unified_code,
        region=lead.region,
        owner_id=lead.owner_id,
        source=lead.source,
    )
    session.add(customer)
    session.flush()  # get customer.id

    # Migrate contacts
    contacts = session.exec(
        select(Contact).where(Contact.lead_id == lead_id)
    ).all()
    for contact in contacts:
        contact.lead_id = None
        contact.customer_id = customer.id
        session.add(contact)

    # Mark lead as converted
    lead.stage = "converted"
    lead.converted_at = datetime.utcnow()
    session.add(lead)

    session.commit()
    session.refresh(customer)

    log_action(session, actor_id, "lead:convert", "lead", lead_id, {"customer_id": customer.id})
    return customer


# ── FollowUp logging (T059) ───────────────────────────────────────────────────

def log_followup(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None = None,
    customer_id: str | None = None,
    contact_id: str | None = None,
    followup_type: str,
    content: str,
    followed_at: datetime,
    source: str = "manual",
) -> FollowUp:
    """
    Record a followup activity.
    If attached to a lead, automatically updates lead.last_followup_at.
    """
    followup = FollowUp(
        id=str(uuid.uuid4()),
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

    if lead_id:
        lead = session.get(Lead, lead_id)
        if lead and (lead.last_followup_at is None or followed_at > lead.last_followup_at):
            lead.last_followup_at = followed_at
            session.add(lead)

    session.commit()
    session.refresh(followup)

    entity_type = "lead" if lead_id else "customer"
    entity_id = lead_id or customer_id or ""
    log_action(session, actor_id, "followup:create", entity_type, entity_id, {"followup_id": followup.id})
    return followup


# ── Key Event recording (T062) ────────────────────────────────────────────────

def _record_key_event(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None,
    customer_id: str | None,
    event_type: str,
    payload: dict,
    occurred_at: datetime,
) -> KeyEvent:
    event = KeyEvent(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        customer_id=customer_id,
        type=event_type,
        payload=json.dumps(payload, ensure_ascii=False),
        created_by=actor_id,
        occurred_at=occurred_at,
    )
    session.add(event)
    session.commit()
    session.refresh(event)

    entity_type = "lead" if lead_id else "customer"
    entity_id = lead_id or customer_id or ""
    log_action(session, actor_id, f"key_event:{event_type}", entity_type, entity_id, {"event_id": event.id})
    return event


def record_book_sent(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None = None,
    customer_id: str | None = None,
    sent_at: datetime,
) -> KeyEvent:
    """Record that a book was sent to the prospect."""
    return _record_key_event(
        session, actor_id,
        lead_id=lead_id,
        customer_id=customer_id,
        event_type="book_sent",
        payload={"sent_at": sent_at.isoformat(), "responded_at": None, "confirmed_reading": False},
        occurred_at=sent_at,
    )


def confirm_small_course(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None = None,
    customer_id: str | None = None,
    attended_at: datetime,
    course_name: str | None = None,
) -> KeyEvent:
    """Record that the prospect attended a small (preview) course."""
    return _record_key_event(
        session, actor_id,
        lead_id=lead_id,
        customer_id=customer_id,
        event_type="attended_small_course",
        payload={"attended_at": attended_at.isoformat(), "course_name": course_name},
        occurred_at=attended_at,
    )


def record_big_course(
    session: Session,
    actor_id: str,
    *,
    lead_id: str | None = None,
    customer_id: str | None = None,
    purchase_date: datetime,
    contract_amount: float,
) -> KeyEvent:
    """Record that the customer purchased a big course."""
    return _record_key_event(
        session, actor_id,
        lead_id=lead_id,
        customer_id=customer_id,
        event_type="purchased_big_course",
        payload={"contract_amount": contract_amount, "purchase_date": purchase_date.isoformat()},
        occurred_at=purchase_date,
    )
