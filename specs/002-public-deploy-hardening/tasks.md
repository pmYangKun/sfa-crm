---
description: "Task list for 公网部署安全/治理硬化"
---

# Tasks: 公网部署安全/治理硬化

**Input**: Design documents from `/specs/002-public-deploy-hardening/`
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本 feature **强制要求 pytest 集成测试**——限流 / 黑名单 / 熔断 / 重置 / Fernet 加解密 / 启动校验等都是关键路径，必须有自动化覆盖。前端不强制新增 e2e；公网部署后按 quickstart.md A-G 人工走查。

**Organization**: Tasks 按 user story 分组。US1 是"零回归"型（不破坏现有 8 个 demo case），无新增 implementation；主要 work 在 US2 / US3 / US4。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无依赖）
- **[Story]**: US1 / US2 / US3 / US4
- **路径约定**：所有路径相对项目根 `d:/MyProgramming/cc/SFACRM/`

---

## Phase 1: Setup（共享基建）

**Purpose**: 引入新依赖 + 抽出可复用的种子数据函数 + 新增 6 个 SystemConfig 默认值。所有 user story 都依赖这些就位。

- [ ] **T001** [P] 在 [`src/backend/pyproject.toml`](src/backend/pyproject.toml) 的 `[project.dependencies]` 加入 `cryptography>=42.0`（Fernet 加解密用）；运行 `pip install -e ".[dev]"` 同步 lockfile。
- [ ] **T002** [P] 把 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 中"种入演示业务数据"的代码块（建线索 / 客户 / 跟进 / 联系人 / 关键事件）抽成独立函数 `seed_demo_business_data(session: Session) -> None`，放到 `src/backend/app/core/seed_data.py`（新文件）。`init_db()` 改为调用此函数。**关键约束**：抽出后既有的 `python -c "from app.core.init_db import init_db; init_db()"` 行为零变化（幂等检查 + 现有种子结构）。
- [ ] **T003** [P] 在 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 的"创建默认 SystemConfig 行"代码段，新增 6 个默认值（按 [`data-model.md § 3`](specs/002-public-deploy-hardening/data-model.md) 与 [`contracts/config-contracts.md § 1`](specs/002-public-deploy-hardening/contracts/config-contracts.md)）：
  - `llm_user_minute_limit = "10"`
  - `llm_user_daily_limit = "100"`
  - `llm_global_hourly_limit = "200"`
  - `demo_reset_enabled = "true"`
  - `demo_reset_interval_minutes = "30"`
  - `prompt_guard_keywords = "<JSON 数组，见 research.md Decision 3>"`

**Checkpoint Setup**: 依赖装好、种子函数抽出、配置默认值就位，可进 Foundational。

---

## Phase 2: Foundational（阻塞性基础）

**Purpose**: 数据模型 + 限流 key 改造 + 启动校验框架 + Fernet 加解密包装。这些是后续 user story 的基础。

**⚠️ CRITICAL**: 本 phase 完成前 US2/US3/US4 不可开始 implementation。

- [ ] **T004** [P] 创建 chat_audit 模型 `src/backend/app/models/chat_audit.py`，按 [`data-model.md § 1`](specs/002-public-deploy-hardening/data-model.md) 定义字段 + 3 个索引。SQLModel 类继承 `SQLModel, table=True`。
- [ ] **T005** [P] 创建 llm_call_counter 模型 `src/backend/app/models/llm_call_counter.py`，按 [`data-model.md § 2`](specs/002-public-deploy-hardening/data-model.md) 定义。主键是 `hour_bucket: str`。
- [ ] **T006** 在 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 的"创建索引"段加入 `chat_audit` 的 3 个索引；并在 import 顶部 import 新两张表的模型让 SQLModel.metadata 能 create_all。（依赖 T004, T005）
- [ ] **T007** 改造 [`src/backend/app/services/rate_limiter.py`](src/backend/app/services/rate_limiter.py)：把 `get_user_id_key` 函数改名为 `get_ip_user_key`，返回 `f"{request.client.host}:{user_id or 'anon'}"` 组合 key。同时**新增** `get_ip_only_key` 给未来场景留口子。`limiter` 实例使用 `key_func=get_ip_user_key`。
- [ ] **T008** [P] 在 `src/backend/app/core/security.py`（新文件）中实现 Fernet 加解密包装：
  - `get_fernet() -> Fernet` 函数（从 env 读 `LLM_KEY_FERNET_KEY`，dev fallback 固定 key + warning，生产缺失 raise SystemExit）
  - `encrypt_api_key(plaintext: str) -> str` 与 `decrypt_api_key(ciphertext: str) -> str`
  - 全部用 type hints + docstring
