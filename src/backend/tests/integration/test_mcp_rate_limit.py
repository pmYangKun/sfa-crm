"""T037 — US4：MCP 限流与内置 Copilot 完全隔离（spec 005 FR-026）.

背景：2026-05-21 线上事故 —— 限流 key 把所有用户合并到同一个桶，演示时
"一聊天就提示请求过多"。MCP 是新入口，如果复用 chat 的桶会重演同一类问题。
这组测试就是那次事故的守护网。
"""

import pytest
from sqlmodel import Session

from app.models.config import SystemConfig
from tests.conftest import call_tool, issue_token, mcp_rpc, tool_payload


@pytest.fixture(autouse=True)
def _reset_limiter():
    from app.services.mcp_rate_limit import limiter

    limiter.reset()
    yield
    limiter.reset()


def _set_minute_cap(eng, value: int) -> None:
    with Session(eng) as s:
        cfg = s.get(SystemConfig, "mcp_rate_per_minute")
        cfg.value = str(value)
        s.add(cfg)
        s.commit()


def test_per_token_minute_cap_enforced(mcp_env):
    client, eng = mcp_env
    _set_minute_cap(eng, 3)
    token = issue_token(client, "manager")

    for _ in range(3):
        assert mcp_rpc(client, token, "tools/list", {}).status_code == 200

    blocked = mcp_rpc(client, token, "tools/list", {})
    assert blocked.status_code == 429
    assert "频繁" in blocked.json()["detail"]


def test_limit_is_per_token_not_global(mcp_env):
    """一把密钥被打满，不能牵连另一把。"""
    client, eng = mcp_env
    _set_minute_cap(eng, 2)

    hot = issue_token(client, "sales")
    for _ in range(2):
        mcp_rpc(client, hot, "tools/list", {})
    assert mcp_rpc(client, hot, "tools/list", {}).status_code == 429

    fresh = issue_token(client, "manager")
    assert mcp_rpc(client, fresh, "tools/list", {}).status_code == 200


def test_mcp_exhaustion_does_not_touch_chat_limiter(mcp_env):
    """核心断言：两条限流桶必须互不相干。"""
    from app.services.rate_limiter import get_ip_user_key, get_token_key

    client, eng = mcp_env
    _set_minute_cap(eng, 1)

    token = issue_token(client, "manager")
    mcp_rpc(client, token, "tools/list", {})
    assert mcp_rpc(client, token, "tools/list", {}).status_code == 429

    # chat 的 key 函数产出的 key 与 MCP 的 key 不可能落进同一个桶
    class _FakeReq:
        headers = {"Authorization": f"Bearer {token}"}
        client = type("C", (), {"host": "1.2.3.4"})()

        def __init__(self):
            self.scope = {}

    fake = _FakeReq()
    assert get_token_key(fake).startswith("mcp:")
    assert not get_ip_user_key(fake).startswith("mcp:")


def test_thresholds_come_from_system_config(mcp_env):
    """宪法原则三：阈值可配置，不硬编码。"""
    client, eng = mcp_env
    _set_minute_cap(eng, 1)
    token = issue_token(client, "sales")

    assert mcp_rpc(client, token, "tools/list", {}).status_code == 200
    assert mcp_rpc(client, token, "tools/list", {}).status_code == 429

    from app.services.mcp_rate_limit import limiter

    limiter.reset()
    _set_minute_cap(eng, 50)
    for _ in range(5):
        assert mcp_rpc(client, token, "tools/list", {}).status_code == 200


def test_issue_endpoint_has_daily_cap_per_source(mcp_env):
    """FR-007：发放频率限制。"""
    client, eng = mcp_env
    with Session(eng) as s:
        cfg = s.get(SystemConfig, "mcp_issue_per_ip_per_day")
        cfg.value = "2"
        s.add(cfg)
        s.commit()

    assert client.post("/api/v1/mcp/tokens", json={"persona": "sales"}).status_code == 200
    assert client.post("/api/v1/mcp/tokens", json={"persona": "sales"}).status_code == 200

    third = client.post("/api/v1/mcp/tokens", json={"persona": "sales"})
    assert third.status_code == 429
    assert "上限" in third.json()["detail"]


def test_rate_limited_response_is_human_readable(mcp_env):
    """这句话会被 AI 助手直接念给用户听。"""
    client, eng = mcp_env
    _set_minute_cap(eng, 1)
    token = issue_token(client, "sales")

    mcp_rpc(client, token, "tools/list", {})
    detail = mcp_rpc(client, token, "tools/list", {}).json()["detail"]

    assert "上限" in detail or "频繁" in detail
    assert "请稍等" in detail or "恢复" in detail
