"""MCP 开放平台的常规 REST 端点：密钥发放 / 自查 / 公开工具目录.

契约见 specs/005-mcp-open-platform/contracts/http-api.md §2-§4。
"""

import json
import time
from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.config import (
    CFG_MCP_DEMO_RATE_PER_HOUR,
    CFG_MCP_ISSUE_PER_IP_PER_DAY,
    MCP_PUBLIC_ENDPOINT,
)
from app.core.database import get_session
from app.core.mcp_auth import McpIdentity, require_mcp_token
from app.models.config import SystemConfig
from app.services import mcp_token_service, mcp_tool_registry
from app.services.agent_service import execute_tool

router = APIRouter()


class _DemoQuota:
    """演示区专用滑动窗口配额（FR-021）。

    刻意不复用 slowapi：演示区的额度必须与访客自领密钥的额度**完全隔离**，
    共用同一套限流器就等于两边互相挤兑。
    """

    def __init__(self) -> None:
        self._hits: deque[float] = deque()

    def allow(self, hourly_cap: int) -> bool:
        now = time.time()
        while self._hits and now - self._hits[0] > 3600:
            self._hits.popleft()
        if len(self._hits) >= hourly_cap:
            return False
        self._hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


demo_quota = _DemoQuota()


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


class DemoRequest(BaseModel):
    question_id: str


#: 演示区预置问句白名单（FR-033）。只接受标识，**不接受自由文本**——
#: 否则演示区就变成一个不受控的公开问答入口。
DEMO_QUESTIONS: dict[str, dict] = {
    "team_risk": {
        "question": "我团队哪几单有风险？",
        "persona": "manager",
        "tool": "scan_team_warnings",
        "args": {},
    },
    "top_deals": {
        "question": "今天我该重点看哪几单？",
        "persona": "manager",
        "tool": "top_attention_deals",
        "args": {"limit": 3},
    },
    "pipeline": {
        "question": "团队 pipeline 分布如何？",
        "persona": "manager",
        "tool": "forecast_category_distribution",
        "args": {},
    },
}


@router.get("/mcp/demo/questions")
def demo_questions():
    return {
        "questions": [
            {"id": qid, "question": q["question"], "tool": q["tool"]}
            for qid, q in DEMO_QUESTIONS.items()
        ]
    }


@router.post("/mcp/demo")
def run_demo(
    payload: DemoRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    """首页 live 演示区（FR-020 / FR-021）。

    凭证由服务端持有，**绝不下发前端**——写进页面 JS 就等于公开一把不受
    访客配额约束的钥匙，任何人都能抓下来绕过限流。

    配额独立于访客自领密钥（FR-021 后半句）：演示区被刷爆也不影响正常接入者。
    """
    spec = DEMO_QUESTIONS.get(payload.question_id)
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="演示区只接受预置问句。",
        )

    cfg = session.get(SystemConfig, CFG_MCP_DEMO_RATE_PER_HOUR)
    hourly_cap = int(cfg.value) if cfg else 60
    if not demo_quota.allow(hourly_cap):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="演示区当前有点忙，请稍后再试；不影响你自己领取密钥后的使用。",
        )

    def stream():
        yield _sse({"type": "question", "text": spec["question"]})
        yield _sse({"type": "tool_call", "tool": spec["tool"], "args": spec["args"]})

        demo_user = _resolve_demo_user(session, spec["persona"])
        if demo_user is None:
            yield _sse({"type": "error", "text": "演示环境未就绪（缺少演示账号）"})
            return

        try:
            result = execute_tool(
                session=session,
                tool_name=spec["tool"],
                args=spec["args"],
                user_id=demo_user.id,
            )
        except Exception:  # noqa: BLE001
            yield _sse({"type": "error", "text": "演示调用失败，请稍后再试"})
            return

        yield _sse({"type": "result", "payload": mcp_tool_registry.sanitize_result(result)})
        yield _sse({"type": "done"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False, default=str)}\n\n"


def _resolve_demo_user(session: Session, persona: str):
    """演示身份。优先用服务端持有的演示密钥，其次回落到 persona 映射的账号。"""
    from app.core import mcp_auth
    from app.core.config import MCP_DEMO_TOKEN
    from app.models.org import User

    if MCP_DEMO_TOKEN:
        record = mcp_token_service.lookup(session, MCP_DEMO_TOKEN)
        if record is not None and record.is_valid():
            return session.get(User, record.user_id)

    login = mcp_token_service.PERSONA_MAP.get(persona, (None, None))[0]
    if login is None:
        return None
    return session.exec(select(User).where(User.login == login)).first()


@router.get("/mcp/tools")
def public_tool_catalog():
    """公开工具目录：/open 站点与 llms.txt 的唯一数据源（research Decision 6）。

    内容由 TOOL_DEFINITIONS 按 mode=="read" 派生，站点不得另行硬编码，
    否则新增工具时站点与实际能力必然漂移。
    """
    catalog = mcp_tool_registry.to_public_catalog()
    return {"tools": catalog, "count": len(catalog), "endpoint": MCP_PUBLIC_ENDPOINT}
