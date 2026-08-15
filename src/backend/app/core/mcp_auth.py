"""MCP 密钥鉴权（spec 005 FR-007 / FR-028 / FR-044）.

职责边界（宪法原则二）：本模块**只做一件事**——把一串密钥翻译成一个 User。
翻译完即交还给既有 RBAC / DataScope 体系，不新建任何权限逻辑。

三类失效必须可区分且人类可读——这些文案会被 AI 助手直接转述给用户，
是普通 REST API 没有的表达位（research.md、contracts/http-api.md §1）。
"""

import contextvars
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session

from app.core.config import MCP_PUBLIC_ENDPOINT
from app.core.database import get_session
from app.models.mcp_token import McpToken
from app.models.org import User
from app.services import mcp_token_service

_OPEN_PAGE = MCP_PUBLIC_ENDPOINT.replace("/api/v1/mcp", "/open")

INVALID_MSG = f"接入密钥无效。请到 {_OPEN_PAGE} 领取一把新的密钥。"
EXPIRED_MSG = f"接入密钥已过期。请到 {_OPEN_PAGE} 重新领取，然后更新你的 MCP 配置。"
REVOKED_MSG = f"接入密钥已被吊销。请到 {_OPEN_PAGE} 领取一把新的密钥。"
MISSING_MSG = (
    "缺少接入密钥。请在 MCP 配置的 headers 里加上 "
    f"Authorization: Bearer <密钥>，密钥可到 {_OPEN_PAGE} 免费领取。"
)


@dataclass
class McpIdentity:
    """一次 MCP 请求解析出的身份。"""

    user: User
    token: McpToken


# MCP 工具函数不在 FastAPI 依赖链里，拿不到 Request，
# 因此由 ASGI 中间件把身份写进 contextvar，工具执行时再读出来。
# 无状态模式下每个请求独立上下文，无串号风险（T001 已实测验证）。
current_identity: contextvars.ContextVar[Optional[McpIdentity]] = contextvars.ContextVar(
    "mcp_current_identity", default=None
)


def extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    value = authorization[7:].strip()
    return value or None


def resolve_identity(session: Session, plain_token: Optional[str]) -> McpIdentity:
    """把密钥翻译成身份。失败时抛出带可读文案的 401。"""
    if not plain_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=MISSING_MSG)

    record = mcp_token_service.lookup(session, plain_token)
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_MSG)

    if record.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=REVOKED_MSG)

    if not record.is_valid(datetime.now(timezone.utc)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=EXPIRED_MSG)

    user = session.get(User, record.user_id)
    if user is None or not user.is_active:
        # 演示账号被删或停用——按无效处理，不泄露内部状态
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_MSG)

    return McpIdentity(user=user, token=record)


def require_mcp_token(
    request: Request,
    session: Session = Depends(get_session),
) -> McpIdentity:
    """FastAPI 依赖：供 /mcp/tokens/me 等常规 REST 端点使用。"""
    plain = extract_bearer(request.headers.get("Authorization"))
    return resolve_identity(session, plain)
