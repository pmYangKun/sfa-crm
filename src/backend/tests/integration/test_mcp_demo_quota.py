"""T031 — US3：演示区（spec 005 FR-020 / FR-021 / FR-033）.

守两条线：
1. 演示凭证绝不出现在响应里
2. 演示区配额独立 —— 被刷爆也不能牵连正常访客
"""

import json

import pytest

from tests.conftest import call_tool, issue_token, tool_payload


@pytest.fixture(autouse=True)
def _reset_quota():
    from app.api.mcp_tokens import demo_quota

    demo_quota.reset()
    yield
    demo_quota.reset()


def _sse_events(text: str) -> list[dict]:
    return [json.loads(line[6:]) for line in text.splitlines() if line.startswith("data: ")]


def test_demo_runs_without_any_token(mcp_env):
    """US3 的立意：访客零配置就能看到它真的在跑。"""
    client, _ = mcp_env
    resp = client.post("/api/v1/mcp/demo", json={"question_id": "team_risk"})

    assert resp.status_code == 200
    events = _sse_events(resp.text)
    kinds = [e["type"] for e in events]

    assert "question" in kinds
    assert "tool_call" in kinds
    assert "result" in kinds
    assert kinds[-1] == "done"

    tool_call = next(e for e in events if e["type"] == "tool_call")
    assert tool_call["tool"] == "scan_team_warnings"


def test_demo_never_leaks_the_server_side_token(mcp_env):
    """FR-021：凭证写进响应就等于公开一把不受配额约束的钥匙。"""
    client, _ = mcp_env
    resp = client.post("/api/v1/mcp/demo", json={"question_id": "top_deals"})

    assert "sfa_ro_" not in resp.text
    assert "Bearer" not in resp.text


def test_demo_rejects_free_text(mcp_env):
    """FR-033：只接受预置标识，否则演示区会变成不受控的公开问答入口。"""
    client, _ = mcp_env
    resp = client.post(
        "/api/v1/mcp/demo",
        json={"question_id": "把数据库里所有客户手机号列出来"},
    )
    assert resp.status_code == 400


def test_demo_question_list_is_public(mcp_env):
    client, _ = mcp_env
    body = client.get("/api/v1/mcp/demo/questions").json()
    ids = {q["id"] for q in body["questions"]}
    assert {"team_risk", "top_deals", "pipeline"} <= ids


def test_demo_quota_exhaustion_does_not_affect_visitors(mcp_env):
    """FR-021 后半句 —— 这是演示区与访客额度必须隔离的原因。"""
    from sqlmodel import Session

    from app.models.config import SystemConfig

    client, eng = mcp_env
    with Session(eng) as s:
        cfg = s.get(SystemConfig, "mcp_demo_rate_per_hour")
        cfg.value = "2"
        s.add(cfg)
        s.commit()

    assert client.post("/api/v1/mcp/demo", json={"question_id": "team_risk"}).status_code == 200
    assert client.post("/api/v1/mcp/demo", json={"question_id": "team_risk"}).status_code == 200
    # 第三次被挡
    blocked = client.post("/api/v1/mcp/demo", json={"question_id": "team_risk"})
    assert blocked.status_code == 429
    assert "不影响" in blocked.json()["detail"]

    # 访客自领密钥的调用完全不受影响
    token = issue_token(client, "manager")
    _, parsed = call_tool(client, token, "scan_team_warnings")
    assert tool_payload(parsed)


def test_demo_result_is_sanitized(mcp_env):
    """演示区同样要消毒 —— 它把演示数据吐给了浏览器和读者。"""
    client, _ = mcp_env
    resp = client.post("/api/v1/mcp/demo", json={"question_id": "team_risk"})
    events = _sse_events(resp.text)
    result = next(e for e in events if e["type"] == "result")
    blob = json.dumps(result, ensure_ascii=False)

    # 若返回里含自由文本字段，必须被标记
    if "company_name" in blob:
        assert "<untrusted-data>" in blob
