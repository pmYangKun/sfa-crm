# 任务列表：SFA CRM

**输入文档**：`specs/master/` 下的全部设计文档
**前置条件**：plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/ ✅ | research.md ✅

**格式**：`[ID] [P?] [Story?] 描述（含文件路径）`
- **[P]**：可并行执行（不同文件，无依赖关系）
- **[Story]**：对应用户故事编号（US1~US14）

---

## Phase 1：项目初始化

**目的**：搭建前后端项目骨架，配置基础工具链

- [x] T001 创建 `backend/` 目录，初始化 Python 项目：`backend/pyproject.toml`（依赖：fastapi、sqlmodel、uvicorn、python-jose、slowapi、rapidfuzz、apscheduler）
- [x] T002 [P] 创建 `frontend/` 目录，初始化 Next.js 项目：`frontend/package.json`（依赖：next、ai、@ai-sdk/anthropic、typescript）
- [x] T003 [P] 创建 `docker-compose.yml`，定义 backend / frontend 两个服务，挂载 SQLite 数据卷
- [x] T004 [P] 创建 `backend/Dockerfile` 和 `frontend/Dockerfile`
- [x] T005 [P] 配置 backend 代码格式化工具：`backend/.ruff.toml`
- [x] T006 [P] 配置 frontend TypeScript 和 ESLint：`frontend/tsconfig.json`、`frontend/.eslintrc.json`

**检查点**：`docker-compose up --build` 可以启动，前后端服务均可访问

---

## Phase 2：基础设施（阻塞所有用户故事）

**目的**：数据库、认证、权限、配置加载——所有用户故事的前置依赖

**⚠️ 必须全部完成后才能开始任何用户故事**

### 数据库核心

- [x] T007 实现数据库连接和 PRAGMA 配置（WAL + foreign_keys + busy_timeout）：`backend/app/core/database.py`
- [x] T008 实现 OrgNode 模型（自引用树，`remote_side` 配置）：`backend/app/models/org.py`
- [x] T009 [P] 实现 User 模型（含 login、password_hash 字段）：`backend/app/models/org.py`（追加到同文件）
- [x] T010 实现 Role、Permission、UserRole、RolePermission 模型：`backend/app/models/auth.py`
- [x] T011 [P] 实现 UserDataScope 模型（scope 枚举 + node_ids JSON 字段）：`backend/app/models/auth.py`
- [x] T012 实现 SystemConfig 模型：`backend/app/models/config.py`
- [x] T013 实现数据库初始化脚本（建表 + 种入初始数据：内置角色、权限点、默认配置）：`backend/app/core/init_db.py`
- [x] T014 实现所有索引创建（参照 data-model.md 关键索引章节）：`backend/app/core/init_db.py`

### 认证与权限服务

- [x] T015 实现 JWT 生成和校验工具函数：`backend/app/core/auth.py`
- [x] T016 实现 FastAPI 依赖注入：`get_current_user()`、`require_permission(code)`：`backend/app/core/deps.py`
- [x] T017 实现 DataScope 过滤服务（OrgNode 内存树构建 + 子树遍历）：`backend/app/services/permission_service.py`
- [x] T018 实现审计日志写入工具函数（所有 Action 调用时记录）：`backend/app/models/audit.py` + `backend/app/services/audit_service.py`

### 应用配置

- [x] T019 实现应用设置加载（环境变量）：`backend/app/core/config.py`
- [x] T020 配置 FastAPI 主应用、错误处理中间件、CORS：`backend/app/main.py`
- [x] T021 实现登录接口 `POST /auth/login`：`backend/app/api/auth.py`

### 前端基础

- [x] T022 实现 API 客户端基础（fetch 封装 + JWT 自动注入）：`frontend/src/lib/api.ts`
- [x] T023 [P] 实现登录页面和认证 Context：`frontend/src/app/login/page.tsx`、`frontend/src/lib/auth-context.tsx`
- [x] T024 [P] 实现根布局（含 Chat 侧边栏占位）：`frontend/src/app/layout.tsx`
- [x] T025 [P] 定义共享 TypeScript 类型（Lead、Customer、Contact 等）：`frontend/src/types/index.ts`

