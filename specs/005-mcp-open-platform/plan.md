# Implementation Plan: MCP 开放平台（只读 MCP Server + `/open` 站点）

**Branch**: `005-mcp-open-platform` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/005-mcp-open-platform/spec.md`
**Alignment**: [inputs/alignment.md](./inputs/alignment.md)

## Summary

把系统内既有的 9 个只读 agent 工具，通过标准 MCP 协议暴露给任意外部 AI 助手；配套一个 `/open` 开放平台站点，让访客零注册领取密钥、复制配置、一分钟完成接入。

**技术路线一句话：** 不新建业务逻辑——MCP 端点只做"协议解包 → 密钥换身份 → 调用既有 `execute_tool` → 协议封包"，权限、数据范围、工具实现全部沿用现有实现。新增的只有一张密钥表、一个协议适配层、一个站点。

## Technical Context

**Language/Version**: Python 3.11+（后端）/ TypeScript 5.4 + React 18（前端）
**Primary Dependencies**: FastAPI ≥0.110、SQLModel ≥0.0.16、slowapi ≥0.1.9、uvicorn；Next.js 14.2.3（App Router）
**New Dependency**: MCP 协议实现库（选型见 research.md Decision 1）
**Storage**: SQLite（演示用），schema 由 `SQLModel.metadata.create_all()` 创建——**本仓库无 alembic，新表在服务启动时自动建，无需迁移脚本**
**Testing**: pytest（后端）+ Playwright（前端 PC/Mobile 双套 e2e）
**Target Platform**: Ubuntu 24.04 + nginx 反代 + systemd（腾讯云轻量服务器）
**Project Type**: Web application（backend + frontend 分离）
**Performance Goals**: 单次工具调用端到端 < 2s（聚合类工具 < 3s）；MCP 端点需支持流式响应不被缓冲
**Constraints**: 每密钥 30 次/分、500 次/日；密钥发放每来源 5 次/日；演示区独立配额；全部阈值须可配置
**Scale/Scope**: 演示级并发（数十并发连接）；新增 1 张表、约 3 个后端端点、4 个前端页面

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 原则 | 本 feature 的符合性 | 判定 |
|---|---|---|---|
| 一 | Ontology 优先的数据模型 | `mcp_token` 是**基础设施实体**（凭证），非业务对象，无生命周期状态机、无需事件溯源。业务对象一律不新增 | ⚠️ 有限豁免，见 Complexity Tracking |
| 二 | **API 优先，统一操作层** | **强对齐**。MCP 端点不得绕过 `execute_tool` 直接查库；GUI / 内置 Copilot / 外部 agent 三条路径共用同一执行入口与同一套权限校验 | ✅ |
| 三 | 业务规则可配置，不硬编码 | 三处限流阈值（每密钥分钟/日额度、发放频率、演示区配额）与密钥有效期 **MUST 存 SystemConfig**，不得写死在代码里 | ✅ 已转为设计约束 |
| 四 | 数据完整性不可妥协 | 本 feature 只读，不触及去重与抢占；速率限制在 API 层实施、客户端不可绕过 | ✅ |
| 五 | 最小化销售录入负担 | 不适用（无录入） | — |
| 六 | 显式优于隐式 | 工具暴露范围由既有 `mode == "read"` 标记**显式过滤**，不维护人工白名单；密钥失效、超额、越权三类响应均须有显式可读文案 | ✅ |

**技术约束符合性：**

- ✅ 技术栈不变（FastAPI + SQLModel + SQLite + Next.js）
- ✅ RESTful + GUI/Agent 共用端点：MCP 是新协议外壳，其下仍是同一批工具
- ✅ 速率限制在 API 层
- ⚠️ **审计追踪**：宪法要求"所有动作仅追加"。本 feature 全只读、不产生业务动作，故**不新建审计表**，仅在密钥记录上维护 `last_used_at` / `call_count`。见 research.md Decision 5

**Gate 结论：通过。** 一处有限豁免已在 Complexity Tracking 中记录理由。

## Project Structure

### Documentation (this feature)

```text
specs/005-mcp-open-platform/
├── inputs/
│   └── alignment.md      # 需求对齐稿（已封板）
├── spec.md               # 正式规格
├── plan.md               # 本文件
├── research.md           # Phase 0：技术选型与决策
├── data-model.md         # Phase 1：数据模型
├── contracts/
│   ├── mcp-tools.md      # 对外工具契约（9 个只读工具）
│   └── http-api.md       # 新增 HTTP 端点契约
├── quickstart.md         # Phase 1：本地起跑与验证
├── checklists/
│   └── requirements.md   # 规格质量清单（已全绿）
└── tasks.md              # Phase 2（由 /speckit.tasks 生成，本命令不产出）
```

### Source Code (repository root)

```text
src/backend/
├── app/
│   ├── models/
│   │   └── mcp_token.py            # 新增：密钥实体
│   ├── core/
│   │   └── mcp_auth.py             # 新增：Bearer → User 的依赖注入
│   ├── services/
│   │   ├── agent_service.py        # 既有：TOOL_DEFINITIONS / execute_tool（本 feature 只读取，不改逻辑）
│   │   ├── mcp_token_service.py    # 新增：发放 / 校验 / 吊销 / 计数
│   │   ├── mcp_tool_registry.py    # 新增：按 mode=="read" 过滤 + MCP schema 转换
│   │   ├── rate_limiter.py         # 既有：新增按密钥的 key 函数
│   │   └── demo_reset_service.py   # 既有：显式删除列表，mcp_token 不得加入
│   └── api/
│       ├── mcp.py                  # 新增：MCP 协议端点
│       └── mcp_tokens.py           # 新增：密钥发放 / 自查
│   └── main.py                     # 既有：挂载新 router
└── tests/
    ├── unit/                       # 密钥生命周期、工具过滤、限流 key
    ├── integration/                # 协议三消息、身份可见范围、演示重置存活
    └── contract/                   # 9 个工具的 schema 契约

