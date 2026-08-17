---
name: Main Project — SFA CRM
description: SFA CRM 全栈项目：从书籍方法论到 Spec Coding 到完整系统，含 AI Copilot
type: project
---

**项目目标：** 将《决胜B端》《决胜体验设计》的方法论转化为可执行的 AI spec/skill，再用 Spec Coding 方式构建 SFA CRM 系统，验证"方法论→AI 规范→复杂系统落地"链路。

**GitHub：** `https://github.com/pmYangKun/sfa-crm`（公开仓库）

**技术栈：** Next.js + FastAPI + SQLite + Docker Compose + Vercel AI SDK

---

## 已完成的里程碑

### 阶段一：方法论 → Skill（2026-03-26 ~ 03-29）

- 从两本书提炼方法论，最终产出 `/check-prd` Skill（17 文件，14 维度）
- 在 8 份真实企业 PRD 上完整验证
- GitHub 独立仓库：`https://github.com/pmYangKun/check-prd-skill`
- **关键结论：** check-prd 是旅途中的副产品，CRM 才是主线；两者完全独立，CRM 不绑书中方法论

### 阶段二：业务讨论 → Spec 设计（2026-03-29 ~ 03-30）

- 三次方向纠偏：最终确定 Ontology 数据底座 + API-first + Copilot 三层架构
- 完成 Ontology 设计（Lead/Customer 拆分、RBAC 四表、OrgNode 树、DataScope 五档）
- 引入 spec-kit，完成 constitution v1.1.0 + spec.md + plan.md + data-model.md + tasks.md（110 任务，14 Phase）
- 早期业务设计归档：`docs/early-design/`（含 business-context / ontology / specifications，已整合至 `specs/master/spec.md`）
- Spec-kit 自动产物：`specs/master/`

### 重大设计决策（设计阶段确定，至今未变）

| 决策 | 结论 |
|------|------|
| 线索 vs 客户 | 独立对象，Lead 有状态，Customer 无状态，转化时归档+迁移 |
| 权限 | RBAC 四表（Role/Permission/UserRole/RolePermission）+ DataScope 解耦 |
| 数据可见性 | self_only / current_node / current_and_below / selected_nodes / all |
| 业务规则 | 配置驱动（SystemConfig 表），不硬编码 |
| AI Agent | GUI 和 Agent 共用同一套 API，Ontology Actions → Tool Use |
| Skill 系统 | 提示词文本存 DB，LLM 通过工具调用检索，Provider 可切换 |

### 阶段三：编码实现（2026-03-31 ~ 04-02）

代码目录：`src/backend/` + `src/frontend/`，共 132 次 commit。

| Phase | 任务 | 内容 |
|-------|------|------|
| 1 | T001-T006 | 项目初始化（pyproject/package.json/Docker/lint） |
| 2 | T007-T025 | 基础设施（DB/ORM/RBAC/JWT/FastAPI/前端 API 封装） |
| 3 | T026-T036 | 线索录入 + 去重（rapidfuzz 85 分阈值） |
| 4 | T037-T046 | 线索分配/抢占/释放/标丢失 + 大区规则引擎 |
| 5 | T047-T049 | 定时释放（APScheduler）+ 通知表 |
| 6 | T050-T056 | 线索转化 + Webhook 对接 + 客户管理 |
| 7 | T057-T066 | 跟进记录 + 关键事件 |
| 8-10 | T067-T080 | 转化窗口、联系人管理、日报 |
| 11-12 | T081-T094 | 权限管理 + Admin 后台（组织/用户/角色/配置/审计） |
| 13 | T095-T105 | AI Agent chat sidebar & tool use |
| 14 | T106-T110 | 集成测试、通知铃铛、Dashboard |

后续修复：Copilot 端到端（DeepSeek Tool Use）、TypeScript 编译、Dashboard API、quickstart 文档拆分。

### 文档