**检查点**：登录接口可正常返回 JWT；权限校验 `require_permission()` 可正确阻断无权请求；DataScope 过滤返回正确数据集

---

## Phase 3：US1 — 线索录入与唯一性校验（P1）🎯 MVP起点

**目标**：销售可以录入新线索，系统自动做唯一性检测，阻断或预警重复企业

**独立验收**：录入有组织机构代码的线索 → 重复时被阻断；录入相似名称线索 → 主管收到预警；新线索出现在公共线索库

- [x] T026 实现 Lead 模型（含所有字段和约束）：`backend/app/models/lead.py`
- [x] T027 [P] 实现 Contact 模型：`backend/app/models/contact.py`
- [x] T028 [P] 实现 ContactRelation 模型：`backend/app/models/contact.py`
- [x] T029 实现唯一性检测服务（精确匹配 unified_code + rapidfuzz 模糊匹配 + 去法律后缀预处理）：`backend/app/services/uniqueness_service.py`
- [x] T030 实现 `POST /leads` 接口（调用唯一性检测，返回 201/202/409）：`backend/app/api/leads.py`
- [x] T031 实现 `GET /leads` 接口（支持 pool/stage/region/search 筛选，DataScope 过滤）：`backend/app/api/leads.py`
- [x] T032 [P] 实现 `GET /leads/{id}` 接口（含联系人、跟进、关键事件）：`backend/app/api/leads.py`
- [x] T033 [P] 实现联系人重复检测逻辑（wechat_id/phone 重复时自动创建 ContactRelation）：`backend/app/services/lead_service.py`
- [x] T034 前端：实现"我的线索"列表页（默认列 + 列显示/隐藏 + 筛选条件保存）：`frontend/src/app/leads/page.tsx`
- [x] T035 [P] 前端：实现线索录入表单（唯一性预警提示 UI）：`frontend/src/app/leads/new/page.tsx`
- [x] T036 [P] 前端：实现线索详情页（基本信息 + 联系人列表）：`frontend/src/app/leads/[id]/page.tsx`

**检查点**：US1 可独立运行和验证

---

## Phase 4：US2+US3 — 线索分配与公共池抢占（P1）

**目标**：主管可分配线索；销售可从公共线索库抢占；防外挂速率限制生效

**独立验收**：主管分配线索 → 私有池满时阻断；销售抢占 → 速率超限时账号锁定；并发抢占先到先得

- [x] T037 实现 SlowAPI 速率限制器（按用户 ID 计数）：`backend/app/services/rate_limiter.py`
- [x] T038 实现 `assign_lead` Action（权限校验 + 私有池上限校验 + 日志）：`backend/app/services/lead_service.py`
- [x] T039 实现 `POST /leads/{id}/assign` 接口：`backend/app/api/leads.py`
- [x] T040 实现 `claim_lead` Action（大区规则校验 + 速率限制 + 并发保护）：`backend/app/services/lead_service.py`
- [x] T041 实现 `POST /leads/{id}/claim` 接口（接入 SlowAPI 限速）：`backend/app/api/leads.py`
- [x] T042 实现大区抢占规则引擎（读取 SystemConfig.region_claim_rules，支持三种模式）：`backend/app/services/lead_service.py`
- [x] T043 实现 `release_lead` Action（手动释放）：`backend/app/services/lead_service.py`
- [x] T044 [P] 实现 `POST /leads/{id}/release` 和 `POST /leads/{id}/mark-lost` 接口：`backend/app/api/leads.py`
- [x] T045 前端：实现"公共线索库"页面（仅显示本大区，含抢占按钮）：`frontend/src/app/public-pool/page.tsx`
- [x] T046 [P] 前端：主管视图"团队线索"页面（含分配操作）：`frontend/src/app/leads/team/page.tsx`

