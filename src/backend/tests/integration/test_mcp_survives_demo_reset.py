"""T038 — US4：接入密钥必须挺过演示数据重置（spec 005 FR-030 / SC-005）.

`demo_reset_service` 用的是**显式删除列表**，所以 McpToken 默认即被保留 ——
本测试防的不是当下的缺陷，而是未来有人扩充那份列表时"顺手"把凭证表加进去。

一旦加了，线上表现是：访客在 /open 配好客户端，聊了 20 分钟，
连接毫无征兆地全部失效。属灾难级体验，且极难归因。
"""

from sqlmodel import Session, select

from app.models.mcp_token import McpToken
from tests.conftest import call_tool, issue_token, mcp_rpc, tool_payload


def _run_reset(eng):
    """按 demo_reset_service 的真实删除列表跑一次重置。"""
    from app.services import demo_reset_service

    with Session(eng) as session:
        demo_reset_service.reset_business_data(session)


def test_token_survives_business_data_reset(mcp_env):
    client, eng = mcp_env
    token = issue_token(client, "manager")

    # 重置前能调通
    assert mcp_rpc(client, token, "tools/list", {}).status_code == 200

    _run_reset(eng)

    # 重置后依然能调通 —— 连接不中断
    resp = mcp_rpc(client, token, "tools/list", {})
    assert resp.status_code == 200, "演示重置把接入密钥清掉了，访客连接会毫无征兆地断开"


def test_token_row_still_exists_after_reset(mcp_env):
    client, eng = mcp_env
    issue_token(client, "sales")

    with Session(eng) as s:
        before = len(s.exec(select(McpToken)).all())
    assert before >= 1

    _run_reset(eng)

    with Session(eng) as s:
        after = len(s.exec(select(McpToken)).all())

    assert after == before, "McpToken 被 demo_reset 删除了 —— 检查删除列表是否被误加"


def test_mcp_token_not_in_reset_delete_list():
    """静态守护：源码层面确认 McpToken 没被写进删除列表。"""
    import inspect

    from app.services import demo_reset_service

    src = inspect.getsource(demo_reset_service)
    assert "delete(McpToken)" not in src, (
        "McpToken 出现在 demo_reset_service 的删除路径里 —— "
        "凭证表禁止随业务数据一起清空（spec 005 FR-030）"
    )


def test_tools_still_work_after_reset(mcp_env):
    """重置后数据被重新种入，工具仍应正常返回。"""
    client, eng = mcp_env
    token = issue_token(client, "manager")

    _run_reset(eng)

    resp, parsed = call_tool(client, token, "search_leads", {})
    assert resp.status_code == 200
    assert isinstance(tool_payload(parsed), dict)
