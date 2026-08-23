# 时间线（倒序追加）

> 流水账：**发生了什么** + 关键 commit/tag + 踩了什么坑。只记不堆原文。
> 沉淀够了的稳定结论往 `context/` 提炼，别留在这儿当知识用。

---

## 2026-08-20 · 登录页加 MCP 开放平台入口

commit `42a217e`，已 push master + 部署生产。

- PC / 移动登录页各挂一块 `OpenPlatformEntry`（角色卡 + 账号表单之后、亮点区之前），跳站内 `/open`。视觉沿用 `open.css` 深色终端风（近黑底 + `#4ade80` + 等宽字）——整页浅色里唯一深色区；PC 1440×900 实测 y=474，首屏不滚就能看见
- 补的是 spec 005 的缺口：`/open` 上线后 CRM 侧一直没入口，访客只能靠文章直链进
- 纯前端改动，无新表 / 无新环境变量 → 部署**跳过 init_db**
- **暴露出部署手册三处硬伤**（已回写用户级 `feedback_deploy_vocab`）：
  1. 增量第 3 步漏了回填 `src/backend/.venv` 和 `src/frontend/node_modules`——第 4、5 步都假设它们在，照原文跑必挂
  2. 第 5 步 `cp -r /opt/sfa-crm.old/node_modules ./` 路径错了（在 `src/frontend/` 下，不在仓库根）
  3. `docs/deploy.md` §十二 回滚方法跑不通——线上目录是 tar 解出来的没有 `.git`，`git checkout` 无从执行。真回滚 = `/opt/sfa-crm.old` mv 回去 + restart 两个服务（已顺手改掉 §十二）

## 2026-08-16 · spec 005 MCP 开放平台上线

merge master + tag `v-spec005` → `0406ec3`，已部署生产。

- 对外形态：`/open` —— 访客零注册领密钥 → 复制已填好密钥的配置 → 粘进任意 MCP 客户端
- 暴露 9 个只读工具（按 `TOOL_DEFINITIONS` 的 `mode == "read"` **程序化过滤**，不维护人工白名单）；6 个 `navigate_*` 永不暴露（靠浏览器跳转 + 人工确认，对无浏览器的调用方无意义）
- 两个身份 sales/manager 映射 sales01/manager01，**数据范围差异由既有 DataScope 承担，未新建任何权限逻辑**。生产实测：销售 19 条 ⊂ 主管 42 条
- 锁定 `mcp==2.0.0`。**三处与预期不同**（已回写 research.md）：`mcp.server.fastmcp` 在 2.0 已移除改用 `MCPServer`；mount 的 Starlette 子应用 lifespan 不被父应用执行，须在 main.py `async with get_mcp_server().session_manager.run()`，且**必须先调 `get_mcp_asgi_app()`**（session_manager 惰性创建）；`TransportSecuritySettings` 未放行的 Host 一律 **421**，且校验含端口，故代码里把裸域名自动展开出 `host:*`
- MCP 运行时改为**惰性构造 + `reset_mcp_runtime()`**：SDK 的 session manager 每实例只能 `run()` 一次，导入期单例会让同进程内二次启动 lifespan 直接 RuntimeError
- **安全修复（顺带治了老问题）**：`get_lead_detail` / `get_followup_history` / `get_lead_meddicc` 过去只按主键取数、不校验归属。内置 Copilot 里 lead_id 只来自受控搜索危害有限，MCP 开放后可枚举 ID 越权读取。已统一走 DataScope，且**越权与不存在返回同一句话**防探测
- 限流独立于内置 Copilot（`get_token_key` + 自建滑动窗口，MCP 是 mount 的 ASGI 子应用，slowapi 装饰器挂不上），守 2026-05-21 串桶事故
- 注入消毒：自由文本包 `<untrusted-data>` + 截断
- `mcp_token` 表**永不随 demo_reset 清空**（有静态 + 集成两条守护测试防未来误加）
- **撤销项**：live 演示区做完又整体移除（用户判断"接入只要一分钟，前面不该插铺垫"），后端 `/mcp/demo` 端点连带删除。**日后恢复必须一并恢复 FR-021**（演示凭证不下发前端 + 配额独立），见 spec.md §8

## 2026-06-04 · Git 分支清理

`CLAUDE.md` 项目配置下沉到 `memory/`；README 断链与 LLM Key 可选表单修复已 push master（`728bcb1`）。旧分支 `004-meddicc-manager-pipeline` 确认已被 master 包含后删除本地+远端；当前本地/远端只剩 `master`，工作区干净。

## 2026-06-02 · 修 admin UI LLM 配置表单 API Key 强制 required

spec 002 T036 让 chat 运行时改从 `process.env.{PROVIDER}_API_KEY` 读 key（绕开 backend），但 `/admin/config` 的表单仍要求填 Key 才能保存。已改为可选：生产可只存 Provider/Model 由环境变量供 Key；本地开发仍可填；已有 DB Key 时留空沿用旧密文。