**检查点**：US2+US3 可独立运行和验证

---

## Phase 5：US4 — 线索自动释放（P1）

**目标**：每日定时任务自动释放超期线索，通知原销售

**独立验收**：手动触发定时任务 → 超期线索进入公共池 → 原销售收到通知记录

- [x] T047 实现自动释放定时任务（APScheduler，每日运行，读取 SystemConfig 阈值）：`backend/app/services/release_service.py`
- [x] T048 将定时任务注册到 FastAPI lifespan：`backend/app/main.py`
- [x] T049 [P] 实现通知写入（释放时写 notification 记录，后续前端轮询）：`backend/app/models/notification.py` + `backend/app/services/release_service.py`

**检查点**：US4 可通过手动调用 release_service 验证

---

## Phase 6：US5 — 线索转化为客户（P1）

**目标**：课时订单系统付款事件自动触发转化；销售可手动兜底；联系人/跟进/关键事件全部迁移

**独立验收**：调用 Webhook → 线索转化 → Customer 记录创建 → 联系人迁移 → 线索从活跃列表消失

- [x] T050 实现 Customer 模型：`backend/app/models/customer.py`
- [x] T051 实现 `convert_lead` Action（创建 Customer + 迁移联系人/跟进/关键事件 + 更新 lead.stage）：`backend/app/services/lead_service.py`
- [x] T052 实现 `POST /leads/{id}/convert` 接口（手动兜底）：`backend/app/api/leads.py`
- [x] T053 实现 `POST /webhooks/order-payment` Webhook（解析付款事件，匹配线索，触发 convert_lead）：`backend/app/api/webhooks.py`
- [x] T054 实现 `GET /customers` 和 `GET /customers/{id}` 接口（含派生的转化窗口状态）：`backend/app/api/customers.py`
- [x] T055 前端：实现"我的客户"列表页：`frontend/src/app/customers/page.tsx`
- [x] T056 [P] 前端：实现客户详情页（含转化窗口倒计时、来源线索链接）：`frontend/src/app/customers/[id]/page.tsx`

**检查点**：US5 可独立运行和验证

---

## Phase 7：US6+US7 — 跟进记录与关键事件（P2）

**目标**：销售可录入跟进；录入后自动更新 last_followup_at；可录入送书、拜访KP 等关键事件

**独立验收**：录入跟进 → last_followup_at 更新；录入送书 KeyEvent → 可后续更新阅读状态；attended_small_course 触发转化

- [x] T057 实现 FollowUp 模型：`backend/app/models/followup.py`
- [x] T058 实现 KeyEvent 模型（含 payload JSON 字段）：`backend/app/models/key_event.py`
- [x] T059 实现 `log_followup` Action（创建 FollowUp + 更新 last_followup_at）：`backend/app/services/lead_service.py`
- [x] T060 实现 `POST /leads/{id}/followups`、`POST /customers/{id}/followups` 接口：`backend/app/api/followups.py`
- [x] T061 [P] 实现 `GET /leads/{id}/followups`、`GET /customers/{id}/followups` 接口：`backend/app/api/followups.py`
- [x] T062 实现关键事件录入（record_book_sent / confirm_small_course / record_big_course Actions）：`backend/app/services/lead_service.py`
- [x] T063 实现 `POST /leads/{id}/key-events`、`POST /customers/{id}/key-events` 接口：`backend/app/api/key_events.py`
- [x] T064 [P] 实现 `PATCH /key-events/{id}` 接口（更新 payload 字段，如确认阅读）：`backend/app/api/key_events.py`
- [x] T065 前端：在线索/客户详情页中实现跟进记录录入表单和列表：`frontend/src/app/leads/[id]/page.tsx`、`frontend/src/app/customers/[id]/page.tsx`
- [x] T066 [P] 前端：实现关键事件录入 UI（送书、拜访KP、购买大课）：`frontend/src/components/leads/key-event-form.tsx`

**检查点**：US6+US7 可独立运行和验证

