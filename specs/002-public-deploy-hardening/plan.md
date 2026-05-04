# Implementation Plan: 公网部署安全/治理硬化

**Branch**: `002-public-deploy-hardening` | **Date**: 2026-05-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-public-deploy-hardening/spec.md`

## Summary

把 SFA CRM demo 站推上公网前的硬化总闸：5 大块（Prompt Injection 基础防护 / 滥用限流 + LLM 全局熔断 / 半小时业务数据自动重置 + 前端倒计时 / 密钥与配置硬化 / CORS + 部署文档），覆盖 spec 002 的 4 个 P1 User Stories 与 35 条 FR。

**关键技术发现（决定 plan 走向）**：
1. **现有中间件已就绪**：APScheduler 在 [`src/backend/app/main.py:18-34`](d:/MyProgramming/cc/SFACRM/src/backend/app/main.py) 的 lifespan 已挂 3 个 daily cron job，加第 4 个 30min interval job 是一行；SlowAPI 在 [`src/backend/app/services/rate_limiter.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/services/rate_limiter.py) 已实例化，扩展 key 提取函数 + 给 chat 端点加装饰器即可——**本 feature 不引入任何新中间件**。
2. **SystemConfig 表是配置中心**：阈值参数（限流 / 熔断 / 重置周期 / 重置开关）全部走 [`src/backend/app/models/system_config.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/models/system_config.py) 现有 key-value 表新增 5 个 key，符合宪法第三条"业务规则可配置"。
3. **init_db 种子数据可独立抽函数**：[`src/backend/app/core/init_db.py:114-159`](d:/MyProgramming/cc/SFACRM/src/backend/app/core/init_db.py) 的"种入演示业务数据"代码块结构清晰，抽成 `seed_demo_business_data()` 后首次初始化与半小时重置共享同一份实现，避免实现两遍。
4. **Vercel AI SDK 流式响应迁后端代理 = 关键技术风险**：现状是前端 [`src/frontend/src/app/api/chat/route.ts`](d:/MyProgramming/cc/SFACRM/src/frontend/src/app/api/chat/route.ts) 拿 LLM Key 直接调 Anthropic SDK；改后端代理后流式 token 转发要用 SSE 或 chunked response。这是本 feature 唯一的"非平凡"技术决策，需 research.md 单独章节。

**整体技术路径**：保守、最小变更、不重写、不换栈。所有改造点都是在现有架构上加 hook / 加装饰器 / 加表，没有架构级翻新。

---

## Technical Context

**Language/Version**:
- 后端 Python 3.11 / FastAPI 0.110+ / SQLModel
- 前端 TypeScript 5 / Next.js 14 (App Router) / React 18

**Primary Dependencies**:
- 后端**新增**：`cryptography` (Fernet 对称加密 LLM API Key)
- 后端**复用**：`fastapi` / `sqlmodel` / `slowapi`（限流，已声明）/ `apscheduler`（调度，已声明）/ `python-jose` (JWT)
- 前端**新增**：无（倒计时组件用纯 React + setInterval，不引入计时库）
- 前端**复用**：`@vercel/ai`（AI SDK，本 feature 改用法但不换库）

**Storage**: 现有 SQLite（`src/backend/app/data/sfa_crm.db`，WAL 模式），**新增 2 张表**：`chat_audit` / `llm_call_counter`；**修改 1 张表**：`llm_config.api_key` 字段从明文改密文（无 schema 变更，只改读写路径）。

**Testing**:
- pytest 集成测试（**新增**）：限流命中 / 黑名单拦截 / 启动密钥校验 / 重置事务回滚 / Fernet 加解密
- e2e（**手工**）：公网部署 + 8 个 demo case + 限流脚本攻击 + 倒计时观察
- 不强制 LLM judge 类回归

**Target Platform**:
- 部署：腾讯云轻量 Linux VM（Ubuntu 22.04 / Debian 12）+ Nginx + Let's Encrypt HTTPS
- 客户端：现代浏览器（Chrome/Edge/Firefox 最近 2 版 + iOS Safari 14+ / Android Chrome 100+）

**Project Type**: Web application（前后端分离 + 公网静态部署），见 Project Structure。

**Performance Goals**:
- chat 端点响应延迟 ≤ 5s（含 LLM 首 token，SC-001）
- 限流 / 熔断判定 ≤ 50ms（不引入额外 IO）
- 半小时重置完整执行 ≤ 5s（SC-004）
- scheduler 触发偏差 ≤ 30s
- 前端倒计时与服务端偏差 ≤ 5s（每分钟 sync，SC-006）
- 启动密钥校验 ≤ 100ms

**Constraints**:
- **不引入新中间件**（无 Redis / Celery / RabbitMQ）—— 计数用 SQLite 原子表
- **不重写现有 spec 001 UI**——`ResetCountdownBadge` 仅挂载到 authenticated layout，不动其他组件
- **现有 SystemConfig 表结构稳定**——新增 5 个 key 不改表
- **chat_audit 写入不阻塞 LLM 响应**——写库异步 / fire-and-forget
- **Fernet rotate 工具 deferred**——本 feature 只实现首次加密
- **30 天清理 deferred**——本 feature 只实现 audit 写入

**Scale/Scope**:
- 新增/改动文件预估 14 个（10 后端 + 2 前端 + 2 部署文档）
- 后端**新增**：3 个 service 模块（`prompt_guard.py` / `llm_circuit_breaker.py` / `demo_reset_service.py`）+ 2 个 model（`chat_audit.py` / `llm_call_counter.py`）
- 后端**改动**：5 个文件（`agent.py` / `rate_limiter.py` / `init_db.py` / `main.py` / `config.py`）+ 1 个文件 `models/llm_config.py`（加解密包装）
- 前端**新增**：1 个组件（`ResetCountdownBadge.tsx`）
- 前端**改动**：1 个文件（`api/chat/route.ts` 改走后端代理）
- 部署**新增**：2 个文件（`docs/deploy.md` / `.env.production.example`）+ 改 1 个（`src/docker-compose.yml`）

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪法 v1.1.0（[.specify/memory/constitution.md](d:/MyProgramming/cc/SFACRM/.specify/memory/constitution.md)）的 6 条核心原则在本 feature 的适用性：

| 原则 | 适用性 | 检查结论 |
|------|--------|----------|
| 一、Ontology 优先 | 不适用 | 本 feature 不动业务对象 / 关系 / 状态机 / 事件 |
| 二、API 优先，统一操作层 | **强适用** | 限流 + 黑名单 + 熔断 + audit 全部在 API 层执行（`/agent/chat` 入口）；新增的 `/agent/llm-proxy` 仍走 FastAPI router 标准路径，GUI / Agent 共用同一组防护。✅ Pass |
| 三、规则可配置，不硬编码 | **强适用** | 所有阈值（限流 / 熔断 / 重置周期 / 重置开关）通过 `SystemConfig` 表的 5 个新增 key 配置；初始 jailbreak 黑名单词表也通过 `SystemConfig.prompt_guard_keywords` 存储而非代码 hardcode。✅ Pass |
| 四、数据完整性不可妥协 | 部分适用 | `chat_audit` 是只追加事件表；`llm_call_counter` 仅按小时桶累加；`llm_config.api_key` 加密后无法被绕过（即便 DB 泄露）。✅ Pass |
| 五、最小化销售录入负担 | 不适用 | 本 feature 不动销售数据录入流程 |
| 六、显式优于隐式 | 适用 | spec.md 35 FR / 27 AS / 8 Edge Cases / 12 SC 全部显式声明；启动密钥校验在 fail-fast 路径上明确报错而非默默 fallback。✅ Pass |

**8 项技术约束 vs 本 feature**：

| 约束 | 适用性 | 检查 |
|---|---|---|
| 数据层基于 Ontology | 不适用 | |
| 技术栈 Next.js + FastAPI + SQLite + Docker Compose | ✅ | 严格沿用 |
| API 层执行业务规则 | ✅ | 限流 / 黑名单 / 熔断 / 加解密在 API + service 层 |
| AI Agent 层（Vercel AI SDK + DB 配置 + Tool Use + Skill 检索） | ✅ | LLM Provider 配置仍存 DB（加密后），Tool Use 不变 |
| 速率限制（API 层、客户端不可绕过） | ✅ **强符合** | 限流装饰器在 API 层，黑名单在 LLM 调用前，熔断全站强制 |
| 审计追踪（动作仅追加，不物理删除业务对象） | ✅ | `chat_audit` 严格追加；半小时重置物理删的是**演示痕迹**业务数据（非用户真实数据，符合 demo 性质） |
| 配置驱动（大区规则 / 阈值 / Provider 配置） | ✅ **强符合** | 5 个新 SystemConfig key + 黑名单词表都走配置 |
| 系统集成（课时订单付款 → 商机更新；飞书） | 不适用 | |

**结论**：本 feature 与宪法**完全一致**且强符合"API 优先"、"规则可配置"、"速率限制"、"审计追踪"四项核心约束。无违宪项。Complexity Tracking 不需要填写。

---

## Project Structure

### Documentation (this feature)

```text
specs/002-public-deploy-hardening/
├── spec.md                # ✅ 已生成
├── plan.md                # ✅ 本文件
├── research.md            # ⏳ Phase 0 输出（关键技术决策，下一步产出）
├── data-model.md          # ⏳ Phase 1 输出（chat_audit / llm_call_counter / 新 SystemConfig key 结构）
├── quickstart.md          # ⏳ Phase 1 输出（人工验收步骤：部署 / 限流 / 重置 / 倒计时）
├── contracts/             # ⏳ Phase 1 输出
│   ├── api-contracts.md           # 新增端点契约（/agent/llm-proxy、/agent/demo-reset-status）
│   └── config-contracts.md        # 5 个新 SystemConfig key 与 .env 字段契约
├── checklists/
│   └── requirements.md    # ✅ specify 阶段输出
├── inputs/
│   └── alignment.md       # ✅ 业务对齐凭据
└── tasks.md               # ⏳ Phase 2 输出（/speckit.tasks 命令产出）
```

### Source Code (repository root)

实际项目布局为**前后端分离 Web 应用 + 部署文档**：

```text
src/
├── backend/                                       # FastAPI Python 后端
│   └── app/
│       ├── api/
│       │   └── agent.py                           # ⚠️ 改造：chat 端点加限流装饰器 / 黑名单前置 / 熔断检查；新增 /llm-proxy + /demo-reset-status；删除 /llm-config/full 中 api_key 字段
│       ├── core/
│       │   ├── config.py                          # ⚠️ 改造：新增 _assert_production_secrets() 启动校验；CORS_ORIGINS 默认值收紧
│       │   └── init_db.py                         # ⚠️ 改造：抽出 seed_demo_business_data()；agent_system_prompt 末尾加边界条款；新增 5 个 SystemConfig key 默认值
│       ├── services/
│       │   ├── prompt_guard.py                    # 🆕 黑名单关键词拦截（软拦截，软返回固定话术）
│       │   ├── llm_circuit_breaker.py             # 🆕 全局 LLM 调用熔断（SQLite 原子表计数器）
│       │   ├── demo_reset_service.py              # 🆕 业务数据 truncate + seed（事务包裹）
│       │   └── rate_limiter.py                    # ⚠️ 改造：get_user_id_key 改返回 (IP, user_id) 组合 key
│       ├── models/
│       │   ├── chat_audit.py                      # 🆕 chat 审计日志表
│       │   ├── llm_call_counter.py                # 🆕 全站 LLM 调用计数器（按小时桶）
│       │   └── llm_config.py                      # ⚠️ 改造：api_key 字段读写包 Fernet 加解密
│       └── main.py                                # ⚠️ 改造：lifespan 加第 4 个 scheduler job（demo_reset interval=30min）
└── frontend/
    └── src/
        ├── app/
        │   ├── api/
        │   │   └── chat/route.ts                  # ⚠️ 改造：从前端调 Anthropic SDK 改成转发到后端 /llm-proxy；处理 429 / 503 转友好气泡
        │   └── (authenticated)/
        │       └── layout.tsx                      # ⚠️ 微改：挂载 ResetCountdownBadge
        └── components/
            └── demo/
                └── ResetCountdownBadge.tsx        # 🆕 右下角倒计时小气泡（PC + mobile 同款，错开 chat launcher）

docs/
└── deploy.md                                      # 🆕 完整公网部署手册（Ubuntu 包 / .env / Nginx / certbot / 故障排查 / Fernet 备份警告）

.env.production.example                            # 🆕 生产 env 模板（含全部必填字段示意值）

src/
└── docker-compose.yml                             # ⚠️ 改造：JWT_SECRET 从硬编 → ${JWT_SECRET:?...}
```

**Structure Decision**: **Web application 结构**（与 spec 001 一致 — backend + frontend + 部署文档）。

**关键设计决策**（详见 research.md）：

1. **限流 key 选 (IP, user_id) 组合**：单看 user 容易被多 IP 绕，单看 IP 误伤共用 NAT 的多用户 → 组合 key 是平衡选择。
2. **LLM 全局熔断用 SQLite 原子表而非 Redis**：避免引入新依赖；按小时桶（`yyyymmddhh`）一行计数器；写入用 `INSERT OR REPLACE` + `UPDATE counter SET count = count + 1`，SQLite 行级锁足够这个量级（200/小时）。
3. **Prompt Guard 软拦截而非硬拦截**：黑名单命中返回友好提示而非封号；命中事件写 audit 供后续词表迭代——避免 B 端 PM 讨论 prompt 工程时的合法语境误伤（spec.md Edge Case 第 3 条）。
4. **半小时重置用 SQL 级 truncate 而非删 sqlite 文件**：reset-demo.bat 的"删 db / db-wal / db-shm 三件套"方案不复用——SQL 级 truncate 不影响 WAL/SHM、不需要重启 uvicorn 进程、可包事务、与 scheduler 长进程兼容。
5. **倒计时组件位置错开 chat launcher**：spec 001 的 chat launcher 在 `right:24/bottom:24`，倒计时挪到 `right:24/bottom:96`（垂直堆叠在 launcher 上方），不遮挡且视觉关联（同一右下角）。
6. **Fernet 加密的 key 来源**：env `LLM_KEY_FERNET_KEY`，dev 缺省 fallback 到固定 dev key（打 warning），生产缺省直接拒绝启动。Fernet 自身把 key version + 时间戳编进密文，未来 rotate 不会破坏老数据（但实际 rotate 工具 deferred）。
7. **后端 LLM 代理流式响应技术路径**：用 FastAPI `StreamingResponse` + chunked transfer，前端 Vercel AI SDK 通过 fetch 接收 chunked body 自行解析。SSE 备选方案见 research.md 决策记录。

## Complexity Tracking

> 无违宪项，本节留空。

---

## Phase Outputs

- ✅ **Phase 0** Outline & Research → `research.md`（下一步生成，集中解析 7 个关键技术决策）
- ⏳ **Phase 1** Design & Contracts → `data-model.md` + `contracts/api-contracts.md` + `contracts/config-contracts.md` + `quickstart.md`
- ⏳ **Phase 2** Tasks → `tasks.md`（由 `/speckit.tasks` 命令产出）

下一步：生成 `research.md`（Phase 0），然后 `data-model.md` / `contracts/` / `quickstart.md`（Phase 1）。
