"""
Customer API endpoints.

GET /customers        — paginated list (respects data scope)
GET /customers/{id}   — detail with derived conversion-window status
"""
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, computed_field
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.customer import Customer
from app.models.lead import Lead
from app.models.org import User
from app.services.customer_service import get_conversion_window_status
from app.services.permission_service import get_visible_user_ids

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Response schemas ──────────────────────────────────────────────────────────

class CustomerResponse(BaseModel):
    id: str
    lead_id: str
    company_name: str
    unified_code: Optional[str]
    region: str
    owner_id: str
    source: str
    created_at: datetime
    # Derived: days since conversion
    days_since_conversion: int

    model_config = {"from_attributes": False}


class CustomerDetailResponse(CustomerResponse):
    # Source lead info (read-only reference)
    lead_region: Optional[str] = None
    lead_source: Optional[str] = None
    # Derived conversion window
    conversion_window: dict


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int
    page: int
    page_size: int


def _to_customer_response(customer: Customer) -> CustomerResponse:
    days = (datetime.utcnow() - customer.created_at).days
    return CustomerResponse(
        id=customer.id,
        lead_id=customer.lead_id,
        company_name=customer.company_name,
        unified_code=customer.unified_code,
        region=customer.region,
        owner_id=customer.owner_id,
        source=customer.source,
        created_at=customer.created_at,
        days_since_conversion=days,
    )


# ── GET /customers ────────────────────────────────────────────────────────────

@router.get("/customers", response_model=CustomerListResponse)
def list_customers(
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("customer:view"))],
    search: Optional[str] = Query(None, description="模糊搜索公司名"),
    region: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    visible_ids = get_visible_user_ids(session, current_user)

    query = select(Customer).where(Customer.owner_id.in_(visible_ids))  # type: ignore[attr-defined]
    if search:
        query = query.where(Customer.company_name.contains(search))  # type: ignore[attr-defined]
    if region:
        query = query.where(Customer.region == region)

    all_items = session.exec(query).all()
    total = len(all_items)
    page_items = session.exec(query.offset((page - 1) * page_size).limit(page_size)).all()

    return CustomerListResponse(
        items=[_to_customer_response(c) for c in page_items],
        total=total,
        page=page,
        page_size=page_size,
    )


# ── GET /customers/{id} ───────────────────────────────────────────────────────

@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
def get_customer(
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

    lead = session.get(Lead, customer.lead_id)
    days = (datetime.utcnow() - customer.created_at).days

    return CustomerDetailResponse(
        id=customer.id,
        lead_id=customer.lead_id,
        company_name=customer.company_name,
        unified_code=customer.unified_code,
        region=customer.region,
        owner_id=customer.owner_id,
        source=customer.source,
        created_at=customer.created_at,
        days_since_conversion=days,
        lead_region=lead.region if lead else None,
        lead_source=lead.source if lead else None,
        conversion_window=get_conversion_window_status(customer),
    )
