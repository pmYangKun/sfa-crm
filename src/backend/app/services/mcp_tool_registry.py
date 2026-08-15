"""MCP 工具注册表：从既有 TOOL_DEFINITIONS 派生对外暴露的只读工具（spec 005 FR-010 ~ FR-012）.

**过滤方式是程序化的**：`mode == "read"`。禁止手工维护白名单——
FR-011 的立意就是让未来新增工具不可能被误暴露，也不可能出现站点文档与
实际能力漂移（research.md Decision 6）。

6 个 `navigate_*` 工具（mode == "navigate"）天然被排除：它们不写库，只返回
目标页面地址 + 往 sessionStorage 塞预填数据，靠人在浏览器里点确认完成提交。
MCP 调用方没有浏览器，拿到的只会是一句无法执行的跳转指引。
"""

import json
from typing import Any, Callable

from app.services.agent_service import TOOL_DEFINITIONS

READ_MODE = "read"

#: 站点展示用的示例问法。与工具定义分离维护——它属于展示元数据，
#: 不应污染 agent 看到的 tool description。
EXAMPLE_QUESTIONS: dict[str, str] = {
    "search_leads": "北京大区有哪些线索？",
    "get_lead_detail": "XX 公司这单什么情况？",
    "get_followup_history": "这单最近都聊了什么？",
    "get_lead_meddicc": "这单 MEDDICC 打几分，弱在哪一维？",
    "list_customers": "我有哪些客户？",
    "scan_team_warnings": "我团队哪几单有风险？",
    "team_meddicc_summary": "团队健康度怎么样？",
    "top_attention_deals": "今天我该重点看哪几单？",
    "forecast_category_distribution": "团队 pipeline 分布如何？",
}

#: 会输出访客可编辑自由文本的字段，返回前必须消毒（FR-027）。
#: `get_followup_history` 是 9 个工具中唯一大量输出此类文本的。
_FREE_TEXT_FIELDS = {
    "content",
    "notes",
    "note",
    "remark",
    "description",
    "summary",
    "company_name",
    "title",
}

_MAX_FREE_TEXT_LEN = 500

_UNTRUSTED_OPEN = "<untrusted-data>"
_UNTRUSTED_CLOSE = "</untrusted-data>"


def get_read_tool_definitions() -> list[dict]:
    """对外暴露的工具定义，程序化过滤，顺序与 TOOL_DEFINITIONS 一致。"""
    return [t for t in TOOL_DEFINITIONS if t.get("mode") == READ_MODE]


def get_read_tool_names() -> list[str]:
    return [t["name"] for t in get_read_tool_definitions()]


def to_public_catalog() -> list[dict]:
    """供 /open 站点与 llms.txt 使用的公开契约（contracts/http-api.md §4）。"""
    catalog = []
    for t in get_read_tool_definitions():
        catalog.append(
            {
                "name": t["name"],
                "summary": t.get("description", "").split("。")[0],
                "description": t.get("description", ""),
                "parameters": t.get("parameters", {"type": "object", "properties": {}}),
                "example_question": EXAMPLE_QUESTIONS.get(t["name"], ""),
            }
        )
    return catalog


# ── 注入消毒（FR-027）────────────────────────────────────────────────────────


def _sanitize_text(value: str) -> str:
    """把访客可编辑文本标记为不可信并截断。

    演示环境的 GUI 对公众开放写入 —— 任何人都能在跟进记录里写一段伪装成指令的
    文字，随后被别的访客的 agent 读进上下文。被攻击的是**对方的 agent**（其上
    可能还挂着文件系统、邮件等其他 MCP），所以只读也必须消毒。
    """
    if not isinstance(value, str):
        return value
    truncated = value[:_MAX_FREE_TEXT_LEN]
    if len(value) > _MAX_FREE_TEXT_LEN:
        truncated += "…（已截断）"
    return f"{_UNTRUSTED_OPEN}{truncated}{_UNTRUSTED_CLOSE}"


def sanitize_result(payload: Any) -> Any:
    """递归消毒工具返回值中的自由文本字段。"""
    if isinstance(payload, dict):
        return {
            k: (_sanitize_text(v) if k in _FREE_TEXT_FIELDS and isinstance(v, str)
                else sanitize_result(v))
            for k, v in payload.items()
        }
    if isinstance(payload, list):
        return [sanitize_result(item) for item in payload]
    return payload


# ── 工具函数生成（FR-011）────────────────────────────────────────────────────

_PY_TYPES = {"string": "str", "integer": "int", "number": "float", "boolean": "bool"}


def _build_signature(params: dict) -> tuple[str, str]:
    """从 JSON Schema 生成 Python 形参列表与转发用的 dict 字面量。"""
    props: dict = params.get("properties", {}) or {}
    required: list = params.get("required", []) or []

    parts: list[str] = []
    forward: list[str] = []
    # 必填在前，可选在后，否则语法错误
    for name in sorted(props, key=lambda n: (n not in required, n)):
        py_type = _PY_TYPES.get(props[name].get("type", "string"), "str")
        if name in required:
            parts.append(f"{name}: {py_type}")
        else:
            parts.append(f"{name}: {py_type} | None = None")
        forward.append(f'"{name}": {name}')
    return ", ".join(parts), "{" + ", ".join(forward) + "}"


def build_tool_functions(dispatch: Callable[[str, dict], str]) -> list[tuple[Callable, dict]]:
    """为每个只读工具生成一个带真实签名的函数，交给 SDK 推导 schema。

    用代码生成而非手写 9 个包装函数：手写等于把人工白名单从后端搬到另一处，
    新增工具时必然漏（FR-011）。
    """
    built: list[tuple[Callable, dict]] = []

    for definition in get_read_tool_definitions():
        name = definition["name"]
        sig, forward = _build_signature(definition.get("parameters", {}))
        src = (
            f"def {name}({sig}) -> str:\n"
            f"    args = {forward}\n"
            f"    args = {{k: v for k, v in args.items() if v is not None}}\n"
            f"    return _dispatch({name!r}, args)\n"
        )
        namespace: dict = {"_dispatch": dispatch}
        exec(compile(src, f"<mcp_tool:{name}>", "exec"), namespace)
        fn = namespace[name]
        fn.__doc__ = definition.get("description", "")
        built.append((fn, definition))

    return built


def dump_result(payload: Any) -> str:
    """统一的返回序列化：先消毒再 JSON 化。"""
    return json.dumps(sanitize_result(payload), ensure_ascii=False, default=str)
