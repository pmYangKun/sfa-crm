"""T014 — US1 端到端：领密钥 → 握手 → 列工具 → 调用拿到真实数据.

对应 spec 005 US1 的 Independent Test：全程零注册。
"""

from tests.conftest import (
    call_tool,
    issue_token,
    mcp_parse,
    mcp_rpc,
    tool_payload,
)


def test_issue_token_requires_no_registration(mcp_env):
    client, _ = mcp_env
    resp = client.post("/api/v1/mcp/tokens", json={"persona": "manager"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["token"].startswith("sfa_ro_")
    assert body["persona"] == "manager"
    assert body["persona_label"] == "主管 · 陈队长"
    assert body["scope"] == "read"
    assert body["expires_at"]
    assert body["endpoint"].endswith("/api/v1/mcp")


def test_admin_persona_rejected(mcp_env):
    client, _ = mcp_env
    assert client.post("/api/v1/mcp/tokens", json={"persona": "admin"}).status_code == 400


def test_initialize_handshake(mcp_env):
    client, _ = mcp_env
    token = issue_token(client, "manager")

    resp = mcp_rpc(
        client, token, "initialize",
        {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "pytest", "version": "1.0"},
        },
    )
    assert resp.status_code == 200
    result = mcp_parse(resp)["result"]
    assert result["serverInfo"]["name"] == "sfa-crm"
    assert "tools" in result["capabilities"]


def test_tools_list_returns_nine(mcp_env):
    client, _ = mcp_env
    token = issue_token(client, "manager")

    parsed = mcp_parse(mcp_rpc(client, token, "tools/list", {}, rid=2))
    assert len(parsed["result"]["tools"]) == 9


def test_call_scan_team_warnings_returns_real_data(mcp_env):
    """US1 的核心验收：问出第一个答案。"""
    client, _ = mcp_env
    token = issue_token(client, "manager")

    resp, parsed = call_tool(client, token, "scan_team_warnings")
    assert resp.status_code == 200
    payload = tool_payload(parsed)
    assert isinstance(payload, dict)
    # 种子数据里有久未跟进的 lead，团队视角应能扫出东西
    assert payload, "主管身份扫描团队风险不应为空"


def test_call_search_leads_returns_seeded_companies(mcp_env):
    client, _ = mcp_env
    token = issue_token(client, "manager")

    _, parsed = call_tool(client, token, "search_leads", {})
    payload = tool_payload(parsed)
    blob = str(payload)
    assert "甲公司" in blob or "乙公司" in blob


def test_missing_token_is_rejected_with_readable_message(mcp_env):
    client, _ = mcp_env
    resp = client.post(
        "/api/v1/mcp/",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
        headers={"Accept": "application/json, text/event-stream",
                 "Content-Type": "application/json"},
    )
    assert resp.status_code == 401
    assert "/open" in resp.json()["detail"]


def test_invalid_token_is_rejected_with_readable_message(mcp_env):
    client, _ = mcp_env
    resp = mcp_rpc(client, "sfa_ro_totally-made-up", "tools/list", {})
    assert resp.status_code == 401
    detail = resp.json()["detail"]
    assert "无效" in detail and "/open" in detail


def test_expired_token_says_expired_not_just_invalid(mcp_env):
    """FR-028：过期与无效必须可区分——这句话会被 AI 助手念给用户听。"""
    from datetime import datetime, timedelta, timezone

    from sqlmodel import Session, select

    from app.models.mcp_token import McpToken

    client, eng = mcp_env
    token = issue_token(client, "sales")

    with Session(eng) as s:
        record = s.exec(select(McpToken)).first()
        record.expires_at = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        s.add(record)
        s.commit()

    resp = mcp_rpc(client, token, "tools/list", {})
    assert resp.status_code == 401
    assert "过期" in resp.json()["detail"]


def test_whoami_reports_status_without_leaking_secrets(mcp_env):
    client, _ = mcp_env
    token = issue_token(client, "sales")
    call_tool(client, token, "search_leads", {})

    body = client.get(
        "/api/v1/mcp/tokens/me", headers={"Authorization": f"Bearer {token}"}
    ).json()

    assert body["persona"] == "sales"
    assert body["days_remaining"] >= 6
    assert body["call_count"] >= 1
    # FR-029：不得泄露明文或完整摘要
    assert token not in str(body)
    assert "token_hash" not in body
