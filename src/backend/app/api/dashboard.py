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


def _lead_count(session: Session, visible_ids: list[str] | None, **filters) -> int:
    stmt = select(func.count(Lead.id))
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore
    for k, v in filters.items():
        stmt = stmt.where(getattr(Lead, k) == v)
    return session.exec(stmt).one()


@router.get("/dashboard/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    visible_ids = get_visible_user_ids(session, current_user)

    total_leads = _lead_count(session, visible_ids)
    active_leads = _lead_count(session, visible_ids, stage="active")
    converted_leads = _lead_count(session, visible_ids, stage="converted")
    lost_leads = _lead_count(session, visible_ids, stage="lost")

    # Public pool count (global, not scoped)
    public_leads = session.exec(
        select(func.count(Lead.id)).where(Lead.pool == "public", Lead.stage == "active")
    ).one()

    # Customer count
    cust_stmt = select(func.count(Customer.id))
    if visible_ids is not None:
        cust_stmt = cust_stmt.where(Customer.owner_id.in_(visible_ids))  # type: ignore
    total_customers = session.exec(cust_stmt).one()

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
    visible_ids = get_visible_user_ids(session, current_user)

    # If scope is "all", get all active users
    if visible_ids is None:
        all_users = session.exec(
            select(User).where(User.is_active == True)  # noqa: E712
        ).all()
        visible_ids = [u.id for u in all_users]

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
