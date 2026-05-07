"""Forecast validation API — spec 004 T022.

POST /api/leads/{lead_id}/validate-forecast

Auth：登录即可，user 对该 lead 必须有读权限（lead.view + DataScope）。
LLM 限流由 spec 002 既有限流器接管（@limiter）。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.lead import Lead
from app.models.org import User
from app.services import forecast_validation_service as fv
from app.services.permission_service import get_visible_user_ids
from app.services.rate_limiter import limiter

router = APIRouter()


class ValidateForecastRequest(BaseModel):
    target_category: str


def _user_role(session: Session, user: User) -> str:
    """根据 DataScope 简单推断 role（manager 走 current_and_below）."""
    from app.models.auth import UserDataScope
    from sqlmodel import select
    rec = session.exec(
        select(UserDataScope).where(UserDataScope.user_id == user.id)
    ).first()
    if rec and rec.scope in ("all", "current_and_below"):
        return "manager"
    return "sales"


@router.post("/leads/{lead_id}/validate-forecast")
@limiter.limit("10/minute;100/day")
def validate_forecast(
    lead_id: str,
    body: ValidateForecastRequest,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # DataScope 检查
    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None and lead.owner_id not in visible_ids and lead.pool != "public":
        raise HTTPException(
            status_code=403,
            detail={"code": "DATA_SCOPE_DENIED", "message": "无权限校验此 lead"},
        )

    if body.target_category not in fv.VALIDATABLE_TARGETS:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_TARGET",
                "message": f"target_category 只能是 {fv.VALIDATABLE_TARGETS}（其他值不需要 AI 校验）",
            },
        )

    role = _user_role(session, current_user)

    try:
        result = fv.validate_forecast(
            lead_id, body.target_category, session, user_role=role
        )
    except Exception as e:
        # 任何异常都 fallback 到 abstain（不阻塞用户工作流）
        return {
            "verdict": "abstain",
            "reasoning": f"AI 暂时校验不上，已放行（{type(e).__name__}）",
            "suggested_category": None,
            "missing_dimensions": [],
            "cached": False,
            "timed_out": False,
        }
    return result.to_dict()