src/frontend/
├── app/
│   └── open/
│       ├── page.tsx                # 首页五屏
│       ├── tools/page.tsx          # 工具契约
│       ├── docs/page.tsx           # 接入文档
│       └── llms.txt/route.ts       # 纯文本接入说明（Route Handler）
├── components/open/
│   ├── PersonaPicker.tsx           # 身份选择 + 原地展开配置
│   ├── ClientConfigTabs.tsx        # 5 客户端配置模板
│   └── ToolCatalog.tsx             # 工具卡片（首页总览与 /open/tools 复用）
└── tests/e2e/
    ├── pc-open-platform.spec.ts
    └── mobile-open-platform.spec.ts

docs/
└── deploy.md                       # 既有：nginx 模板需增补 MCP location 说明
```

**Structure Decision**: 沿用仓库既有的 backend / frontend 双目录结构（Option 2）。后端新增文件全部落在既有 `models / core / services / api` 四层里，不引入新分层；前端在 App Router 下新开 `app/open/` 路由段，组件收在 `components/open/`。**不新建顶层目录。**

## Phase 完成情况

| Phase | 产物 | 状态 |
|---|---|---|
| Phase 0 | research.md | ✅ 5 项决策全部闭合，无遗留 NEEDS CLARIFICATION |
| Phase 1 | data-model.md / contracts/ / quickstart.md | ✅ |
| Phase 1 | agent context 更新 | ✅ |
| Phase 2 | tasks.md | ⏭ 由 `/speckit.tasks` 生成 |

## 关键风险与对策

| 风险 | 说明 | 对策 |
|---|---|---|
| **流式响应被缓冲** | 2026-05-19 已踩过一次（AI 回复不流式），MCP 若复现表现为"工具调用卡住不返回"，更难查 | nginx `/api/v1/` location 增补 `proxy_buffering off`；部署文档同步；quickstart 里写明验证手法 |
| **演示重置误删密钥** | `demo_reset_service` 采用**显式删除列表**，故 `mcp_token` 默认即被保留——风险是未来有人"顺手"把它加进删除列表 | 加一条集成测试：跑一次重置后密钥仍可用；并在 `demo_reset_service` 相邻处写明"勿加入" |
| **协议兼容性** | SC-004 要求 5 种异构客户端零改动接入，手写协议易在边缘处翻车 | 采用官方 SDK（research Decision 1）；验收时逐客户端实测，不靠推断 |
| **演示区凭证泄露** | 服务端持有的演示 token 若下发到前端即等于公开一把不受限的钥匙 | 演示区走后端代理端点，前端永不接触 token；演示配额独立计量 |
| **限流阈值写死** | 违反宪法原则三 | 四个阈值全部进 SystemConfig，init_db 幂等补 key（沿用 spec 002 的既有模式） |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `mcp_token` 未按 Ontology 建模（无对象/关系/动作三元组，无事件溯源） | 它是访问凭证，属基础设施而非业务领域对象；其"状态变更"只有发放与吊销两种，且无业务规则依附 | 若强行按 Ontology 建模，需为一张纯凭证表引入动作事件表与派生状态计算，代码量翻倍且无任何审计或规则收益。参照既有 `LLMConfig` / `SystemConfig` 同属基础设施表、同样未走 Ontology 的先例 |