- [ ] **T009** 改造 [`src/backend/app/models/llm_config.py`](src/backend/app/models/llm_config.py)：
  - 字段 `api_key` schema 不变（TEXT NOT NULL）
  - 新增 `@property api_key_decrypted -> str`：透明解密
  - 新增 `set_api_key(plaintext: str)` 方法：透明加密写入
  - 不破坏现有 ORM 行为（既有写库代码会用 `set_api_key`，读库代码用 `api_key_decrypted`）
- [ ] **T010** 在 [`src/backend/app/core/config.py`](src/backend/app/core/config.py) 实现 `_assert_production_secrets()`，按 [`contracts/config-contracts.md § 5`](specs/002-public-deploy-hardening/contracts/config-contracts.md) 完整签名；同时把 `CORS_ORIGINS` 默认值改为 `["http://localhost:3000"]`（不再 `["*"]`）。
- [ ] **T011** 在 [`src/backend/app/main.py`](src/backend/app/main.py) lifespan startup 阶段最早调用 `_assert_production_secrets()`（在 scheduler 启动**之前**）。

**Checkpoint Foundational**: 模型 / 限流 key / 启动校验 / Fernet 全部就位，可启 US2/US3/US4 implementation。

---

## Phase 3: User Story 1 - 公网访客正常体验（Priority: P1）— 零回归型

**Goal**: 8 个 demo case 在防护就位后仍 100% 跑通；合法长输入（≤ 2000 字）+ 合法用户对话节奏（≤ 10/分 + ≤ 100/天）不被误拦。

**Independent Test**: 实施完所有 phase 后，sales01 登录跑 [`docs/copilot-cases.md`](docs/copilot-cases.md) 8 个 case，每个 3-5 轮对话内完成；无 429 / 无熔断 / 无误拦。

**说明**：US1 不产生独立 implementation 任务；其验收依赖 US2/US3/US4 完成后的回归。所有可能的 break 风险在各 phase 的 Independent Test 中已覆盖。

- [ ] **T012** [US1] 文档：在 [`docs/copilot-cases.md`](docs/copilot-cases.md) 标注每个 case 的预估"消息数"，便于实施完成后人工验证不超 100/天。

**Checkpoint US1**: 全部 phase 完成后跑 quickstart.md E.2 验证 8 个 case 全通。

---

## Phase 4: User Story 2 - 滥用拦截（Priority: P1）

**Goal**: 滥用脚本 / jailbreak 输入 / 全站爆量 → 全部被拦，正常用户体验不受影响。

**Independent Test**: 跑 quickstart.md B 节全部 5 步（输入超长 / 黑名单 / 1 分钟超频 / 全站熔断 / audit 表完整记录）。

### Tests for User Story 2 (TDD — 先写后实现)

> **NOTE**: 写完测试**确认 fail** 后再写实现。spec 002 强制 TDD，因为限流 / 拦截是关键安全路径。