## 2026-05-21 · 按用户限流回归（`3e614eb`）

演示时用户报"一聊就显示请求过多 + 重启 VM 才恢复"+"切回页签卡 2-3 秒"。

**根因**：spec 002 限流 key 是 `{ip}:{user_id}`，但 (a) Next.js Route Handler `/api/chat` 走外网回来，backend 看到所有用户 IP = 服务器自己出口 IP；(b) backend 没 trust `X-Forwarded-For`——双重叠加 → 所有用户合并到同一 IP 桶。

**修法三处协同**：`backend/main.py` 加 starlette ProxyHeadersMiddleware 只 trust 127.0.0.1 ／ systemd ExecStart 加 `--forwarded-allow-ips=127.0.0.1` 双保险 ／ frontend Route Handler 引入 server-only env `BACKEND_URL_INTERNAL=http://127.0.0.1:8000`（`NEXT_PUBLIC_BACKEND_URL` 留给浏览器），并从 req header 取真实 IP 透传 `X-Forwarded-For`/`X-Real-IP`。

## 2026-05-19 · VM 重装 + 完整重新部署 + 安全加固

触发：用户报"虚拟机好像中了木马"→ 控制台重置 VM。**事后回看真正入口大概率是前次部署用 root + 密码登录**，不是 SSH 端口。

- SSH：改为密钥登录（控制台绑密钥对 + 本地锁权限 + `~/.ssh/config` 配 alias），sshd 关掉 `PasswordAuthentication` 和 `PermitRootLogin`
- 服务器用户改 `ubuntu`（不再 root）+ sudo 免密
- 运行时：Ubuntu 24.04 / Node 22.22（Astro 6.2.1 要 ≥22.12）/ Python 3.12 / nginx 1.24 / certbot 2.9
- secrets 全部重生；DeepSeek key 用户手动 rotate（前一把已泄露 chat 历史）
- 应用层：**admin 默认密码已改**（改密走一次性脚本，用 getpass + bcrypt 直接 UPDATE，密码不入 shell history）
- 系统层：**fail2ban**（sshd jail，5 次/10 分钟 → 封 1 小时）+ **UFW**（默认 deny，放 22/80/443）+ 腾讯云安全组双层
- **踩 4 个坑**：腾讯云"SSH 微信二次验证"会拦自动化 ssh → 控制台关掉；Astro 要 Node 22 不是 20；云镜扫 `sk-ant-`/`sk-` 占位符 → 解 tar 后立刻删 `.env.production.example`；PowerShell→ssh stdin 用 `cmd /c "type file | ssh ..."`（PS 不支持 `<`）+ `WriteAllText(..., UTF8Encoding($false))` 避免 BOM
- **SSH 换高位端口评估为低 ROI 没做**：密钥 + fail2ban 已封死暴破面，换端口只减日志噪声
- **当晚补丁：chat 流式响应回归**——写 nginx 时漏抄根 `location /` 的 `proxy_buffering off`，AI 回复一次性蹦出。修法：抽独立 `location /api/chat`（buffering off + cache off + chunked off），根 location 保持默认。`docs/deploy.md` nginx 模板同步升到三 location 块

> ⚠️ **具体接入信息（IP / 别名 / 密钥路径 / 改密脚本）不写进本仓库**——这是公开 repo。见用户级 `reference_crm_server_runbook.md`。

## 2026-05-17 · 首次公网正式上线 https://crm.pmyangkun.com

5 commit 全 push master + 部署生产：

- `ee54479` 域名 sfacrm → crm + 登录页 ICP footer
- `431269c` **nginx 反代要按 `/api/v1/` 精确匹配**（原 `/api/` 一刀切会吞 `/api/chat` 这个 Next.js Route Handler，导致 AI Copilot 失败）
- `a788e4f` 嵌入百度统计（共享主站 site ID）
- `7c4eac6` 修 ResetCountdownBadge 老 bug：localStorage key 写错 `token` → `access_token` + 加 PC smoke 回归
- `fe467fb` 移动端去浮动 badge，挪到 `/m/me` 内嵌 ResetCountdownCard（抽 `useResetCountdown` hook 复用）+ mobile smoke 回归

## 2026-05-07 · spec 004 v2 UX 微调（当晚 + 当夜两轮）

默认 Team 视图 ／ 移动端 forecast tabs 折行 ／ Warnings & Forecast 弹层 Portal 化 ／ 移动端 BottomSheet 替代浮窗 ／ 金刚区 5 槽（删跟进 + Pipeline 全角色可见）／ Lead 详情页头部加 Forecast 编辑 + 金额 + 关单 ／ Seed 大扩量（54 lead / 29 评分 / 116 evidence / 116 history snapshot）／ `demo_reset_service` 补 `LeadMeddiccHistory` 漏删。

## 2026-05-04 · spec 002 公网部署安全 / 治理硬化（阶段四）

