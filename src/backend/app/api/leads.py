"""Lead API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_client_ip, get_current_user, require_permission
from app.models.config import SystemConfig
from app.models.lead import Lead
from app.models.contact import Contact
from app.models.org import User
from app.services.lead_service import (
    assign_lead,
    claim_lead,
    create_lead_contacts,
    mark_lead_lost,
    release_lead,
)
from app.services.permission_service import get_visible_user_ids
from app.services.uniqueness_service import check_uniqueness

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    name: str
    role: Optional[str] = None
    is_key_decision_maker: bool = False
    wechat_id: Optional[str] = None
    phone: Optional[str] = None


class LeadCreate(BaseModel):
    company_name: str
    unified_code: Optional[str] = None
    region: str
    source: str
    contacts: list[ContactCreate] = []


class AssignRequest(BaseModel):
    sales_id: str


class MarkLostRequest(BaseModel):
    reason: Optional[str] = None


class LeadOwner(BaseModel):
    id: str
    name: str


class LeadResponse(BaseModel):
    id: str
    company_name: str
    unified_code: Optional[str]
    region: str
    stage: str
    pool: str
    owner: Optional[LeadOwner]
    source: str
    last_followup_at: Optional[str]
    created_at: str
    converted_at: Optional[str]
    lost_at: Optional[str]


class LeadListResponse(BaseModel):
    total: int
    items: list[LeadResponse]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lead_to_response(lead: Lead, session: Session) -> LeadResponse:
    owner = None
    if lead.owner_id:
        user = session.get(User, lead.owner_id)
        if user:
            owner = LeadOwner(id=user.id, name=user.name)
    return LeadResponse(
        id=lead.id,
        company_name=lead.company_name,
        unified_code=lead.unified_code,
        region=lead.region,
        stage=lead.stage,
        pool=lead.pool,
        owner=owner,
        source=lead.source,
        last_followup_at=lead.last_followup_at,
        created_at=lead.created_at,
        converted_at=lead.converted_at,
        lost_at=lead.lost_at,
    )


def _get_pool_limit(session: Session) -> int:
    cfg = session.get(SystemConfig, "private_pool_limit")
    return int(cfg.value) if cfg else 100


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/leads", status_code=status.HTTP_201_CREATED)
def create_lead(
    body: LeadCreate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.create")),
):
    # Get threshold from config
    cfg = session.get(SystemConfig, "name_similarity_threshold")
    threshold = int(cfg.value) if cfg else 85

    # Uniqueness check
    result = check_uniqueness(session, body.company_name, body.unified_code, threshold)

    if result["status"] == "exact":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "LEAD_DUPLICATE_EXACT",
                "message": f"该企业已存在，当前归属：{result['owner_name']}",
                "detail": {
                    "existing_lead_id": result["existing_lead"].id,
                    "owner_name": result["owner_name"],
                },
            },
        )

    # Create the lead
    lead = Lead(
        company_name=body.company_name,
        unified_code=body.unified_code,
        region=body.region,
        source=body.source,
    )
    session.add(lead)
    session.flush()

    # Create contacts
    if body.contacts:
        create_lead_contacts(
            session, lead.id,
            [c.model_dump() for c in body.contacts],
            created_by=current_user.id,
        )

    session.commit()

    response = _lead_to_response(lead, session)

    if result["status"] == "similar":
        return {
            "code": "LEAD_DUPLICATE_WARNING",
            "message": "已录入，系统检测到疑似重复企业，已通知队长确认",
            "detail": {
                "lead_id": lead.id,
                "similar_leads": [
                    {"lead_id": s["lead"].id, "company_name": s["lead"].company_name, "score": s["score"]}
                    for s in result["similar_leads"]
                ],
            },
            "lead": response.model_dump(),
        }

    return response


@router.get("/leads", response_model=LeadListResponse)
def list_leads(
    pool: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("last_followup_at"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    stmt = select(Lead)

    # DataScope filtering
    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids) | (Lead.pool == "public"))  # type: ignore

    if pool:
        stmt = stmt.where(Lead.pool == pool)
    if stage:
        stmt = stmt.where(Lead.stage == stage)
    else:
        stmt = stmt.where(Lead.stage == "active")
    if region:
        stmt = stmt.where(Lead.region == region)
    if search:
        stmt = stmt.where(Lead.company_name.contains(search))  # type: ignore

    # Count
    from sqlmodel import func
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.exec(count_stmt).one()

    # Sort
    if sort == "created_at":
        stmt = stmt.order_by(Lead.created_at.desc())  # type: ignore
    else:
        stmt = stmt.order_by(Lead.last_followup_at.desc())  # type: ignore

    # Paginate
    stmt = stmt.offset((page - 1) * size).limit(size)
    leads = session.exec(stmt).all()

    return LeadListResponse(
        total=total,
        items=[_lead_to_response(lead, session) for lead in leads],
    )


@router.get("/leads/{lead_id}")
def get_lead(
    lead_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # DataScope check
    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None and lead.owner_id not in visible_ids and lead.pool != "public":
        raise HTTPException(status_code=403, detail={"code": "DATA_SCOPE_DENIED", "message": "无数据可见权限"})

    contacts = session.exec(select(Contact).where(Contact.lead_id == lead_id)).all()

    response = _lead_to_response(lead, session).model_dump()
    response["contacts"] = [
        {
            "id": c.id, "name": c.name, "role": c.role,
            "is_key_decision_maker": c.is_key_decision_maker,
            "wechat_id": c.wechat_id, "phone": c.phone,
        }
        for c in contacts
    ]
    return response


@router.post("/leads/{lead_id}/assign")
def assign_lead_endpoint(
    lead_id: str,
    body: AssignRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.assign")),
):
    try:
        lead = assign_lead(
            session, current_user.id, lead_id, body.sales_id,
            private_pool_limit=_get_pool_limit(session),
            ip=get_client_ip(request),
        )
        session.commit()
        return _lead_to_response(lead, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "POOL_LIMIT_EXCEEDED", "message": str(e)})


@router.post("/leads/{lead_id}/claim")
def claim_lead_endpoint(
    lead_id: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.claim")),
):
    try:
        lead = claim_lead(
            session, current_user.id, lead_id,
            private_pool_limit=_get_pool_limit(session),
            ip=get_client_ip(request),
        )
        session.commit()
        return _lead_to_response(lead, session)
    except ValueError as e:
        code = "LEAD_ALREADY_CLAIMED" if "已被" in str(e) else "POOL_LIMIT_EXCEEDED"
        raise HTTPException(
            status_code=409 if code == "LEAD_ALREADY_CLAIMED" else 400,
            detail={"code": code, "message": str(e)},
        )


@router.post("/leads/{lead_id}/release")
def release_lead_endpoint(
    lead_id: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.release")),
):
    try:
        lead = release_lead(
            session, current_user.id, lead_id,
            ip=get_client_ip(request),
        )
        session.commit()
        return _lead_to_response(lead, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/leads/{lead_id}/mark-lost")
def mark_lost_endpoint(
    lead_id: str,
    body: MarkLostRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.mark_lost")),
):
    try:
        lead = mark_lead_lost(
            session, current_user.id, lead_id,
            ip=get_client_ip(request),
        )
        session.commit()
        return _lead_to_response(lead, session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
