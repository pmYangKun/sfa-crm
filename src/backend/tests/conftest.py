"""共享测试夹具。

spec 005 的 MCP 端点有个特殊之处：工具函数由 MCP SDK 直接调用，**不在 FastAPI
依赖链上**，所以拿不到 `Depends(get_session)`，用的是 `get_session_context()`。
因此除了常规的 `dependency_overrides`，还必须把 `app.api.mcp` 里那个直接导入的
上下文管理器也指向测试库。
"""

import json
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def _ts(days_ago: int = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


@pytest.fixture
def mcp_env(monkeypatch):
    """一个带演示数据的 MCP 测试环境。

    返回 (client, engine)。数据布局：
    - sales01（self_only）名下 2 条 lead
    - manager01（current_and_below）在上级节点，可见 sales01 + sales02 的 lead
    - sales02 名下 1 条 lead —— 用来验证销售看不到别人的单
    """
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, mcp_token, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401
    from app.models.auth import Permission, Role, RolePermission, UserDataScope, UserRole
    from app.models.config import SystemConfig
    from app.models.lead import Lead
    from app.models.org import OrgNode, User

    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _pragmas(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys = ON")
        cur.close()

    SQLModel.metadata.create_all(eng)

    with Session(eng) as s:
        s.add(OrgNode(id="root", name="总部", type="root"))
        s.flush()
        s.add(OrgNode(id="team1", name="一队", type="team", parent_id="root"))
        s.flush()

        s.add(User(id="u_mgr", login="manager01", password_hash="x", name="陈队长", org_node_id="team1"))
        s.add(User(id="u_s1", login="sales01", password_hash="x", name="王小明", org_node_id="team1"))
        s.add(User(id="u_s2", login="sales02", password_hash="x", name="李思远", org_node_id="team1"))
        s.flush()

        s.add(UserDataScope(user_id="u_mgr", scope="current_and_below"))
        s.add(UserDataScope(user_id="u_s1", scope="self_only"))
        s.add(UserDataScope(user_id="u_s2", scope="self_only"))

        perm = Permission(id="p_view", code="lead.view", module="lead", name="查看线索")
        s.add(perm)
        role = Role(id="r_all", name="系统管理员", is_system=True)
        s.add(role)
        s.flush()
        s.add(RolePermission(role_id="r_all", permission_id="p_view"))
        for uid in ("u_mgr", "u_s1", "u_s2"):
            s.add(UserRole(user_id=uid, role_id="r_all"))

        # 阈值配置
        for key, value in (
            ("mcp_token_ttl_days", "7"),
            ("mcp_rate_per_minute", "30"),
            ("mcp_rate_per_day", "500"),
            ("mcp_issue_per_ip_per_day", "5"),
        ):
            s.add(SystemConfig(key=key, value=value))

        # sales01 的两条 lead（其中一条 14 天无跟进 → 会触发 warning）
        s.add(Lead(
            id="l_s1_a", company_name="甲公司", region="华北", source="referral",
            owner_id="u_s1", stage="active", pool="private", forecast_category="必赢",
            meddicc_score=70, meddicc_completion=5, amount=100000,
            created_at=_ts(40), last_followup_at=_ts(30),
        ))
        s.add(Lead(
            id="l_s1_b", company_name="乙公司", region="华北", source="referral",
            owner_id="u_s1", stage="active", pool="private", forecast_category="进行中",
            meddicc_score=40, meddicc_completion=2, amount=50000,
            created_at=_ts(50), last_followup_at=_ts(40),
        ))
        # sales02 的一条 —— sales01 不该看见
        s.add(Lead(
            id="l_s2_a", company_name="丙公司", region="华北", source="referral",
            owner_id="u_s2", stage="active", pool="private", forecast_category="进行中",
            meddicc_score=30, meddicc_completion=1, amount=20000,
            created_at=_ts(60), last_followup_at=_ts(45),
        ))
        s.commit()

    @contextmanager
    def _fake_session_ctx():
        with Session(eng) as ses:
            yield ses

    def _override_session():
        with Session(eng) as ses:
            yield ses

    from app.api.mcp import reset_mcp_runtime
    from app.core.database import get_session
    from app.main import app

    # SDK 的 session manager 每个实例只能 run 一次，每个 TestClient 都会启一次
    # lifespan，所以每个测试都要重建运行时。
    reset_mcp_runtime()

    # 关键：MCP 工具执行路径不走依赖注入，必须单独指向测试库
    monkeypatch.setattr("app.api.mcp.get_session_context", _fake_session_ctx)
    app.dependency_overrides[get_session] = _override_session

    with TestClient(app) as client:
        yield client, eng

    app.dependency_overrides.clear()


# ── MCP 协议调用小工具 ───────────────────────────────────────────────────────

MCP_PATH = "/api/v1/mcp/"


def mcp_headers(token: str) -> dict:
    return {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def mcp_rpc(client, token: str, method: str, params: dict | None = None, rid: int = 1):
    body = {"jsonrpc": "2.0", "id": rid, "method": method}
    if params is not None:
        body["params"] = params
    return client.post(MCP_PATH, json=body, headers=mcp_headers(token))


def mcp_parse(resp):
    """streamable http 可能返回 SSE 帧，也可能返回纯 JSON。"""
    if "text/event-stream" in resp.headers.get("content-type", ""):
        for line in resp.text.splitlines():
            if line.startswith("data: "):
                return json.loads(line[6:])
        return None
    return resp.json()


def issue_token(client, persona: str) -> str:
    resp = client.post("/api/v1/mcp/tokens", json={"persona": persona})
    assert resp.status_code == 200, resp.text
    return resp.json()["token"]


def call_tool(client, token: str, name: str, arguments: dict | None = None, rid: int = 9):
    resp = mcp_rpc(
        client, token, "tools/call",
        {"name": name, "arguments": arguments or {}}, rid=rid,
    )
    parsed = mcp_parse(resp)
    return resp, parsed


def tool_payload(parsed: dict):
    """把 tools/call 的返回解成原始 dict。"""
    content = parsed["result"]["content"]
    return json.loads(content[0]["text"])