走完整 spec-kit 流程（specify + plan + tasks），单线程 TDD，46 → 72 测试全绿；二轮收尾 **80 个后端 pytest 全绿**，前端 `npm run build` 25 页全过。

| 块 | 内容 |
|---|---|
| Setup T001-T003 | cryptography 显式声明 / 6 个新 SystemConfig 默认值 / system prompt 边界条款 |
| Foundational T004-T011 | chat_audit + llm_call_counter 模型 / 限流 key 改 (IP, user) / Fernet 加解密 / 启动密钥校验 |
| US2 防护 T013-T022 | prompt_guard 软拦截 + 限流 10/分 100/天 + 全站 LLM 200/小时熔断 + chat_audit 全量写入 + 前端 422/429/503 友好气泡 |
| US3 重置 T023-T029 | `reset_business_data` 清 8 业务表保留 9 配置表 / scheduler 30min / 前端右下角倒计时气泡 |
| US4 部署 T034/T037-T040 | docker-compose 强制密钥注入 / `.env.production.example` / `docs/deploy.md` / `encrypt_existing_llm_keys.py` |
| US4 二轮 T033/T036 | `/llm-config/full` 删 api_key 加 `api_key_present:bool`；前端改从 `process.env.*_API_KEY` 读；frontend systemd 加 EnvironmentFile |

**init_db 加固**：发现 spec 001 老 DB 升到 spec 002 代码时，6 个新 SystemConfig key 会因 short-circuit 永不注入；改成幂等"INSERT 缺失 key 不覆盖已存在"，3 个 unit test 覆盖。

## 2026-04-03 · 演示体验优化

- Chat 面板从浮动小窗改为右侧全高侧栏（Agentforce 风格）
- Chat 导航关键路径：`chat-sidebar.tsx`(handleNavigate) → `sessionStorage('copilot_prefill')` → 目标页读取；`/leads/new` 用 `useSearchParams` 读 URL 参数
- navigate 工具支持预填表单；`search_leads`/`get_lead_detail` 返回 `detail_url` + `last_followup_at`，防 LLM 编造 URL
- Copilot 工具加 DataScope 过滤（`search_leads`/`list_customers`）
- system prompt 重写为工作流程式，解决 DeepSeek 不调工具就编 URL
- 新增 sales02/sales03，3 个销售差异化活跃度；新增团队分析能力（manager 可问"谁在偷懒"）
- `init_db` 自动从 `src/backend/.env` 读 LLM Key（不进 Git）+ 幂等检查
- 演示案例精简为 8 个；新增 `reset-demo.bat`

## 2026-03-31 ~ 04-02 · 阶段三：编码实现

`src/backend/` + `src/frontend/`，共 **132 次 commit**，14 Phase / T001-T110 全部完成。

| Phase | 任务 | 内容 |
|---|---|---|
| 1 | T001-T006 | 项目初始化 |
| 2 | T007-T025 | 基础设施（DB/ORM/RBAC/JWT/FastAPI/前端 API 封装） |
| 3 | T026-T036 | 线索录入 + 去重（rapidfuzz 85 分阈值） |
| 4 | T037-T046 | 线索分配/抢占/释放/标丢失 + 大区规则引擎 |
| 5 | T047-T049 | 定时释放（APScheduler）+ 通知表 |
| 6 | T050-T056 | 线索转化 + Webhook + 客户管理 |
| 7 | T057-T066 | 跟进记录 + 关键事件 |
| 8-10 | T067-T080 | 转化窗口、联系人管理、日报 |
| 11-12 | T081-T094 | 权限管理 + Admin 后台 |
| 13 | T095-T105 | AI Agent chat sidebar & tool use |
| 14 | T106-T110 | 集成测试、通知铃铛、Dashboard |

后续修复：Copilot 端到端（DeepSeek Tool Use）、TypeScript 编译、Dashboard API、quickstart 文档拆分。

## 2026-03-29 ~ 03-30 · 阶段二：业务讨论 → Spec 设计

- 三次方向纠偏，最终确定 **Ontology 数据底座 + API-first + Copilot 三层架构**
- 完成 Ontology 设计（Lead/Customer 拆分、RBAC 四表、OrgNode 树、DataScope 五档）
- 引入 spec-kit，完成 constitution v1.1.0 + spec.md + plan.md + data-model.md + tasks.md（110 任务，14 Phase）
- 早期业务设计归档 `docs/early-design/`（已整合至 `specs/master/spec.md`）

## 2026-03-26 ~ 03-29 · 阶段一：方法论 → Skill

- 从两本书提炼方法论，产出 `/check-prd` Skill（17 文件，14 维度），在 8 份真实企业 PRD 上验证
- 独立仓库 `pmYangKun/check-prd-skill`
- **关键结论：check-prd 是旅途中的副产品，CRM 才是主线；两者完全独立，CRM 不绑书中方法论**（见 `feedback/feedback_crm_methodology.md`）
