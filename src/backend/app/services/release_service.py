"""
Automatic lead release service.

Runs as a daily APScheduler job. Reads release thresholds from SystemConfig
and releases overdue private-pool leads back to the public pool.

Two release rules (both read from SystemConfig):
  1. followup_release_days (default 10)  — last_followup_at (or created_at when
     no followup yet) is older than N days.
  2. conversion_release_days (default 30) — lead has been active for > N days
     regardless of followup activity (i.e. still hasn't converted).
"""
import uuid
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models.config import SystemConfig
from app.models.lead import Lead
from app.models.notification import Notification
from app.services.audit_service import log_action


def run_auto_release() -> dict:
    """
    Entry point called by APScheduler.
    Returns a summary dict for logging.
    """
    with Session(engine) as session:
        cfg = _load_config(session)
        released = _release_overdue_leads(session, cfg)
    return {"released": released, "ran_at": datetime.utcnow().isoformat()}


# ── Internal ──────────────────────────────────────────────────────────────────

def _load_config(session: Session) -> dict:
    def _get(key: str, default: int) -> int:
        row = session.get(SystemConfig, key)
        return int(row.value) if row else default

    return {
        "followup_days": _get("followup_release_days", 10),
        "conversion_days": _get("conversion_release_days", 30),
    }


def _release_overdue_leads(session: Session, cfg: dict) -> int:
    now = datetime.utcnow()
    followup_cutoff = now - timedelta(days=cfg["followup_days"])
    conversion_cutoff = now - timedelta(days=cfg["conversion_days"])

    # All active, private-pool leads with an owner
    candidates = session.exec(
        select(Lead).where(
            Lead.stage == "active",
            Lead.pool == "private",
            Lead.owner_id.isnot(None),  # type: ignore[attr-defined]
        )
    ).all()

    released_count = 0
    for lead in candidates:
        reason = _should_release(lead, followup_cutoff, conversion_cutoff)
        if reason:
            _do_release(session, lead, reason, now)
            released_count += 1

    session.commit()
    return released_count


def _should_release(
    lead: Lead,
    followup_cutoff: datetime,
    conversion_cutoff: datetime,
) -> str | None:
    """Return a reason string if the lead should be released, else None."""
    # Rule 1: no followup within followup_release_days
    reference_time = lead.last_followup_at or lead.created_at
    if reference_time <= followup_cutoff:
        return "followup_overdue"

    # Rule 2: active for longer than conversion_release_days
    if lead.created_at <= conversion_cutoff:
        return "conversion_overdue"

    return None


def _do_release(session: Session, lead: Lead, reason: str, now: datetime) -> None:
    owner_id = lead.owner_id  # save before clearing

    lead.owner_id = None
    lead.pool = "public"
    session.add(lead)

    # System-actor audit log (user_id=None means automated)
    log_action(session, "system", "lead:auto_release", "lead", lead.id, {"reason": reason})

    # Notify the original owner
    if owner_id:
        session.add(Notification(
            id=str(uuid.uuid4()),
            user_id=owner_id,
            type="lead_released",
            title="线索已自动释放",
            body=f"「{lead.company_name}」已因{_reason_label(reason)}被自动释放至公共池。",
            entity_type="lead",
            entity_id=lead.id,
        ))


def _reason_label(reason: str) -> str:
    return {
        "followup_overdue": "超期未跟进",
        "conversion_overdue": "超期未成单",
    }.get(reason, reason)