- [ ] **T013** [P] [US2] 创建 [`src/backend/tests/integration/test_prompt_guard.py`](src/backend/tests/integration/test_prompt_guard.py)：测试 17 个黑名单关键词中至少 8 个被拦 + 合法长输入（"我想了解我们家产品的 system prompt 工程怎么做"——含 system prompt 但是合法语境）的拦截行为符合 spec。
- [ ] **T014** [P] [US2] 创建 [`src/backend/tests/integration/test_rate_limit_chat.py`](src/backend/tests/integration/test_rate_limit_chat.py)：模拟同 (IP, user) 1 分钟内发 11 条 → 第 11 条 429；同 (IP, user) 1 天内发 101 条 → 第 101 条 429（用 freezegun 模拟时间跳跃）。
- [ ] **T015** [P] [US2] 创建 [`src/backend/tests/integration/test_circuit_breaker.py`](src/backend/tests/integration/test_circuit_breaker.py)：把 `llm_global_hourly_limit` 临时设为 5 → 5 个不同账号各发 1 条 → 第 6 个返回 503；验证 chat_audit 表 `blocked_by='llm_circuit_breaker'`。
- [ ] **T016** [P] [US2] 创建 [`src/backend/tests/integration/test_chat_audit.py`](src/backend/tests/integration/test_chat_audit.py)：每条 chat（含被拦的）100% 写入 chat_audit；input_excerpt 截断 200 字 + 数字脱敏。

### Implementation for User Story 2

- [ ] **T017** [P] [US2] 实现 prompt_guard 服务 `src/backend/app/services/prompt_guard.py`：
  - `check(message: str) -> PromptGuardResult`：从 SystemConfig 读 keywords（带 60s 进程内缓存），子串包含检查（大小写不敏感）
  - 命中返回 `PromptGuardResult(blocked=True, fixed_response="抱歉，这超出了我作为 SFA CRM 助手的能力范围")`
  - 未命中返回 `PromptGuardResult(blocked=False)`
- [ ] **T018** [P] [US2] 实现 llm_circuit_breaker 服务 `src/backend/app/services/llm_circuit_breaker.py`：
  - `check_and_count(session: Session) -> CircuitState`：先 SELECT 当前 hour_bucket → 与配置的阈值比较 → 未超返回 `CircuitState(open=False)` 并 INSERT OR REPLACE + 累加；超阈值返回 `CircuitState(open=True, retry_after_seconds=<seconds_to_next_hour>)` 不累加
  - 累加逻辑用 SQL: `INSERT INTO llm_call_counter (hour_bucket, count, updated_at) VALUES (:h, 1, :now) ON CONFLICT (hour_bucket) DO UPDATE SET count = count + 1, updated_at = :now`
  - 注意：累加在 LLM 成功调用**之后**做（避免熔断把失败的 LLM 调用也计算在内）；熔断 check 在 LLM 调用**之前**
- [ ] **T019** [US2] 改造 [`src/backend/app/api/agent.py`](src/backend/app/api/agent.py) 的 `/chat` 端点：
  1. `ChatRequest.message` 字段加 `Field(..., max_length=2000)` Pydantic 约束
  2. 端点函数装饰 `@limiter.limit("10/minute;100/day")` —— SlowAPI 装饰器从 SystemConfig 读阈值（启动时绑定）
  3. 进入处理体后**按顺序**跑 4 个 gate：
     - prompt_guard.check → 命中：写 audit + 返回固定话术（200）
     - llm_circuit_breaker.check → open：写 audit + 返回 503 + Retry-After
     - SlowAPI 装饰器自动处理 minute/daily 限流（命中返回 429）
  4. 全部通过后调 LLM
  5. 流式响应完成的 `finally` 块：写 audit（含输出摘要）+ 调用 circuit_breaker 累加计数
- [ ] **T020** [US2] 加固 system prompt：在 [`src/backend/app/core/init_db.py`](src/backend/app/core/init_db.py) 的 `agent_system_prompt` 默认值末尾追加边界条款段（spec.md FR-004 原文）；**对已部署实例的迁移策略**：通过一次性 admin UI 操作刷新该 SystemConfig 行，而非自动覆盖运行时值（保护运维已自定义的 prompt）。
- [ ] **T021** [US2] 实现 chat_audit 写入工具 `src/backend/app/services/chat_audit_writer.py`：
  - `write_audit(session, user_id, ip, ua, input_text, output_text, blocked_by) -> None`
  - input_excerpt 截断 200 字 + 数字脱敏（连续数字 → `***`）
  - 用 `BackgroundTasks`（FastAPI 内置）异步写入，不阻塞响应