- `articles/` 目录已移除，会话记录迁移至 `Kun's Context` 仓库
- `docs/` — PRD 文档（SFA-CRM-PRD.md / .docx）

---

## 业务上下文摘要

甲方：企业家培训公司，小课 2 万 + 大课 20 万，销售 200 人全国。
组织：VP → 5 大区总 → 战队队长 → 一线销售。
核心痛点：客户唯一性、公共池防刷、大区规则差异化、销售录入负担。

---

### 演示体验优化（2026-04-03）

- Chat 面板从浮动小窗改为右侧全高侧栏（Agentforce 风格）
- Chat 导航关键路径：`chat-sidebar.tsx`（handleNavigate）→ sessionStorage(`copilot_prefill`) → 目标页读取；`/leads/new` 用 `useSearchParams` 读 URL 参数
- navigate 工具支持预填表单（sessionStorage 传递 followup_type/content/event_type）
- search_leads/get_lead_detail 返回 detail_url + last_followup_at，防止 LLM 编造 URL
- Copilot 工具增加 DataScope 过滤（search_leads/list_customers），与正式 API 一致
- system prompt 重写为工作流程式，解决 DeepSeek 不调工具就编 URL 的问题
- 新增 sales02（李思远）、sales03（张磊），3 个销售差异化活跃度（高/中/低）
- 新增团队分析能力：manager 可问"谁在偷懒"，AI 按 owner 分组分析跟进节奏
- init_db 自动从 `src/backend/.env` 读取 LLM API Key（不进 Git）
- init_db 增加幂等检查，避免重复初始化报错
- 演示案例精简为 8 个独立案例，含团队偷懒检测（案例 6）
- README 重构：演示信息前置，修正账号密码
- 新增 `reset-demo.bat` 一键重置演示数据

### 阶段四：spec 002 公网部署安全/治理硬化（2026-05-04）

走完整 spec-kit 流程产物（specify + plan + tasks），单线程 TDD 实施，46 → 72 测试全绿。

| 块 | 内容 | 状态 |
|---|---|---|
| Setup (T001-T003) | cryptography 显式声明 / 6 个新 SystemConfig 默认值 / system prompt 边界条款 | ✅ |
| Foundational (T004-T011) | chat_audit + llm_call_counter 模型 / 限流 key 改 (IP, user) / Fernet 加解密 / 启动密钥校验 | ✅ |
| US2 防护 (T013-T022) | prompt_guard 软拦截 + 限流 10/分 100/天 + 全站 LLM 200/小时熔断 + chat_audit 全量写入 + 前端 422/429/503 友好气泡 | ✅ |
| US3 重置 (T023-T029) | reset_business_data 清 8 业务表保留 9 配置表 / scheduler 30min interval / 前端右下角倒计时小气泡（PC bottom:96 / Mobile bottom:80）| ✅ |
| US4 部署 (T034/T037-T040) | docker-compose 强制密钥注入 / .env.production.example / docs/deploy.md / encrypt_existing_llm_keys.py 迁移脚本 | ✅ |
| US4 二轮 (T033/T036) | /llm-config/full 删 api_key 字段 + 加 api_key_present:bool；前端 chat/route.ts 改从 process.env.{ANTHROPIC,OPENAI,DEEPSEEK,MINIMAX}_API_KEY 读 LLM Key（不再走后端响应）；docs/deploy.md + .env.production.example 同步更新；frontend systemd 加 EnvironmentFile | ✅ |
| US4 二轮 init_db 加固 | 发现 spec 001 老 DB 升级到 spec 002 代码时，6 个新 SystemConfig key（限流值/熔断值/重置开关/prompt_guard 词表）会因 short-circuit 永远不被注入；改成幂等"INSERT 缺失 key 不覆盖已存在"；3 个 unit test 覆盖 | ✅ |
| US4 deferred (T035) | 后端 LLM 全代理 /agent/llm-proxy（流式响应 + tool-use 多轮循环）：~500 行 + 后端引入 anthropic/openai SDK + SSE 协议适配 Vercel AI SDK；env-var 路径已经满足 FR-029/030/031 三条硬安全要求，留待真正需要"在线 rotate 多 provider key 不重启"时再做 | ⏳ |