---

## Phase 8：US8 — 14天转化窗口提醒（P2）

**目标**：客户创建后第7天、第12天推送提醒；第14天推送"窗口已关闭"；不修改客户字段

**独立验收**：手动触发提醒任务 → 窗口内客户生成提醒记录；窗口外无记录；客户字段无变化

- [x] T067 实现转化窗口检测定时任务（每日运行，派生判断逻辑）：`backend/app/services/customer_service.py`
- [x] T068 将窗口提醒任务注册到 APScheduler：`backend/app/main.py`
- [x] T069 前端：客户详情页"转化窗口"区块（仅窗口期内显示，含倒计时和课时购买状态）：`frontend/src/app/customers/[id]/page.tsx`

**检查点**：US8 可独立验证

---

## Phase 9：US9 — 联系人管理（P2）

**目标**：销售可管理联系人；重复检测自动创建 ContactRelation；支持手动建立人脉关系

**独立验收**：添加重复微信号联系人 → 自动创建 ContactRelation + 通知；手动建立关系 → 触发冲突检测

- [x] T070 实现 `add_contact` Action（含重复检测 + 自动创建 ContactRelation）：`backend/app/services/lead_service.py`
- [x] T071 实现 `POST /leads/{id}/contacts`、`POST /customers/{id}/contacts` 接口：`backend/app/api/contacts.py`
- [x] T072 [P] 实现 `link_contacts` Action 和 `POST /contacts/link` 接口：`backend/app/api/contacts.py`
- [x] T073 前端：联系人管理 UI（添加联系人、标记决策人、建立关系）：`frontend/src/components/contacts/contact-panel.tsx`

**检查点**：US9 可独立验证

---

## Phase 10：US10 — 日报自动生成与提交（P2）

**目标**：每日定时生成日报草稿；销售确认提交；主管可查看团队日报

**独立验收**：手动触发日报生成 → 有跟进记录时生成草稿 → 销售可编辑提交 → 主管可查看

- [x] T074 实现 DailyReport 模型：`backend/app/models/report.py`
- [x] T075 实现日报生成定时任务（汇总当天 FollowUp，生成草稿）：`backend/app/services/report_service.py`
- [x] T076 将日报任务注册到 APScheduler：`backend/app/main.py`
- [x] T077 实现 `submit_daily_report` Action 和 `POST /reports/daily/{id}/submit` 接口：`backend/app/api/reports.py`
- [x] T078 [P] 实现 `GET /reports/daily`、`GET /reports/daily/today-draft`、`GET /reports/team` 接口：`backend/app/api/reports.py`
- [x] T079 前端：实现"我的日报"页面（草稿编辑 + 提交 + 历史）：`frontend/src/app/reports/page.tsx`
- [x] T080 [P] 前端：主管"团队日报"页面：`frontend/src/app/reports/team/page.tsx`

**检查点**：US10 可独立验证

---

## Phase 11：US11 — 数据可见性与权限（P1）

**目标**：所有接口同时执行功能权限和 DataScope 校验；转移后立即失去可见性

**独立验收**：用 sales 账号访问他人线索 → 403；用 manager 账号查看团队 → 正确范围；转移线索后原销售立即看不到

- [x] T081 在所有 Lead/Customer/FollowUp 接口中接入 `require_permission()` 校验：`backend/app/api/leads.py`、`backend/app/api/customers.py` 等
- [x] T082 在所有列表接口中接入 DataScope 过滤（`permission_service.apply_data_scope()`）：`backend/app/services/permission_service.py`
- [x] T083 实现 `reassign_customer` Action 和 `POST /customers/{id}/reassign` 接口：`backend/app/api/customers.py`
- [x] T084 前端：根据当前用户角色动态渲染菜单（销售/主管/Admin 三套菜单）：`frontend/src/app/layout.tsx`、`frontend/src/components/nav/sidebar.tsx`

**检查点**：US11 权限体系全面生效

---

## Phase 12：US12+US13+US14 — Admin 管理功能（P2）

