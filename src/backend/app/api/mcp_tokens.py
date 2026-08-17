"""MCP 开放平台的常规 REST 端点：密钥发放 / 自查 / 公开工具目录.

契约见 specs/005-mcp-open-platform/contracts/http-api.md §2-§4。
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session

from app.core.config import CFG_MCP_ISSUE_PER_IP_PER_DAY, MCP_PUBLIC_ENDPOINT
from app.core.database import get_session
from app.core.mcp_auth import McpIdentity, require_mcp_token
from app.models.config import SystemConfig
from app.services import mcp_token_service, mcp_tool_registry

router = APIRouter()


class IssueTokenRequest(BaseModel):
    persona: str


def _client_ip(request: Request) -> str:
    # ProxyHeadersMiddleware 已把 X-Forwarded-For 解析进 request.client
    return request.client.host if request.client else "unknown"


@router.post("/mcp/tokens", status_code=status.HTTP_200_OK)
def issue_token(
    payload: IssueTokenRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    """领取一把只读接入密钥。无需注册、无需登录（FR-002）。"""
    client_ip = _client_ip(request)

    # 发放频率限制（FR-007）：阈值走 SystemConfig，代码里不出现字面量
    cfg = session.get(SystemConfig, CFG_MCP_ISSUE_PER_IP_PER_DAY)
    daily_cap = int(cfg.value) if cfg else 5
    if mcp_token_service.count_issued_today(session, client_ip) >= daily_cap:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"今日领取次数已达上限（{daily_cap} 次），请明天再来。",
        )

    try:
        plain, record = mcp_token_service.issue_token(session, payload.persona, client_ip)
    except mcp_token_service.PersonaNotAllowed as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except mcp_token_service.PersonaAccountMissing as exc:
        # 显式报错，不静默降级到别的账号
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )

    return {
        "token": plain,
        "token_prefix": record.token_prefix,
        "persona": record.persona,
        "persona_label": mcp_token_service.persona_label(record.persona),
        "scope": record.scope,
        "expires_at": record.expires_at,
        "endpoint": MCP_PUBLIC_ENDPOINT,
    }


@router.get("/mcp/tokens/me")
def whoami(identity: McpIdentity = Depends(require_mcp_token)):
    """查询自身密钥状态。禁止返回明文或完整摘要（FR-029）。"""
    record = identity.token
    return {
        "token_prefix": record.token_prefix,
        "persona": record.persona,
        "persona_label": mcp_token_service.persona_label(record.persona),
        "scope": record.scope,
        "expires_at": record.expires_at,
        "days_remaining": mcp_token_service.days_remaining(record),
        "call_count": record.call_count,
        "last_used_at": record.last_used_at,
    }


@router.get("/mcp/tools")
def public_tool_catalog():
    """公开工具目录：/open 站点与 llms.txt 的唯一数据源（research Decision 6）。

    内容由 TOOL_DEFINITIONS 按 mode=="read" 派生，站点不得另行硬编码，
    否则新增工具时站点与实际能力必然漂移。
    """
    catalog = mcp_tool_registry.to_public_catalog()
    return {"tools": catalog, "count": len(catalog), "endpoint": MCP_PUBLIC_ENDPOINT}
