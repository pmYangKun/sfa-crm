"""T013 — MCP 工具契约测试（contracts/mcp-tools.md「契约测试要求」）.

契约一旦对外发布就是承诺：站点上写了 9 个工具、参数长这样，客户端就会照着调。
这组测试守的是"实现不许偷偷跟契约漂移"。
"""

from tests.conftest import issue_token, mcp_parse, mcp_rpc

EXPECTED_TOOLS = {
    "search_leads",
    "get_lead_detail",
    "get_followup_history",
    "get_lead_meddicc",
    "list_customers",
    "scan_team_warnings",
    "team_meddicc_summary",
    "top_attention_deals",
    "forecast_category_distribution",
}

NAVIGATE_TOOLS = {
    "navigate_create_lead",
    "navigate_log_followup",
    "navigate_create_key_event",
    "navigate_convert_lead",
    "navigate_release_lead",
    "navigate_mark_lost",
}


def _list_tools(client, token):
    resp = mcp_rpc(client, token, "tools/list", {}, rid=2)
    assert resp.status_code == 200, resp.text
    parsed = mcp_parse(resp)
    return {t["name"]: t for t in parsed["result"]["tools"]}


def test_exposes_exactly_the_nine_contracted_tools(mcp_env):
    client, _ = mcp_env
    tools = _list_tools(client, issue_token(client, "manager"))
    assert set(tools) == EXPECTED_TOOLS


def test_no_navigate_tool_is_listed(mcp_env):
    client, _ = mcp_env
    tools = _list_tools(client, issue_token(client, "manager"))
    assert NAVIGATE_TOOLS.isdisjoint(set(tools))


def test_calling_an_unexposed_tool_is_rejected(mcp_env):
    """契约保证：按名调用 navigate_* 与调用不存在的工具同样对待。"""
    from tests.conftest import call_tool

    client, _ = mcp_env
    token = issue_token(client, "manager")
    _, parsed = call_tool(client, token, "navigate_create_lead", {"company_name": "X"})

    is_error = parsed.get("error") is not None or parsed.get("result", {}).get("isError")
    assert is_error, "未暴露的工具必须调不动"


def test_required_params_survive_schema_conversion(mcp_env):
    """必填标记不能在 TOOL_DEFINITIONS → MCP schema 的转换中丢失。"""
    client, _ = mcp_env
    tools = _list_tools(client, issue_token(client, "manager"))

    for name in ("get_lead_detail", "get_followup_history", "get_lead_meddicc"):
        schema = tools[name]["inputSchema"]
        assert "lead_id" in schema.get("properties", {})
        assert "lead_id" in schema.get("required", []), f"{name} 丢了必填标记"


def test_optional_params_are_not_required(mcp_env):
    client, _ = mcp_env
    tools = _list_tools(client, issue_token(client, "manager"))

    schema = tools["search_leads"]["inputSchema"]
    assert set(schema.get("properties", {})) == {"search", "region"}
    assert not schema.get("required")


def test_parameterless_tools_declare_empty_schema(mcp_env):
    client, _ = mcp_env
    tools = _list_tools(client, issue_token(client, "manager"))

    for name in ("scan_team_warnings", "team_meddicc_summary", "forecast_category_distribution"):
        assert not tools[name]["inputSchema"].get("required")


def test_public_catalog_matches_exposed_tools(mcp_env):
    """站点取数的目录端点必须与协议实际暴露的一致（research Decision 6）。"""
    client, _ = mcp_env
    catalog = client.get("/api/v1/mcp/tools").json()
    assert catalog["count"] == 9
    assert {t["name"] for t in catalog["tools"]} == EXPECTED_TOOLS

    tools = _list_tools(client, issue_token(client, "manager"))
    assert {t["name"] for t in catalog["tools"]} == set(tools)