新分支 `002-public-deploy-hardening`（local，未 push 未 PR），最新 commit 见 `git log`。
spec-kit 产物：`specs/002-public-deploy-hardening/`（spec.md / plan.md / research.md / data-model.md / contracts/ / quickstart.md / tasks.md / checklists/ / inputs/）

**测试态势**（2026-05-04 二轮收尾）：80 个后端 pytest 全绿（72 一轮 + 5 T033 + 3 init_db 补 key），前端 `npm run build` 25 页全过，TestClient E2E 验证 /llm-config/full 不含 api_key + /demo-reset-status 返回 enabled=true 倒计时 30min 正确。

---

## 当前状态

- ✅ 全部 14 Phase 编码完成（T001-T110）
- ✅ Copilot 端到端跑通（DeepSeek Tool Use）
- ✅ 9 篇公众号文章完成
- ✅ 演示体验全面优化（全高面板、预填、团队分析、权限过滤）
- ✅ spec 001（登录页双栏 + 移动端 + Onboarding）已 merge 进 master
- ✅ spec 002（公网部署安全/治理硬化）已 merge，tag `v-spec002` → `2497831`（T033 + T036 + init_db 补 key 全闭环；T035 全 backend proxy 仍 deferred 但理由已更新为"非紧急、非阻塞"）
- ✅ spec 003（MEDDICC 销售视角）已 merge，tag `v-spec003` → `cd8133c`
- ✅ spec 004（MEDDICC 经理视角 Pipeline）已 merge，tag `v-spec004` → `8271812`，PR #5
- ✅ spec 004 v2 UX 微调（2026-05-07 当晚 + 当夜两轮）：默认 Team 视图 / 移动端 forecast tabs 折行 / Warnings & Forecast 弹层 Portal 化 / 移动端 BottomSheet 替代浮窗 / 金刚区 5 槽（删跟进 + Pipeline 全角色可见）/ Lead 详情页头部加 Forecast 编辑 + 金额 + 关单 / Seed 大扩量（54 lead / 29 评分 / 116 evidence / 116 history snapshot）/ demo_reset_service 补 LeadMeddiccHistory 漏删
- ✅ **2026-05-17 首次公网正式上线 https://crm.pmyangkun.com**（5 commit 全 push 到 master + 部署到生产）：
  - `ee54479` 域名 sfacrm → crm + 登录页 ICP footer
  - `431269c` nginx 反代要按 /api/v1/ 精确匹配（原 /api/ 一刀切会吞 /api/chat Next.js Route Handler 导致 AI Copilot 失败）
  - `a788e4f` 嵌入百度统计（共享主站 site ID 961b93...）
  - `7c4eac6` 修 ResetCountdownBadge 老 bug：localStorage key 写错 'token' → 'access_token' + 加 PC smoke 回归
  - `fe467fb` 移动端去浮动 badge，挪到 /m/me 内嵌 ResetCountdownCard（抽 useResetCountdown hook 复用）+ 加 mobile smoke 回归
  - 部署：本地 git archive + scp + 服务器 mv 旧目录保留 secrets + .venv/node_modules 复用 + npm build + systemctl restart frontend，详细流程见 `~/Doc.Work/Programming/claudecode/memory/feedback_deploy_vocab.md`（增量部署 7 步）
