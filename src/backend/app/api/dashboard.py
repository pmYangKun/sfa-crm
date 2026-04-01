"""Dashboard API — aggregate stats for overview page."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.customer import Customer
from app.models.lead import Lead
from app.models.org import User
from app.services.permission_service import get_visible_user_ids

router = APIRouter()


@router.get("/dashboard/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    visible_ids = get_visible_user_ids(session, current_user.id)

    # Lead counts
    total_leads = session.exec(
        select(func.count(Lead.id)).where(Lead.owner_id.in_(visible_ids))  # type: ignore
    ).one()
    active_leads = session.exec(
        select(func.count(Lead.id)).where(
            Lead.owner_id.in_(visible_ids),  # type: ignore
            Lead.stage == "active",
        )
    ).one()
    converted_leads = session.exec(
        select(func.count(Lead.id)).where(
            Lead.owner_id.in_(visible_ids),  # type: ignore
            Lead.stage == "converted",
        )
    ).one()
    lost_leads = session.exec(
        select(func.count(Lead.id)).where(
            Lead.owner_id.in_(visible_ids),  # type: ignore
            Lead.stage == "lost",
        )
    ).one()

    # Public pool count
    public_leads = session.exec(
        select(func.count(Lead.id)).where(Lead.pool == "public", Lead.stage == "active")
    ).one()

    # Customer count
    total_customers = session.exec(
        select(func.count(Customer.id)).where(Customer.owner_id.in_(visible_ids))  # type: ignore
    ).one()

    # Conversion rate
    conversion_rate = (
        round(converted_leads / total_leads * 100, 1) if total_leads > 0 else 0
    )

    return {
        "total_leads": total_leads,
        "active_leads": active_leads,
        "converted_leads": converted_leads,
        "lost_leads": lost_leads,
        "public_leads": public_leads,
        "total_customers": total_customers,
        "conversion_rate": conversion_rate,
    }


@router.get("/dashboard/team-stats")
def get_team_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    """Per-sales stats for manager view."""
    visible_ids = get_visible_user_ids(session, current_user.id)

    team_data = []
    for uid in visible_ids:
        user = session.get(User, uid)
        if not user or not user.is_active:
            continue

        active = session.exec(
            select(func.count(Lead.id)).where(
                Lead.owner_id == uid, Lead.stage == "active", Lead.pool == "private",
            )
        ).one()
        converted = session.exec(
            select(func.count(Lead.id)).where(
                Lead.owner_id == uid, Lead.stage == "converted",
            )
        ).one()
        customers = session.exec(
            select(func.count(Customer.id)).where(Customer.owner_id == uid)
        ).one()

        team_data.append({
            "user_id": uid,
            "name": user.name,
            "active_leads": active,
            "converted_leads": converted,
            "customers": customers,
        })

    team_data.sort(key=lambda x: x["converted_leads"], reverse=True)
    return team_data