- [ ] **T022** [US2] 改造前端 [`src/frontend/src/app/api/chat/route.ts`](src/frontend/src/app/api/chat/route.ts)：识别后端 429 响应 → 转 SSE 形式的"友好气泡"chunk（`data: {"type":"text_delta","delta":"请求过于频繁，稍等片刻再试"}`）；识别 503 → 同模式转 "演示站当前调用量较高，请稍后再试"；识别 422 → 转气泡"消息过长，请精简"。

**Checkpoint US2**: 跑 T013-T016 全 4 个测试 + quickstart.md B 节 5 步全过。

---

## Phase 5: User Story 3 - 半小时数据自动重置 + 倒计时（Priority: P1）

**Goal**: 业务数据每 30 分钟自动归零，访客无感不被踢出，前端右下角倒计时正常运行。

**Independent Test**: 跑 quickstart.md C 节全部 6 步（创建数据 / 等待重置 / 数据归零 / 账号配置不动 / chat_audit 也清 / 时钟漂移纠正）。

### Tests for User Story 3 (TDD)

- [ ] **T023** [P] [US3] 创建 [`src/backend/tests/integration/test_demo_reset.py`](src/backend/tests/integration/test_demo_reset.py)：
  - 创建 5 条线索 / 3 条跟进 → 调 `reset_business_data()` → 验证业务表归零、user/role 表不动
  - 模拟事务中途抛异常 → 验证全部回滚不留半成品状态
  - `demo_reset_enabled=false` → reset 函数不执行 truncate

### Implementation for User Story 3

- [ ] **T024** [US3] 实现 `src/backend/app/services/demo_reset_service.py`：
  - `reset_business_data() -> None`：开事务 → 按外键依赖反序 DELETE 各业务表 → 调 `seed_demo_business_data()` 重新种入 → commit；中途异常 rollback
  - 内部维护模块级 `_last_reset_at: datetime`，每次成功 reset 后更新
  - 提供 `get_next_reset_at() -> datetime | None`：基于 `_last_reset_at + interval_minutes` 推算；`enabled=false` 返回 None
  - 写一行 audit log（用既有 audit 模块）
- [ ] **T025** [US3] 改造 [`src/backend/app/main.py`](src/backend/app/main.py) lifespan：在现有 3 个 cron job 后追加：
  ```python
  scheduler.add_job(
      reset_business_data, "interval", minutes=30,
      id="demo_reset", replace_existing=True
  )
  ```
  + startup 时立即跑一次 `reset_business_data()` 确保干净起步（如果 `demo_reset_enabled=true`）。
- [ ] **T026** [P] [US3] 在 [`src/backend/app/api/agent.py`](src/backend/app/api/agent.py) 新增 `GET /demo-reset-status` 端点，按 [`contracts/api-contracts.md § 2`](specs/002-public-deploy-hardening/contracts/api-contracts.md) 返回 `{enabled, next_reset_at, interval_minutes, server_time}`。
- [ ] **T027** [P] [US3] 创建前端组件 `src/frontend/src/components/demo/ResetCountdownBadge.tsx`：
  - 挂载时拉一次 `/api/v1/agent/demo-reset-status` → setState
  - useEffect 启动 setInterval 1s tick 倒计时
  - useEffect 启动 setInterval 60s 重新拉服务端时间纠正漂移
  - 剩余 < 60s 时背景从 `bg-slate-100` → `bg-orange-100`
  - `enabled=false` 时返回 null
  - PC 视口：`fixed right-6 bottom-24`（错开 chat launcher）
  - 移动视口：`fixed right-4 bottom-20`（错开金刚区 tabbar）
  - 用 spec 001 已实现的 `useIsMobile()` hook 切换样式
- [ ] **T028** [US3] 在 [`src/frontend/src/app/(authenticated)/layout.tsx`](src/frontend/src/app/(authenticated)/layout.tsx) 末尾挂载 `<ResetCountdownBadge />`。
- [ ] **T029** [US3] 在 [`src/frontend/src/app/m/(mobile-app)/layout.tsx`](src/frontend/src/app/m/(mobile-app)/layout.tsx) 末尾挂载 `<ResetCountdownBadge />`。