- ✅ **2026-05-19 VM 重装 + 完整重新部署 + 安全加固**（前次 VM 疑似被攻破，从控制台重置后从零部署 + 一次性补齐所有防线）：
  - 触发：用户报"虚拟机好像中了木马了"→ 控制台重置 VM；事后回看真正入口大概率是**前次部署用 root + 密码登录**这条老路，不是 SSH 端口或别的
  - SSH 加固：腾讯云控制台绑定密钥对 + 下载私钥 `C:\Users\YK\.ssh\kunclawmachine.pem` + Windows 本地 icacls 锁权限 + 本地 `~/.ssh/config` 配 alias `ssh crm` + sshd `PasswordAuthentication=no` + `PermitRootLogin no`（drop-in `/etc/ssh/sshd_config.d/99-disable-password.conf`）
  - 服务器接入：用户改为 `ubuntu`（不再是 root）+ sudo 免密拿 root（腾讯云 Ubuntu 镜像标准）
  - 运行时：Ubuntu 24.04 / Node 22.22（Astro 6.2.1 要 ≥22.12，Next.js 14 同时兼容 Node 22）/ Python 3.12 / nginx 1.24 / certbot 2.9
  - 全部 secrets 重生：JWT_SECRET + LLM_KEY_FERNET_KEY + WEBHOOK_SECRET 自动随机；DeepSeek key 用户手动 rotate（前一把已泄露 chat 历史 → revoke + 新生）
  - 公网两站全活：https://crm.pmyangkun.com / https://www.pmyangkun.com 各自 Let's Encrypt 证书
  - 应用层加固：**admin 默认密码 admin/12345 已改**（用户自行设强密码）；改密码工具脚本流程 = `/opt/sfa-crm/src/backend/.venv/bin/python /tmp/changepw.py`，脚本内用 `getpass` + passlib bcrypt 直接 UPDATE `user` 表，密码不入 history、不在 process list 暴露
  - 系统层加固：**fail2ban**（sshd jail，5 次失败/10 分钟 → 封 1 小时）+ **UFW**（默认 deny incoming，明确放 22/80/443）+ **腾讯云安全组**（外层 ACL，与 UFW 双层）
  - 部署期间踩 4 个坑（已记录到 [[feedback_deploy_vocab]]）：腾讯云"SSH 微信二次验证"会拦自动化 ssh → 控制台关掉；Astro 要 Node 22 而非 20；腾讯云云镜扫 sk-ant-/sk- 占位符 → 解 tar 后立刻删 `.env.production.example`；PowerShell→ssh stdin 用 `cmd /c "type file | ssh ..."`（PowerShell 不支持 `<`）+ 用 `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` 避免 BOM 报错
  - **SSH 端口换高位**这件事评估为低 ROI 没做：密钥+fail2ban 已经把暴力破解面封死，换端口只是减少日志噪声不真提高安全性。要做需先在腾讯云安全组放新端口避免锁死
  - **当晚补丁：chat 流式响应回归**——部署写 nginx 时漏抄根 `location /` 的 `proxy_buffering off`，导致 AI 回复一次性蹦出（无打字机效果）。修法：抽独立 `location /api/chat` 块（buffering off + cache off + chunked_transfer_encoding off），根 location 保持默认 buffer。`docs/deploy.md` 的 nginx 模板同步升级到三 location 块（/api/v1 + /api/chat + /）