**目标**：Admin 可管理组织架构、用户、角色权限

**独立验收**：新增 OrgNode → 用户挂载后数据范围正确；新增用户并分配角色 → 权限生效；自定义角色权限调整立即生效

- [x] T085 实现组织管理接口（OrgNode CRUD + 停用校验）：`backend/app/api/org.py`
- [x] T086 实现用户管理接口（创建/停用用户 + 角色分配 + DataScope 配置）：`backend/app/api/users.py`
- [x] T087 [P] 实现角色权限管理接口（角色 CRUD + 权限点配置）：`backend/app/api/roles.py`
- [x] T088 [P] 实现系统配置接口（`GET /config`、`PATCH /config`）：`backend/app/api/config.py`
- [x] T089 [P] 实现操作日志接口（`GET /audit-logs`）：`backend/app/api/audit.py`
- [x] T090 前端：Admin 组织管理页面（OrgNode 树可视化 + 用户挂载）：`frontend/src/app/admin/org/page.tsx`
- [x] T091 [P] 前端：Admin 用户管理页面（用户列表 + 角色分配 + DataScope 配置）：`frontend/src/app/admin/users/page.tsx`
- [x] T092 [P] 前端：Admin 权限管理页面（角色列表 + 权限点配置）：`frontend/src/app/admin/roles/page.tsx`
- [x] T093 [P] 前端：Admin 系统配置页面（含 LLM 配置 + Skill 管理入口）：`frontend/src/app/admin/config/page.tsx`
- [x] T094 [P] 前端：操作日志页面：`frontend/src/app/admin/logs/page.tsx`

**检查点**：US12+US13+US14 Admin 功能可独立验证

---

## Phase 13：AI Agent — Chat 侧边栏与 Tool Use（P3）

**目标**：嵌入式 Chat 侧边栏可用；LLM Tool Use 调用线索/跟进等业务 API；LLM 可切换

**独立验收**：在 Chat 中输入"帮我把华为线索分配给张三" → LLM 调用 assign_lead tool → 线索被分配 → 自然语言回复

- [ ] T095 实现 LLMConfig 模型和 Skill 模型：`backend/app/models/llm_config.py`、`backend/app/models/skill.py`
- [ ] T096 实现 ConversationMessage 模型：`backend/app/models/llm_config.py`
- [ ] T097 实现 LLM 配置接口（`GET /agent/llm-config`、`GET /agent/skills`）：`backend/app/api/agent.py`
- [ ] T098 实现 Agent 服务（从 DB 读取 LLMConfig，执行工具调度）：`backend/app/services/agent_service.py`
- [ ] T099 实现所有 Tool Use 定义（映射自 Ontology Actions，含参数 schema）：`backend/app/tools/lead_tools.py`、`backend/app/tools/customer_tools.py`、`backend/app/tools/followup_tools.py`、`backend/app/tools/skill_tools.py`
- [ ] T100 实现 `POST /agent/chat` 接口（工具调度 + 审计日志）：`backend/app/api/agent.py`
- [ ] T101 前端：配置 Vercel AI SDK（动态从后端读取 LLMConfig，实例化 Provider）：`frontend/src/lib/ai.ts`
- [ ] T102 前端：实现 `/api/chat` Next.js API Route（调用 Vercel AI SDK + 流式输出 + 工具执行调用后端）：`frontend/src/app/api/chat/route.ts`
- [ ] T103 前端：实现 Chat 侧边栏 UI（消息列表 + 输入框 + 流式渲染 + 工具执行状态显示）：`frontend/src/components/chat/chat-sidebar.tsx`
- [ ] T104 前端：将 Chat 侧边栏挂载到根布局：`frontend/src/app/layout.tsx`
- [ ] T105 前端：Admin 页面中实现 LLM 切换配置和 Skill 管理 CRUD：`frontend/src/app/admin/config/page.tsx`

**检查点**：US15（AI Agent）可独立运行和验证

---

## Phase 14：收尾与横切关注点

