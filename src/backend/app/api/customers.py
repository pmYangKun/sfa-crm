"""Customer API endpoints."""

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import get_client_ip, get_current_user, require_permission
from app.models.customer import Customer
from app.models.key_event import KeyEvent
from app.models.org import User
from app.services.permission_service import get_visible_user_ids

router = APIRouter()


class CustomerOwner(BaseModel):
    id: str
    name: str


class ConversionWindow(BaseModel):
    in_window: bool
    days_remaining: int
    has_big_course: bool


class CustomerResponse(BaseModel):
    id: str
    lead_id: str
    company_name: str
    unified_code: Optional[str]
    region: str
    owner_id: str
    owner: Optional[CustomerOwner]
    source: str
    created_at: str
    conversion_window: Optional[ConversionWindow]


class CustomerListResponse(BaseModel):
    total: int
    items: list[CustomerResponse]


class ReassignRequest(BaseModel):
    new_owner_id: str


def _customer_to_response(customer: Customer, session: Session) -> CustomerResponse:
    owner = None
    user = session.get(User, customer.owner_id)
    if user:
        owner = CustomerOwner(id=user.id, name=user.name)

    # Calculate conversion window (14 days from creation)
    created = datetime.fromisoformat(customer.created_at)
    now = datetime.now(timezone.utc)
    days_elapsed = (now - created).days
    days_remaining = max(0, 14 - days_elapsed)
    in_window = days_remaining > 0

    # Check if has big course purchase
    has_big = session.exec(
        select(KeyEvent).where(
            KeyEvent.customer_id == customer.id,
            KeyEvent.type == "purchased_big_course",
        )
    ).first() is not None

    return CustomerResponse(
        id=customer.id,
        lead_id=customer.lead_id,
        company_name=customer.company_name,
        unified_code=customer.unified_code,
        region=customer.region,
        owner_id=customer.owner_id,
        owner=owner,
        source=customer.source,
        created_at=customer.created_at,
        conversion_window=ConversionWindow(
            in_window=in_window,
            days_remaining=days_remaining,
            has_big_course=has_big,
        ),
    )


@router.get("/customers", response_model=CustomerListResponse)
def list_customers(
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    in_conversion_window: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("customer.view")),
):
    stmt = select(Customer)

    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None:
        stmt = stmt.where(Customer.owner_id.in_(visible_ids))  # type: ignore

    if region:
        stmt = stmt.where(Customer.region == region)
    if search:
        stmt = stmt.where(Customer.company_name.contains(search))  # type: ignore

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.exec(count_stmt).one()

    stmt = stmt.order_by(Customer.created_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    customers = session.exec(stmt).all()

    items = [_customer_to_response(c, session) for c in customers]

    # Post-filter by conversion window if requested
    if in_conversion_window is not None:
        items = [i for i in items if i.conversion_window and i.conversion_window.in_window == in_conversion_window]

    return CustomerListResponse(total=total, items=items)


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("customer.view")),
):
    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None and customer.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail={"code": "DATA_SCOPE_DENIED", "message": "无数据可见权限"})

    return _customer_to_response(customer, session)


@router.post("/customers/{customer_id}/reassign")
def reassign_customer(
    customer_id: str,
    body: ReassignRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("customer.reassign")),
):
    from app.services.audit_service import write_audit_log

    customer = session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    old_owner = customer.owner_id
    customer.owner_id = body.new_owner_id
    session.add(customer)

    write_audit_log(
        session,
        user_id=current_user.id,
        action="reassign_customer",
        entity_type="customer",
        entity_id=customer_id,
        payload={"old_owner_id": old_owner, "new_owner_id": body.new_owner_id},
        ip=get_client_ip(request),
    )
    session.commit()
    return _customer_to_response(customer, session)