**Checkpoint US3**: T023 测试通过 + 手工跑 quickstart.md C 节 6 步全过。

---

## Phase 6: User Story 4 - 运维公网部署 + 密钥硬化（Priority: P1）

**Goal**: 干净 VM 按 deploy.md 一键部署，配置错误时启动拒绝，LLM API Key 永不出库到前端。

**Independent Test**: 跑 quickstart.md A + D + E 节（启动校验 / 密钥安全 / 公网部署）。

### Tests for User Story 4 (TDD)

- [ ] **T030** [P] [US4] 创建 [`src/backend/tests/integration/test_startup_secrets_check.py`](src/backend/tests/integration/test_startup_secrets_check.py)：
  - `ENV=production JWT_SECRET=change-me-in-production` → `_assert_production_secrets()` raise SystemExit
  - 缺 LLM_KEY_FERNET_KEY → 同
  - CORS_ORIGINS 含 `*` → 同
  - 全部正确 → 不 raise
- [ ] **T031** [P] [US4] 创建 [`src/backend/tests/integration/test_llm_key_encryption.py`](src/backend/tests/integration/test_llm_key_encryption.py)：
  - 写入明文 → DB 中是密文（`gAAAAAB...` 开头）→ 读取自动解密回明文
  - Fernet key 错误 → 解密 raise InvalidToken
- [ ] **T032** [P] [US4] 创建 [`src/backend/tests/integration/test_llm_proxy.py`](src/backend/tests/integration/test_llm_proxy.py)：
  - mock LLM provider → 验证后端代理流式转发正确
  - 响应中**不含** api_key 字段（GET /llm-config/full 抓响应验证）

### Implementation for User Story 4

- [ ] **T033** [US4] 改造 [`src/backend/app/api/agent.py`](src/backend/app/api/agent.py) 的 `GET /llm-config/full` 端点：响应 schema 删除 `api_key` 字段，新增 `api_key_present: bool` 字段（按 [`contracts/api-contracts.md § 3`](specs/002-public-deploy-hardening/contracts/api-contracts.md)）。
- [ ] **T034** [US4] 改造 [`src/backend/app/api/agent.py`](src/backend/app/api/agent.py) 的 `POST /llm-config` 写入端点：调用 `LlmConfig.set_api_key(plaintext)`（透明加密）。
- [ ] **T035** [US4] 实现后端 LLM 代理端点 `POST /api/v1/agent/llm-proxy` 在 [`src/backend/app/api/agent.py`](src/backend/app/api/agent.py)：
  - 入参按 [`contracts/api-contracts.md § 1`](specs/002-public-deploy-hardening/contracts/api-contracts.md)
  - 解密 LLM API Key（Fernet）→ 用 Anthropic SDK / OpenAI SDK 调 LLM provider
  - 用 `StreamingResponse(generator, media_type="text/event-stream")` 流式转发
  - generator 中 `async for chunk in provider_stream: yield f"data: {json.dumps(chunk)}\n\n"`
  - 端点本身也走 prompt_guard / 限流 / 熔断 4 个 gate（与 /chat 共享 service 层逻辑）
- [ ] **T036** [US4] 改造前端 [`src/frontend/src/app/api/chat/route.ts`](src/frontend/src/app/api/chat/route.ts)：从"前端拿 LLM Key 调 Anthropic SDK"改为"fetch('/api/v1/agent/llm-proxy', {body: JSON.stringify({messages, tools, options})})"，把响应 ReadableStream 转回 Vercel AI SDK 协议格式给客户端。
- [ ] **T037** [US4] 改造 [`src/docker-compose.yml`](src/docker-compose.yml)：
  - 删除 `JWT_SECRET=change-me-in-production` 硬编
  - 新增 `JWT_SECRET=${JWT_SECRET:?JWT_SECRET must be set}`
  - 新增 `LLM_KEY_FERNET_KEY=${LLM_KEY_FERNET_KEY:?LLM_KEY_FERNET_KEY must be set}`
  - 新增 `CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}`
  - 新增 `ENV=${ENV:-dev}`
