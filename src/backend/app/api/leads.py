import uuid
from datetime import datetime
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.config import SystemConfig
from app.models.lead import Lead
from app.models.org import User
from app.services.audit_service import log_action
from app.services.lead_service import assign_lead, claim_lead, convert_lead, mark_lead_lost, release_lead
from app.services.permission_service import get_visible_user_ids
from app.services.rate_limiter import user_limiter
from app.services.uniqueness_service import check_uniqueness

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Request / Response schemas ────────────────────────────────────────────────

class LeadCreate(BaseModel):
    company_name: str
    unified_code: Optional[str] = None
    region: str
    source: Literal["referral", "organic", "koc_sem", "outbound"]


class LeadResponse(BaseModel):
    id: str
    company_name: str
    unified_code: Optional[str]
    region: str
    stage: str
    pool: str
    owner_id: Optional[str]
    source: str
    created_at: datetime
    last_followup_at: Optional[datetime]
    converted_at: Optional[datetime]
    lost_at: Optional[datetime]

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    total: int
    page: int
    page_size: int


class UniquenessWarning(BaseModel):
    duplicate_lead_id: str


# ── POST /leads ───────────────────────────────────────────────────────────────

@router.post(
    "/leads",
    status_code=status.HTTP_201_CREATED,
    response_model=LeadResponse,
)
def create_lead(
    body: LeadCreate,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:create"))],
):
    result, dup_id = check_uniqueness(session, body.company_name, body.unified_code)

    if result == "blocked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "企业已存在（统一社会信用代码重复）", "duplicate_lead_id": dup_id},
        )

    lead = Lead(
        id=str(uuid.uuid4()),
        company_name=body.company_name,
        unified_code=body.unified_code,
        region=body.region,
        source=body.source,
        stage="active",
        pool="private",
        owner_id=current_user.id,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)

    log_action(session, current_user.id, "lead:create", "lead", lead.id, {})

    if result == "warn":
        # Return 202 with warning header; body still contains the created lead
        from fastapi.responses import JSONResponse
        import json

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                **LeadResponse.model_validate(lead).model_dump(mode="json"),
                "_warning": {
                    "message": "检测到相似企业名称，已通知主管",
                    "duplicate_lead_id": dup_id,
                },
            },
        )

    return lead


# ── GET /leads ────────────────────────────────────────────────────────────────

@router.get("/leads", response_model=LeadListResponse)
def list_leads(
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:view"))],
    pool: Optional[str] = Query(None),
    stage: Optional[str] = Query(None, description="active|converted|lost"),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="模糊搜索公司名"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    visible_ids = get_visible_user_ids(session, current_user)

    query = select(Lead).where(Lead.owner_id.in_(visible_ids))  # type: ignore[attr-defined]

    if pool:
        query = query.where(Lead.pool == pool)
    if stage:
        query = query.where(Lead.stage == stage)
    if region:
        query = query.where(Lead.region == region)
    if search:
        query = query.where(Lead.company_name.contains(search))  # type: ignore[attr-defined]

    total = len(session.exec(query).all())
    items = session.exec(query.offset((page - 1) * page_size).limit(page_size)).all()

    return LeadListResponse(items=items, total=total, page=page, page_size=page_size)  # type: ignore[arg-type]


# ── GET /leads/{id} ───────────────────────────────────────────────────────────

@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:view"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权访问")

    return lead


# ── POST /leads/{id}/assign (T039) ────────────────────────────────────────────

class AssignRequest(BaseModel):
    assignee_id: str


@router.post("/leads/{lead_id}/assign", response_model=LeadResponse)
def assign_lead_endpoint(
    lead_id: str,
    body: AssignRequest,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:assign"))],
):
    try:
        return assign_lead(session, current_user.id, lead_id, body.assignee_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── POST /leads/{id}/claim (T041) ─────────────────────────────────────────────

def _claim_limit_callable(request: Request) -> str:
    """Dynamic rate-limit string read from SystemConfig at request time."""
    from app.core.database import engine as _engine
    from sqlmodel import Session as _Session
    with _Session(_engine) as s:
        config = s.get(SystemConfig, "claim_rate_limit")
        return f"{int(config.value)}/minute" if config else "10/minute"


@router.post("/leads/{lead_id}/claim", response_model=LeadResponse)
@user_limiter.limit(_claim_limit_callable)
def claim_lead_endpoint(
    request: Request,
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:claim"))],
):
    try:
        return claim_lead(session, current_user, lead_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── POST /leads/{id}/release + mark-lost (T044) ───────────────────────────────

@router.post("/leads/{lead_id}/release", response_model=LeadResponse)
def release_lead_endpoint(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:release"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    try:
        return release_lead(session, current_user.id, lead_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/leads/{lead_id}/mark-lost", response_model=LeadResponse)
def mark_lost_endpoint(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:mark_lost"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    try:
        return mark_lead_lost(session, current_user.id, lead_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── POST /leads/{id}/convert (T052) ──────────────────────────────────────────

class CustomerResponse(BaseModel):
    id: str
    lead_id: str
    company_name: str
    unified_code: Optional[str]
    region: str
    owner_id: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/leads/{lead_id}/convert", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def convert_lead_endpoint(
    lead_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("lead:convert"))],
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    visible_ids = get_visible_user_ids(session, current_user)
    if lead.owner_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权操作")

    try:
        return convert_lead(session, current_user.id, lead_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