- ✅ **2026-05-21 按用户限流回归（commit 3e614eb）**：演示时用户报"一聊就显示请求过多 + 重启 VM 才恢复"+"切回页签卡 2-3 秒"。根因：spec 002 限流 key 是 `{ip}:{user_id}`，但 (a) Next.js Route Handler /api/chat 走外网回来让 backend 看所有用户 IP = 服务器自己出口 IP，(b) backend 没 trust X-Forwarded-For —— 双重叠加 → 所有用户合并到同一 IP 桶。修法三处协同：(1) `backend/main.py` 加 starlette ProxyHeadersMiddleware 只 trust 127.0.0.1；(2) systemd ExecStart 加 `--forwarded-allow-ips=127.0.0.1` 双保险；(3) frontend Route Handler 引入 server-only env `BACKEND_URL_INTERNAL=http://127.0.0.1:8000`（NEXT_PUBLIC_BACKEND_URL 留给浏览器 client-side fetch），并从 req header 取真实 IP 透传到 backend 的 `X-Forwarded-For`/`X-Real-IP`。验证：curl 模拟三个不同 XFF → backend 日志看到三个不同 client IP（不再是 101.34.78.180 一刀切）+ 浏览器实测两 user 并发不互相打架
- ✅ **2026-06-04 Git 分支清理完成**：`CLAUDE.md` 项目配置已下沉到 `memory/`，README 断链与 LLM Key 可选表单修复已提交并 push 到 `master`（commit `728bcb1`）。旧功能分支 `004-meddicc-manager-pipeline` 已确认被 `master` 包含，随后删除本地分支与远端分支；当前仓库本地/远端都只保留 `master`，`master` 与 `origin/master` 同步，工作区干净。
- ✅ **2026-08-16 spec 005 MCP 开放平台上线**（merge master + tag `v-spec005` → `0406ec3`，已部署生产）：
  - 对外形态：`https://crm.pmyangkun.com/open` —— 访客零注册领密钥 → 复制已填好密钥的配置 → 粘进任意 MCP 客户端。首屏之后直接进三步接入
  - 暴露 9 个只读工具（按 `TOOL_DEFINITIONS` 的 `mode == "read"` **程序化过滤**，不维护人工白名单）；6 个 `navigate_*` 永不暴露
  - 两个身份 sales/manager 映射 sales01/manager01，**数据范围差异由既有 DataScope 承担，未新建任何权限逻辑**。生产实测：销售 19 条 ⊂ 主管 42 条
  - 锁定 `mcp==2.0.0`。三处与预期不同（已回写 research.md）：`mcp.server.fastmcp` 在 2.0 已移除改用 `MCPServer`；mount 的 Starlette 子应用 lifespan 不被父应用执行，须在 main.py 里 `async with get_mcp_server().session_manager.run()`，且**必须先调 `get_mcp_asgi_app()`**（session_manager 惰性创建）；`TransportSecuritySettings` 未放行的 Host 一律 **421**，且校验含端口，故代码里把裸域名自动展开出 `host:*`
  - MCP 运行时改为**惰性构造 + `reset_mcp_runtime()`**：SDK 的 session manager 每实例只能 `run()` 一次，导入期单例会让同进程内二次启动 lifespan 直接 RuntimeError（测试里每个 TestClient 都会启一次）
  - **安全修复（顺带治了老问题）**：`get_lead_detail` / `get_followup_history` / `get_lead_meddicc` 过去只按主键取数、不校验归属。内置 Copilot 里 lead_id 只来自受控搜索危害有限，MCP 开放后可枚举 ID 越权读取。已统一走 DataScope，且**越权与不存在返回同一句话**防探测（宪法原则二：修在统一执行点）
  - 限流独立于内置 Copilot（`get_token_key` + 自建滑动窗口，MCP 是 mount 的 ASGI 子应用，slowapi 装饰器挂不上），守 2026-05-21 串桶事故
  - 注入消毒：自由文本包 `<untrusted-data>` + 截断。**只读平台唯一真实风险**——演示环境 GUI 对公众开放写入，恶意文本会进别人 agent 的上下文
  - `mcp_token` 表**永不随 demo_reset 清空**（删除列表是显式的，默认即保留；有静态 + 集成两条守护测试防未来误加）
  - 撤销项：live 演示区做完又整体移除（用户判断"接入只要一分钟，前面不该插铺垫"），后端 `/mcp/demo` 端点连带删除。**日后恢复必须一并恢复 FR-021**（演示凭证不下发前端 + 配额独立），见 spec.md §8
  - CLI / Skill 均推后（Skill 的触发条件 = 启动写操作那一版，届时同期交付）
