# Phase 0 Research: MCP 开放平台

**Feature**: 005-mcp-open-platform
**Date**: 2026-08-13
**目的**: 闭合 plan.md Technical Context 中的技术未知项，为 Phase 1 设计提供已定选型。

---

## Decision 1：MCP 协议实现方式

**Decision:** 引入 **MCP 官方 Python SDK**，以其 Streamable HTTP ASGI 应用挂载到既有 FastAPI 之下；鉴权与限流通过挂载路径上的中间件/依赖完成，不进入 SDK 内部。

**Rationale:**

- SC-004 是硬指标：WorkBuddy / Claude Code / Claude Desktop / Cursor / Codex **五种异构客户端零改动接入**。协议协商、能力声明、错误码、SSE 分帧这些边角正是手写实现最容易翻车的地方，而翻车表现为"某个客户端连不上"，排查成本极高。
- 本 feature 只需 Tools 一类能力、无 Resources / Prompts / sampling、无服务端主动通知，SDK 的使用面很窄，引入成本低。
- 工具执行仍然回落到既有 `execute_tool`，SDK 只承担协议层，不侵入业务。

**Alternatives considered:**

| 方案 | 评估 | 结论 |
|---|---|---|
| **手写 JSON-RPC 端点**（只实现 `initialize` / `tools/list` / `tools/call` 三消息） | 约 150 行、零新依赖，与既有 `Depends` + slowapi 装饰器结合最自然 | ❌ 否决。省下的依赖不值 SC-004 的兼容性风险；但**保留为退路**：若 SDK 与 FastAPI 挂载方式冲突难解，可回退此方案，届时须逐客户端实测 |
| **FastMCP 独立进程** | 与主应用分离，部署与鉴权链路都要重建 | ❌ 否决。需第二个 systemd 服务与第二套 nginx 配置，运维面翻倍，且拿不到既有 DB session 与权限依赖 |

**✅ 实施期核对结果（2026-08-15，T001 已完成）：锁定 `mcp==2.0.0`。**

预警的版本变动确实发生了，三处必须按实测结论写代码：

1. **`mcp.server.fastmcp` 在 2.0 已移除。** 改用 `from mcp.server import MCPServer`，通过 `MCPServer.streamable_http_app(streamable_http_path=..., stateless_http=True, transport_security=...)` 得到一个可 mount 的 Starlette 子应用
2. **父应用必须自行启动 session manager。** 把 Starlette 子应用 mount 进 FastAPI 时，**子应用的 lifespan 不会被父应用执行**，直接调用会抛 `RuntimeError: Task group is not initialized`。修法：在 FastAPI 的 lifespan 里 `async with mcp_server.session_manager.run(): yield`
3. **必须显式配置 `TransportSecuritySettings`。** SDK 默认开启 DNS-rebinding 防护，未放行的 Host 一律返回 **421 Misdirected Request**（表现为"客户端连不上"，极易误判为网络问题）。须放行生产域名与本地回环

**鉴权注入方式（已实测通过）：** 在 mount 处包一层 ASGI 中间件，解析 `Authorization` 后把用户写入 `contextvars.ContextVar`；工具函数内读取该 contextvar。实测确认 contextvar 能从中间件穿透到工具函数体内（无状态模式下每请求独立上下文，无串号风险）。

验证脚本保留于本次会话的 scratchpad，四个验证点全部通过：子应用可挂载 / 握手成功 / 工具列举正确 / 用户身份成功穿透。

**无状态约束（跨方案通用）：** 端点采用无状态实现——每个请求独立完成鉴权，不维护服务端会话。理由：反代配置简单、水平扩展无障碍、演示环境重启不影响已配置的客户端。

---

## Decision 2：密钥形态与存储

**Decision:** 不透明随机串，格式 `sfa_ro_` + 32 字节随机值的 URL-safe 编码；库中**只存其 SHA-256 摘要**，明文仅在发放响应中返回一次。

**Rationale:**

- 不透明串比 JWT 更适合本场景：需要**可吊销**（FR-006）与**可计数**（FR-008），这两者都要求每次调用落库查询，JWT 的"无需查库"优势因而消失，反而多出密钥轮转的复杂度。
- 前缀 `sfa_ro_` 带来两个实际好处：日志与截图中可一眼辨识；为未来可能的 `sfa_rw_` 留出命名空间（写操作那一版，见 alignment §9.1）。
- 只存摘要在演示环境的实际风险收益近乎为零（数据本就虚构），但**它是要写进文章里给人看的工程示范**，形式必须正确。

