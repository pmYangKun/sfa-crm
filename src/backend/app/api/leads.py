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
    convert_lead,
    create_lead_contacts,
    mark_lead_lost,
    release_lead,
)
from app.services.permission_service import get_visible_user_ids
from app.services.rate_limiter import limiter
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
    # spec 004 字段
    amount: Optional[float] = None
    close_date: Optional[str] = None
    forecast_category: Optional[str] = None


class LeadListResponse(BaseModel):
    total: int
    items: list[LeadResponse]


# spec 004: PUT /leads/{lead_id} 增强 — 接受 amount / close_date / forecast_category
FORECAST_CATEGORIES = ("进行中", "必赢", "大概率", "乐观估算", "已赢单", "已丢单")


class LeadUpdate(BaseModel):
    amount: Optional[float] = None
    close_date: Optional[str] = None
    forecast_category: Optional[str] = None


class MeddiccHistorySnapshotOut(BaseModel):
    snapshot_at: str
    meddicc_score: Optional[float]
    meddicc_completion: int
    forecast_category: Optional[str]
    amount: Optional[float]
    trigger_reason: str


class MeddiccHistoryResponse(BaseModel):
    lead_id: str
    snapshots: list[MeddiccHistorySnapshotOut]


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
        amount=getattr(lead, "amount", None),
        close_date=getattr(lead, "close_date", None),
        forecast_category=getattr(lead, "forecast_category", None),
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

    # Create the lead — assign to current user's private pool
    lead = Lead(
        company_name=body.company_name,
        unified_code=body.unified_code,
        region=body.region,
        source=body.source,
        owner_id=current_user.id,
        pool="private",
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
@limiter.limit("10/minute")
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


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    body: LeadUpdate,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    """spec 004: 更新 lead 的 amount / close_date / forecast_category.

    侧效应：
    - forecast_category 变更 → 写一行 lead_meddicc_history snapshot（trigger_reason='forecast_change'）
    - forecast_category 改成"已赢单" → 同步 lead.stage='converted' + converted_at
    - forecast_category 改成"已丢单" → 同步 lead.stage='lost' + lost_at
    """
    from datetime import datetime, timezone

    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # DataScope check
    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None and lead.owner_id not in visible_ids and lead.pool != "public":
        raise HTTPException(status_code=403, detail={"code": "DATA_SCOPE_DENIED", "message": "无数据可见权限"})

    old_forecast = lead.forecast_category

    # Validate + apply updates
    if body.forecast_category is not None:
        if body.forecast_category not in FORECAST_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_FORECAST_CATEGORY",
                    "message": f"forecast_category 必须是 {FORECAST_CATEGORIES} 之一",
                },
            )
        lead.forecast_category = body.forecast_category

        # 同步 stage（per alignment §3.2: stage 衍生于 forecast_category 极值）
        now_iso = datetime.now(timezone.utc).isoformat()
        if body.forecast_category == "已赢单" and lead.stage != "converted":
            lead.stage = "converted"
            if not lead.converted_at:
                lead.converted_at = now_iso
        elif body.forecast_category == "已丢单" and lead.stage != "lost":
            lead.stage = "lost"
            if not lead.lost_at:
                lead.lost_at = now_iso

    if body.amount is not None:
        if body.amount < 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_AMOUNT", "message": "amount 不能为负数"},
            )
        lead.amount = body.amount

    if body.close_date is not None:
        # 简单 ISO 校验
        cd = body.close_date
        if cd:
            try:
                # 接受 'YYYY-MM-DD' 或完整 ISO
                if "T" not in cd:
                    datetime.fromisoformat(cd + "T00:00:00")
                else:
                    datetime.fromisoformat(cd.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=400,
                    detail={"code": "INVALID_CLOSE_DATE", "message": "close_date 必须是 ISO 8601 日期"},
                )
        lead.close_date = cd

    session.add(lead)
    session.commit()
    session.refresh(lead)

    # forecast_category 变更 → snapshot
    if body.forecast_category is not None and body.forecast_category != old_forecast:
        try:
            from app.services.meddicc_history_service import write_snapshot
            write_snapshot(lead_id, "forecast_change", session, commit=True)
        except Exception:
            pass  # 不阻塞主流程

    return _lead_to_response(lead, session)


@router.get("/leads/{lead_id}/meddicc-history", response_model=MeddiccHistoryResponse)
def get_lead_meddicc_history(
    lead_id: str,
    since_days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    """spec 004: 趋势图数据源."""
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None and lead.owner_id not in visible_ids and lead.pool != "public":
        raise HTTPException(status_code=403, detail={"code": "DATA_SCOPE_DENIED", "message": "无数据可见权限"})

    from app.services.meddicc_history_service import get_history
    rows = get_history(lead_id, session, since_days=since_days, limit=limit)
    return MeddiccHistoryResponse(
        lead_id=lead_id,
        snapshots=[
            MeddiccHistorySnapshotOut(
                snapshot_at=r.snapshot_at,
                meddicc_score=r.meddicc_score,
                meddicc_completion=r.meddicc_completion,
                forecast_category=r.forecast_category,
                amount=r.amount,
                trigger_reason=r.trigger_reason,
            )
            for r in rows
        ],
    )


@router.post("/leads/{lead_id}/convert")
def convert_lead_endpoint(
    lead_id: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.create")),
):
    try:
        lead, customer = convert_lead(
            session, current_user.id, lead_id,
            ip=get_client_ip(request),
        )
        session.commit()
        return {"lead": _lead_to_response(lead, session), "customer_id": customer.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