- **测试态势（2026-08-16 终态）：** Backend **223 pytest** / 开放平台 e2e PC 9 + Mobile 8 / 全量 Playwright 91 passed（1 例 us1 角色切换在满套件下偶发抖动，单独跑通过，与 spec 005 代码路径无关）
- **测试态势（2026-05-17）：** Backend 159 pytest / PC Playwright 39 / Mobile Playwright 34 / 0 fail
- LLM API Key：`src/backend/.env`（dev）/ DB Fernet 密文（生产，spec 002）
- 演示案例：`docs/copilot-cases.md`（8 个独立案例）

## 已知 bug / 修复记录

- ✅ **2026-06-02 修复 admin UI LLM 配置表单 API Key 强制 required**：spec 002 T036 让 chat 运行时改从 `process.env.{PROVIDER}_API_KEY` 读 key（绕开 backend），但 admin UI（`/admin/config`）的 LLM 配置表单仍要求填 API Key 才能保存。已改为 API Key 可选：生产环境可只保存 Provider/Model，由服务端环境变量提供 Key；本地开发仍可填写 Key；已有 DB Key 时留空会沿用旧密文。
- 一键启动：`start.bat` | 一键重置：`reset-demo.bat`
- 公网部署：`docs/deploy.md` 一键流程（spec 002）
- 演示账号：admin / sales01（王小明）/ sales02（李思远）/ sales03（张磊）/ manager01（陈队长），密码均为 12345

---

## 发布 / 部署约定（2026-05-07 三修：简化为"公网永远跟最新"）

**核心规则：** 公网 `crm.pmyangkun.com` **永远跟 master HEAD 跑**——每个大 spec 收口（PR merge 后）立即部署最新版到公网。**不按 tag 切回旧版本演示历史。**

**为什么简化（用户 2026-05-07 三修决策）：**
1. 切 tag 部署需要 DB schema 同步管理（每个 tag 还得带迁移脚本能 rebuild），工程量大
2. SQLite + 30min 重置场景下，DB 跟代码绑死，回滚要彻底删 DB 重建——成本不低
3. **读者不会真去对每篇文章找对应版本**——文章描述的是"那时做了什么"，公网展示"现在长啥样"，**读老文章看新功能反而是惊喜**
4. 演示视频录完即归档，不需要"回放"——录的时候用最新版就够

**为什么不会出现 DB 与代码不一致：** 永远向前部署，永远跑最新 alembic head，**永远不回滚 → 没有 schema 与 code 错配的可能**。

**Git tag 仍然打：** 每个 spec 收口给 master 上对应 merge commit 打 `v-specNNN` annotated tag，作为**代码状态标记**（"这个 commit 就是 spec NNN 的最终态"），方便 git diff / blame / 史料检索，**但不作为部署目标**。

**当前 tag（仅作 code state marker）：**

| Tag | 指向 commit | 对应 spec | 备注 |
|---|---|---|---|
| `v-spec002` | `2497831`（spec 002 merge，含 spec 001） | spec 001 + 002 | 公网部署 + Onboarding 安全硬化 |
| `v-spec003` | `cd8133c`（spec 003 merge） | spec 003 | MEDDICC 销售视角 |
| `v-spec004` | `8271812`（spec 004 PR #5 merge） | spec 004 | MEDDICC 经理视角 Pipeline |
| `v-spec005` | `0406ec3`（spec 005 merge） | spec 005 | MCP 开放平台（只读 MCP Server + /open 站点） |