**Alternatives considered:** JWT（自包含、免查库）→ 与吊销/计数需求冲突；明文入库 → 形式不正确，示范价值为负。

---

## Decision 3：限流实现

**Decision:** 复用既有 slowapi `Limiter`，为 MCP 相关端点新增一个 key 函数 `get_token_key`（返回密钥摘要前缀，未携带有效密钥时回落到 IP）；四个阈值全部存入 `SystemConfig`。

**Rationale:**

- 宪法原则三要求业务阈值可配置，spec 002 已建立"阈值进 SystemConfig + init_db 幂等补 key"的既有模式，直接沿用，不发明新机制。
- **绝不能复用 `/agent/chat` 的 `get_ip_user_key`**：MCP 是新入口，其调用特征（一次提问触发多次工具调用）与聊天完全不同，混用会让两边互相挤额度。这一点在 spec 002 的限流事故（2026-05-21，所有用户被合并到同一 IP 桶）之后尤其要守住。
- 演示区配额独立计量，与访客自领密钥的额度不共享（FR-021）。

**四个阈值（键名待 data-model 定稿）：** 每密钥每分钟 30、每密钥每日 500、每来源每日发放 5、演示区每小时 N。

**Alternatives considered:** 自建计数器 → 重复造轮子且要自己处理窗口与并发；不限流 → 聚合类工具会把演示服务器算力开放给全网。

---

## Decision 4：Live 演示区实现方式

**Decision:** 前端演示区不直连 MCP 端点，而是调用后端的一个**演示代理端点**；演示所用密钥由服务端持有（环境变量注入），前端全程不接触。响应以流式返回，前端逐步渲染"工具调用 → 返回结果"。

**Rationale:**

- FR-021 明确要求凭证不下发前端。若把演示 token 写进页面 JS，等于公开一把不受访客配额约束的钥匙，任何人都能抓下来绕过限流。
- 走后端代理还有一个副作用收益：演示区的调用可以独立计量与限流，耗尽时只影响演示区本身，不牵连正常访客（FR-021 后半句）。

**Alternatives considered:**

- 前端直连 MCP 端点 + 公开演示 token → 违反 FR-021，否决
- 预录假结果回放 → 违反 US3 的立意（"证明它真的在跑"），否决
- 服务端渲染静态快照 → 同上，且无法体现流式过程

**⚠️ 工作量提示：** 此决策使 `/open` 首页从静态页变为需服务端配合的动态页，排期时不可按静态页估算（spec checklist 已标注）。

---

## Decision 5：审计与可观测

**Decision:** **不新建审计表。** 仅在密钥记录上维护 `last_used_at` 与 `call_count`；异常（超额、密钥失效、越权）沿用既有应用日志。

**Rationale:**

- 宪法的"仅追加审计"针对的是**业务动作**。本 feature 全只读、不产生任何业务动作，无可审计的状态变更。
- spec 002 的 `chat_audit` 之所以要全量落库，是因为它承载 prompt 注入软拦截的取证需求；MCP 只读路径没有等价诉求。
- 密钥上的两个计数字段已足以支撑 FR-008（访客自查）与运营侧的"多少人真接入了"这一问题。

**Alternatives considered:** 新建 `mcp_call_audit` 表 → 每次调用一行写入，演示环境 30 分钟重置一次，数据既无留存价值又增加写放大，否决。

---

## Decision 6：站点工具目录的数据来源

**Decision:** `/open` 首页工具总览与 `/open/tools` 契约页**从后端动态拉取**（新增一个公开的工具目录端点），不在前端硬编码工具清单。

**Rationale:**

- FR-011 要求暴露范围由 `mode == "read"` 标记显式过滤、不维护人工清单。如果前端另行硬编码一份工具列表，等于把人工清单从后端搬到了前端，**未来新增工具时站点与实际能力必然漂移**——而这种漂移在一个"对外宣称完整契约"的平台上是可信度事故。
- 同一份数据同时供给：首页总览、契约页、`llms.txt`（FR-019）。三处一个来源，天然一致。

**Alternatives considered:** 前端硬编码 → 漂移风险，否决；构建期生成静态 JSON → 需要构建与后端联动，部署链路变复杂，收益仅省一次网络请求，否决。

---

## 遗留事项

无 NEEDS CLARIFICATION。

唯一需在实施期确认的是 Decision 1 中标注的 **SDK 版本与挂载方式**——这属于动手第一步的验证动作，不是需求层面的未知。
