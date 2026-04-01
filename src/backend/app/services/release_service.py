"""Auto-release service — daily job to release overdue leads."""

from datetime import datetime, timezone, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models.config import SystemConfig
from app.models.lead import Lead
from app.models.notification import Notification
from app.services.audit_service import write_audit_log


def run_auto_release():
    """Release leads that haven't been followed up within the configured threshold."""
    with Session(engine) as session:
        # Read config
        followup_cfg = session.get(SystemConfig, "followup_release_days")
        followup_days = int(followup_cfg.value) if followup_cfg else 10
        conversion_cfg = session.get(SystemConfig, "conversion_release_days")
        conversion_days = int(conversion_cfg.value) if conversion_cfg else 30

        now = datetime.now(timezone.utc)

        # Find private active leads
        leads = session.exec(
            select(Lead).where(
                Lead.pool == "private",
                Lead.stage == "active",
                Lead.owner_id.isnot(None),  # type: ignore
            )
        ).all()

        released_count = 0
        for lead in leads:
            should_release = False

            # Check followup threshold
            if lead.last_followup_at:
                last_fu = datetime.fromisoformat(lead.last_followup_at)
                if (now - last_fu).days >= followup_days:
                    should_release = True
            else:
                # No followup ever — check creation date
                created = datetime.fromisoformat(lead.created_at)
                if (now - created).days >= followup_days:
                    should_release = True

            # Check conversion threshold (time since assignment/creation)
            created = datetime.fromisoformat(lead.created_at)
            if (now - created).days >= conversion_days:
                should_release = True

            if should_release:
                original_owner = lead.owner_id
                lead.owner_id = None
                lead.pool = "public"
                session.add(lead)

                write_audit_log(
                    session,
                    user_id=None,
                    action="auto_release_lead",
                    entity_type="lead",
                    entity_id=lead.id,
                    payload={"original_owner_id": original_owner},
                )

                # Notify original owner
                if original_owner:
                    session.add(Notification(
                        user_id=original_owner,
                        type="release",
                        title="线索已被自动释放",
                        content=f"线索「{lead.company_name}」因超期未跟进已被自动释放至公共池",
                    ))

                released_count += 1

        session.commit()
        return released_count
