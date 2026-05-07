"""Manager Pipeline API — spec 004 T021.

GET /api/manager/pipeline      → Pipeline 全表
GET /api/manager/team-rollup   → Team Rollup 聚合

DataScope 自动应用（manager 看团队，admin 看全公司，sales 看自己）.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.org import User
from app.services import manager_pipeline_service as mps

router = APIRouter()


VALID_SORTS = ("score_asc", "score_desc", "amount_desc", "close_date_asc")


@router.get("/manager/pipeline")
def get_pipeline(
    forecast_category: Optional[str] = Query(None),
    owner_id: Optional[str] = Query(None),
    sort_by: str = Query("score_asc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if sort_by not in VALID_SORTS:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_SORT", "message": f"sort_by 必须是 {VALID_SORTS} 之一"},
        )
    try:
        return mps.query_pipeline(
            current_user, session,
            forecast_category=forecast_category,
            owner_id=owner_id,
            sort_by=sort_by,
            limit=limit,
            offset=offset,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/manager/team-rollup")
def get_team_rollup(
    sort_by: str = Query("score_asc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return mps.query_team_rollup(
        current_user, session, sort_by=sort_by, limit=limit, offset=offset
    )