**集号 ↔ spec ↔ tag 三列映射的权威源：** [`Kun's Context/articles/sfa-crm-series/MASTER-PLAN.md`](../../../BaiduSyncdisk/Doc.Work/Programming/claudecode/Kun's%20Context/articles/sfa-crm-series/MASTER-PLAN.md) 的"三列映射表"——讨论 SFA CRM 文章 / spec / tag 历史都先打开它对照。

**部署工作流（简化版）：**
1. spec NNN 在分支上开发 → PR 合 master → 给 merge commit 打 `v-specNNN` 注释 tag → push origin（含 tag）
2. 立即部署 master HEAD 到公网（本地 git archive + scp，见 [[feedback_deploy_vocab]] 增量 7 步）
   ⚠️ **本仓库没有 alembic**。若本次上线新增了数据表或 SystemConfig 项，重启服务**不会**建表，
   必须显式跑一次 `init_db()`（幂等，只补缺表 + INSERT OR IGNORE 配置，不动业务数据）。
   spec 005 部署时踩过：`mcp_token` 表没建，领密钥直接 500。详见 `docs/deploy.md` §9 前的提示块
3. master 继续跑下一个 spec，公网随之滚动到下一个最新版

**禁止：**
- 按 tag 切回旧版本演示（无论是为对齐文章还是为录视频）
- 不打 tag 就 merge 大 spec 进 master（tag 作为 code state marker 仍是必须）
- 在文章正文末尾追加 `v-specNNN` 锚点 / spec 编号 / git tag URL（per `writing_claudegg_sfacrm_series.md` 的"文章末尾标准模板"）

**老规则废弃（2026-05-07 三修废）：**
- ❌ "公网部署只跟 git tag 走，不跟 master HEAD 跑" —— 反过来了
- ❌ "切 tag 时 DB rebuild + 重灌 demo 数据" —— 永远不切回去，所以也不需要 rebuild discipline

---

## 内容策略与心智构建（2026-05-02 确立）

### 顶层目标

通过 SFA CRM 项目，公开验证并传递「**对话式 + 行为驱动 + Spec 工程化**」的现代 CRM 形态，构建「vibe coding 达人」+「现代 CRM 专家」双心智。

SFA CRM 不只是 vibe coding 演示，更是用项目验证杨堃对 RAO / AI Native CRM 判断的载体。

### 核心原则（不可逾越）

- **转化路径不外露**：不喊买课/咨询，沿用既有引流（视频号→公众号→个人微信 goYangkunGo）
- **内容寄生在产品迭代和专业讨论上**，不为了写而写
- AI 不代写杨老师本人声音长文（编辑辅助限于错别字 / 结构 / 前后呼应）

### 项目两条探索路径（叙述维度，非执行隔离）

| 路径 | 主题 | 心智锚定 |
|------|------|---------|
| 路径 1：CRM 业务形态变革 | 表单驱动 → 对话驱动；借鉴 Gong / RAO 行为驱动哲学；半结构化数据沉淀；Next Best Action | 「现代 CRM 专家」 |
| 路径 2：ToB × AI 架构变革 | Headless 360 / MCP 化 / 业务人员自助 SQL 与 Skill / Tool Use / Agentic 编排 | 「vibe coding 达人」+ 架构理解 |

两路径主要作用是写文章时的叙述抓手，主题攻势内部会两路混合。

### 阶段 1：奠基（1-2 周）

**目标**：让 SFA CRM 从"听说"变成"读者亲手摸到"。

**关键动作：**
1. **公网部署**（用户准备服务器）：数据脱敏、演示账号公开化、LLM API Key 服务端代理、简单防刷 + 每日重置数据、PV/UV 统计
2. **Mobile 形态调整**（不重写，重设）：现有 Chat 移动化为主入口；体现「行为驱动」哲学（Next Best Action 雏形）；不押注 chat-only，桌面端仍有表单
3. **首页与登录后引导**：首页三件套（系统用途 / GitHub / 系列文章入口）+ 登录后简单 onboarding；移动端 Chat 必须有"我能干啥"的引导
4. **GitHub README 门面化**：30 秒 demo 视频 + 在线试玩按钮 + 设计文档锚点
5. **写 Session 10 集大成文**（克劳蛋人设）：「这个 CRM 现在你可以自己玩了」

**阶段成功标志：**
- Demo URL 任何人能点开就玩，演示数据稳定
- Session 10 发布后从公众号文章可直跳 demo
- 移动端 Chat 模式下新用户能在 1 分钟内理解"能做什么"

### 阶段 1 之后：持续运营期（无终点）

不再分大 Phase——4 个轨道并行螺旋上升，靠主题攻势制造节奏感。

**4 个并行轨道：**

| 轨道 | 内容 | 节奏 |
|------|------|------|
| A. 专业讨论 | 杨老师本人硬观点短文 | 每月 1-2 篇 |
| B. 功能扩展 | SFA CRM 借鉴 Gong / Headless / RAO 形态落地 | 跟主题攻势 |
| C. AI 玩法实验 | MCP / Skill / Tool Use / Agentic 编排 | 跟主题攻势 |
| D. 心智构建 | 克劳蛋系列把每次迭代记录成文章 | 每 1-2 周 1 篇 |

四轨道**互相喂料**——专业讨论决定要扩展哪些功能，功能扩展过程产生克劳蛋故事，AI 玩法实验既是技术弹药也是文章素材。

**主题攻势机制：** 每 1-2 个月选一个主题，4 轨道全部向其倾斜。**不预先承诺顺序**，按当下兴趣 / 热点 / 反馈动态选取，可以打到一半切换到另一个主题。

**每个主题攻势完整产出形态：**
- 1 篇杨老师硬观点短文（轨道 A）
- 2-4 篇克劳蛋系列文章（轨道 D）
- 实际功能 / 技术上线（轨道 B/C）
- 必要时配视频号短视频（用户自拍，AI 不介入选题）

**主题攻势候选池（未排序，灵活选取，可持续增长）：**

路径 1（CRM 业务形态）：
- 对话式 CRM（借鉴 Gong 哲学，Mobile + 大客户打分 + Next Best Action）
- 半结构化数据治理（对话 / 会议 / 邮件如何沉淀为 CRM 资产）
- 销售行为预测与 AI 决策安全边界
- 客户健康度评分与流失预警
- 销售漏斗的"行为驱动"重构（vs 传统阶段驱动）

路径 2（ToB 架构变革）：
- Headless 360 与 MCP 化（对齐 Salesforce / HubSpot 头部尝试）
- 业务人员自助 SQL / Skill 配置（能力下放，AI 辅助下的低门槛）
- Tool Use 与 Agentic 编排（API 层 AI 接口设计）
- 多租户与数据隔离在 AI Native 系统中的实现
- 权限边界：AI 哪些操作必须人审批
- 与现有 CRM（Salesforce / 钉钉 / 企微）的对接和迁移

### 持续运营期成功标志（leading indicators）

- 公众号搜「vibe coding」「现代 CRM」「AI CRM」能搜到杨堃文章
- 至少有一篇硬观点文被同行 / 微信群截图传播
- 出现非杨堃自己渠道的引用（行业自媒体 / 群推荐 / 咨询公司援引）
- 私域加人速度自然上升
- 项目 commit 历史持续生长（每月有非维护性新增）

### 关键参考资源（执行时必读）

| 场景 | 必读文件 |
|------|---------|
| 写克劳蛋系列文章 | 全局 memory：`writing_claudegg_sfacrm_series.md` + `writing_claudegg_voice.md` |
| 写杨老师本人短文（编辑辅助） | 全局 memory：`writing_yk_voice.md` |
| AI 立场表述 | 全局 memory：`user_ai_era_stance.md` |
| 文章存放路径 | 全局 memory：`reference_articles.md` |
| 多平台分发原则 | 全局 memory：`project_content_platforms.md` |
| Gong / RAO 已有论述 | `Kun's Context\articles\wechat_archive\articles\2026\20260412-AI Native企业软件的机会在哪里.md` |

下次讨论 SFA CRM 内容 / 文章 / 部署时，本节即为完整路线图。
