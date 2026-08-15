"""T025/T026 — US2：身份决定可见范围（spec 005 FR-013 / FR-014）.

本 feature 的核心价值：同一个地址、同一套工具，换一把密钥看到的数据范围不同。
不需要为 MCP 新写权限逻辑 —— 全部由既有 DataScope 承担，这组测试守住这一点。
"""

from tests.conftest import call_tool, issue_token, mcp_parse, mcp_rpc, tool_payload


def _tool_names(client, token):
    parsed = mcp_parse(mcp_rpc(client, token, "tools/list", {}, rid=2))
    return {t["name"] for t in parsed["result"]["tools"]}


def _lead_ids_from_search(client, token):
    _, parsed = call_tool(client, token, "search_leads", {})
    payload = tool_payload(parsed)
    return {lead["id"] for lead in payload.get("leads", [])}


def test_sales_sees_only_own_leads(mcp_env):
    client, _ = mcp_env
    ids = _lead_ids_from_search(client, issue_token(client, "sales"))
    assert ids == {"l_s1_a", "l_s1_b"}
    assert "l_s2_a" not in ids, "销售不该看到别人名下的线索"


def test_manager_sees_whole_team(mcp_env):
    client, _ = mcp_env
    ids = _lead_ids_from_search(client, issue_token(client, "manager"))
    assert {"l_s1_a", "l_s1_b", "l_s2_a"} <= ids


def test_sales_result_is_proper_subset_of_manager_result(mcp_env):
    """US2 的 Independent Test：A ⊂ B 且 A ≠ B。"""
    client, _ = mcp_env
    sales_ids = _lead_ids_from_search(client, issue_token(client, "sales"))
    manager_ids = _lead_ids_from_search(client, issue_token(client, "manager"))

    assert sales_ids < manager_ids


def test_tool_list_is_identical_across_personas(mcp_env):
    """FR-014：差异只体现在数据，不体现在能力清单。"""
    client, _ = mcp_env
    sales_tools = _tool_names(client, issue_token(client, "sales"))
    manager_tools = _tool_names(client, issue_token(client, "manager"))

    assert sales_tools == manager_tools
    assert len(sales_tools) == 9


def test_cross_scope_lead_detail_is_denied(mcp_env):
    """越权探测：销售直接按 ID 取别人的线索，必须拿不到。"""
    client, _ = mcp_env
    sales = issue_token(client, "sales")

    _, parsed = call_tool(client, sales, "get_lead_detail", {"lead_id": "l_s2_a"})
    payload = tool_payload(parsed)
    assert payload["success"] is False
    assert "丙公司" not in str(payload)


def test_cross_scope_and_nonexistent_are_indistinguishable(mcp_env):
    """两种情况必须返回同一句话，否则可被用来探测线索是否存在。"""
    client, _ = mcp_env
    sales = issue_token(client, "sales")

    _, cross = call_tool(client, sales, "get_lead_detail", {"lead_id": "l_s2_a"})
    _, ghost = call_tool(client, sales, "get_lead_detail", {"lead_id": "no-such-lead"})

    assert tool_payload(cross) == tool_payload(ghost)


def test_cross_scope_followup_history_is_denied(mcp_env):
    client, _ = mcp_env
    sales = issue_token(client, "sales")

    _, parsed = call_tool(client, sales, "get_followup_history", {"lead_id": "l_s2_a"})
    assert tool_payload(parsed)["success"] is False


def test_cross_scope_meddicc_is_denied(mcp_env):
    client, _ = mcp_env
    sales = issue_token(client, "sales")

    _, parsed = call_tool(client, sales, "get_lead_meddicc", {"lead_id": "l_s2_a"})
    assert tool_payload(parsed)["success"] is False


def test_manager_can_read_team_member_lead(mcp_env):
    """反向确认：范围内的就该读得到，不能一刀切拒绝。"""
    client, _ = mcp_env
    manager = issue_token(client, "manager")

    _, parsed = call_tool(client, manager, "get_lead_detail", {"lead_id": "l_s2_a"})
    payload = tool_payload(parsed)
    assert payload["success"] is True
    assert "丙公司" in str(payload)


def test_team_scan_scope_differs_by_persona(mcp_env):
    client, _ = mcp_env

    _, sales_res = call_tool(client, issue_token(client, "sales"), "scan_team_warnings")
    _, mgr_res = call_tool(client, issue_token(client, "manager"), "scan_team_warnings")

    sales_blob = str(tool_payload(sales_res))
    mgr_blob = str(tool_payload(mgr_res))

    assert "丙公司" not in sales_blob
    assert "丙公司" in mgr_blob or "l_s2_a" in mgr_blob