- [ ] **T038** [P] [US4] 创建 [`.env.production.example`](.env.production.example)，按 [`contracts/config-contracts.md § 3`](specs/002-public-deploy-hardening/contracts/config-contracts.md) 写入。
- [ ] **T039** [P] [US4] 创建 [`docs/deploy.md`](docs/deploy.md)，覆盖 [`spec.md FR-033`](specs/002-public-deploy-hardening/spec.md) 全部要求：
  - 服务器准备（Ubuntu 22.04 包列表 + Python 3.11 + Node 18+）
  - .env 模板与 Fernet key 生成命令
  - Nginx 配置示例（`sfacrm.pmyangkun.com` server block + reverse proxy 到 :8000 / :3000 + `proxy_buffering off` 给 LLM 流式）
  - certbot HTTPS 申请命令
  - 首次启动顺序（init_db → uvicorn → next start → nginx reload）
  - 故障排查 checklist（502 / CORS / WebSocket / 流式中断）
  - **⚠️ LLM_KEY_FERNET_KEY 备份警告段**（spec.md FR-035 强约束）
- [ ] **T040** [US4] 创建 LLM Key 一次性迁移脚本 `src/backend/app/scripts/encrypt_existing_llm_keys.py`：读 llm_config 表 → 检测 api_key 是否已加密（Fernet 密文以 `gAAAAA` 开头）→ 未加密则用当前 LLM_KEY_FERNET_KEY 加密回写。仅在迁移时跑一次，写到 deploy.md 但不进自动化流程。

**Checkpoint US4**: T030-T032 全测试通过 + 手工跑 quickstart.md A + D + E 节全过。

### Deferred to spec 002 后续 / spec 003

以下任务在 2026-05-04 实施时**未完成**，留给后续迭代：

- **T033** /agent/llm-config/full 删除 api_key 字段：当前前端 chat/route.ts 仍依赖此字段调 Anthropic SDK，删除会破坏前端。必须与 T035 后端代理一起做才不破坏体验。
- **T035** 后端 LLM 代理 /agent/llm-proxy（流式响应）：research.md Decision 7 标记的"非平凡技术决策"。需要 prototype 验证 Vercel AI SDK 的 chunked transfer 协议，工作量较大且高风险。本次跳过，公网部署先靠 Phase 4 的限流 / 熔断 / audit 防护 + 现有 .api_key Fernet 加密保护（前端虽然能从 /llm-config/full 读到明文 api_key，但请求都走前端 SDK，仍受限流约束）。
- **T032** test_llm_proxy.py：依赖 T035 实现，一并 deferred。
- **T036** 前端 chat/route.ts 改走后端代理：依赖 T035。

**已实施替代防护**：
- API Key 在 DB 中是 Fernet 密文（T009）—— DB 备份泄露不会泄漏明文
- 限流 + 熔断 + 黑名单 + 输入长度限制 → 滥用脚本无法用 demo 站当免费 LLM 客户端
- chat_audit 全量记录可回溯

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 全量回归 + spec 002 端到端验收。

- [ ] **T999** [P] 跑 [`src/backend/tests/integration/`](src/backend/tests/integration/) 全量 pytest，确认 spec 001 既有测试 + spec 002 新增测试全绿。
- [ ] **T998** [P] 跑 [`src/frontend/tests/e2e/`](src/frontend/tests/e2e/) 全量 Playwright，确认 spec 001 的 e2e 不被本 spec 破坏。
- [ ] **T997** 按 [`quickstart.md`](specs/002-public-deploy-hardening/quickstart.md) A-G 7 节全部走一遍人工验收，每节 ✅ 后在 quickstart.md 末尾"验收 checklist 总览"打勾。
- [ ] **T996** 在项目主记忆 [`memory/project_main.md`](memory/project_main.md) 增加 spec 002 完成记录段（沿用 spec 001 的"已完成的里程碑"风格）。
- [ ] **T995** 更新仓库根 README.md（如有需要），标注"已支持公网部署"+ 链到 `docs/deploy.md`。