**目的**：多用户故事共同影响的优化项

- [ ] T106 [P] 补充 `backend/tests/integration/` 关键路径集成测试（线索去重、池分配、速率限制、转化流程）
- [ ] T107 [P] 实现前端通知轮询（释放通知、转化窗口提醒）：`frontend/src/components/notifications/notification-bell.tsx`
- [ ] T108 [P] 前端：数据概览页（主管视图：各销售业绩、私有池使用率、转化漏斗）：`frontend/src/app/dashboard/page.tsx`
- [ ] T109 [P] 按 `quickstart.md` 验证本地完整启动流程，修复发现问题
- [ ] T110 [P] 补充 README.md 开发者文档

---

## 依赖关系与执行顺序

### Phase 依赖

- **Phase 1（初始化）**：无依赖，立即开始
- **Phase 2（基础设施）**：依赖 Phase 1，**阻塞所有用户故事**
- **Phase 3~13（用户故事）**：全部依赖 Phase 2 完成；Phase 3+5+11 为 P1，优先实施
- **Phase 14（收尾）**：依赖所有期望实现的用户故事完成

### 用户故事依赖关系

| 用户故事 | 优先级 | 依赖 |
|----------|--------|------|
| US1 线索录入 | P1 | Phase 2 |
| US2+US3 分配+抢占 | P1 | US1 |
| US4 自动释放 | P1 | US2 |
| US5 线索转化 | P1 | US1 |
| US6+US7 跟进+关键事件 | P2 | US1、US5 |
| US8 转化窗口 | P2 | US5 |
| US9 联系人管理 | P2 | US1 |
| US10 日报 | P2 | US6 |
| US11 权限体系 | P1 | Phase 2 |
| US12+13+14 Admin | P2 | Phase 2 |
| AI Agent | P3 | US1~US11 |

### Phase 内并行机会

- Phase 2：T008~T012 模型定义可并行；T015~T019 配置类任务可并行
- Phase 3：T026~T028 模型定义可并行；T034~T036 前端页面可并行
- Phase 12：T086~T089 Admin 接口可并行；T090~T094 Admin 前端页面可并行

---

## 实现策略

### MVP 优先（仅 Phase 1~3+11）

1. 完成 Phase 1：项目初始化
2. 完成 Phase 2：基础设施（关键阻塞）
3. 完成 Phase 3：US1 线索录入与唯一性校验
4. 完成 Phase 11：权限体系
5. **停下来验证**：线索录入 + 权限控制可独立演示
6. 继续 P1 用户故事（Phase 4、5）

### 增量交付顺序

1. Phase 1+2 → 骨架就绪
2. Phase 3+11 → 可演示：录入线索 + 权限隔离（MVP）
3. Phase 4+5 → 可演示：完整线索生命周期
4. Phase 6+7+8+9+10 → 可演示：日常销售工作流
5. Phase 12 → Admin 管理功能
6. Phase 13 → AI Copilot
7. Phase 14 → 收尾打磨

---

## 任务统计

| Phase | 任务数 | 说明 |
|-------|--------|------|
| Phase 1 初始化 | 6 | |
| Phase 2 基础设施 | 19 | 阻塞所有后续 |
| Phase 3 US1 线索录入 | 11 | P1 MVP |
| Phase 4 US2+3 分配抢占 | 10 | P1 |
| Phase 5 US4 自动释放 | 3 | P1 |
| Phase 6 US5 转化 | 7 | P1 |
| Phase 7 US6+7 跟进+事件 | 10 | P2 |
| Phase 8 US8 转化窗口 | 3 | P2 |
| Phase 9 US9 联系人 | 4 | P2 |
| Phase 10 US10 日报 | 7 | P2 |
| Phase 11 US11 权限 | 4 | P1 |
| Phase 12 US12~14 Admin | 10 | P2 |
| Phase 13 AI Agent | 11 | P3 |
| Phase 14 收尾 | 5 | |
| **合计** | **110** | |