---

## Dependencies & Execution Order

### Phase 依赖

- **Setup (Phase 1)**：T001-T003 可并行；完成后进 Foundational
- **Foundational (Phase 2)**：T004-T011 大部分可并行（T006 依赖 T004+T005，T011 依赖 T010）；blocking US2/US3/US4
- **US1 (Phase 3)**：仅 T012 文档任务，与其他 phase 无依赖；最终验收依赖 US2/US3/US4 全完成
- **US2 (Phase 4)**：T013-T022，依赖 Foundational 完成
- **US3 (Phase 5)**：T023-T029，依赖 Foundational 完成；可与 US2 并行
- **US4 (Phase 6)**：T030-T040，依赖 Foundational 完成；可与 US2/US3 并行
- **Polish (Phase 7)**：T995-T999，依赖前面全部完成

### Within Each User Story

- **TDD**：测试任务（T013-T016 / T023 / T030-T032）必须**先写并确认 fail** 再写实现
- **Models 先于 Services**（T004-T005 → T017-T018 / T024 / T035）
- **Services 先于 Endpoints**（T017-T018 / T024 → T019 / T026 / T035）
- **后端先于前端**（T019 / T026 → T022 / T027 / T036）

### 并行机会

- T001-T003（Setup）3 个完全并行
- T004-T005（模型）+ T008（security）可并行；T007 改 rate_limiter 也独立
- T013-T016 + T023 + T030-T032（全部测试任务）可并行
- T017-T018（service 实现）独立可并行
- T026 / T027 / T035 不同文件可并行
- T037-T039（部署文档/配置）三个完全并行

---

## Parallel Example

```bash
# Setup phase 全部并行：
Task: "Add cryptography dependency to pyproject.toml"
Task: "Extract seed_demo_business_data() function from init_db.py"
Task: "Add 6 new SystemConfig defaults to init_db.py"

# Foundational 模型层并行：
Task: "Create chat_audit model"
Task: "Create llm_call_counter model"
Task: "Create Fernet encryption wrapper in core/security.py"

# US2/US3/US4 测试 TDD 并行：
Task: "Write test_prompt_guard.py"
Task: "Write test_rate_limit_chat.py"
Task: "Write test_circuit_breaker.py"
Task: "Write test_chat_audit.py"
Task: "Write test_demo_reset.py"
Task: "Write test_startup_secrets_check.py"
Task: "Write test_llm_key_encryption.py"
Task: "Write test_llm_proxy.py"
```

---

## Implementation Strategy

### 推荐路线（用 superpowers TDD）

1. **Setup**：T001-T003 一气呵成
2. **Foundational**：T004-T011；每个 task 跑相关测试（如有）
3. **US2 + US3 + US4 TDD 串行（最稳）或并行（最快）**：
   - 串行：先 US2 完整 → US3 完整 → US4 完整，每个 user story checkpoint 后人工跑 quickstart 对应章节
   - 并行：分发到 3 个 subagent 同时做（前提是同一会话里不同文件）
4. **Polish**：T995-T999 收尾

### MVP First（如果想最快上公网）

1. Setup + Foundational
2. US4 优先（运维上线 + 密钥硬化）→ 可先用占位符 prompt_guard / 不开重置 / 限流宽松上公网
3. 上公网后逐步上 US2 / US3

### Incremental Delivery

- 每完成一个 phase，跑对应 quickstart 章节验证 → commit 一组任务 → 继续下一个

---

## Notes

- **TDD 强制**：spec 002 是安全关键路径，每个 implementation task 之前对应的测试必须 fail 一次再实现
- **不引入新中间件**：Redis / Celery / RabbitMQ 都不要；坚守 plan.md 的约束
- **commit 节奏**：每完成一个 phase 或一组逻辑相关任务 commit 一次；不主动 push（按用户偏好"git 远程动作逐次授权"）
- **路径注意**：所有路径相对项目根 `d:/MyProgramming/cc/SFACRM/`
- **失败回退**：任何 task 跑测试反复 fail → 回到 plan.md / spec.md 修订，不在 task 层硬抗
