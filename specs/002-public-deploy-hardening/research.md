# Phase 0 Research: 公网部署安全/治理硬化

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Date**: 2026-05-04

本阶段集中决策 7 个技术问题，作为 Phase 1 设计的输入。所有 [NEEDS CLARIFICATION] 在此解决。

---

## Decision 1: 限流 key 的组合策略

**Decision**: 限流 key 用 `(client_ip, user_id)` 组合（未登录请求 fallback 仅 `client_ip`）。

**Rationale**:
- 单看 `user_id` → 同账号被多 IP 复用绕过限流（spec.md Edge Case 第 8 条）
- 单看 `client_ip` → 共用 NAT 出口的多个真实访客被互相牵连（公司网 / 学校网 / 商业大楼）
- 组合 key 让"同 IP 同账号"被独立计数：单 IP 多账号刷与单账号多 IP 刷都拦得住，但合法多用户共用 NAT 不会互相牵连
- 实施成本低：现有 SlowAPI 的 `get_user_id_key` 函数 [`src/backend/app/services/rate_limiter.py:1-21`](d:/MyProgramming/cc/SFACRM/src/backend/app/services/rate_limiter.py) 改成返回 `f"{ip}:{user_id}"` 字符串即可

**Alternatives Considered**:
- **仅 user_id**：现状即此方案，已被 spec 否决
- **仅 IP**：误伤共用 NAT 的合法访客，B 端 PM 群体常在公司网内访问演示站
- **(IP, user_id, ua_hash) 三元组**：粒度更细但 ua 可被脚本伪造，不增加实质安全性反而误伤切换浏览器的同一访客

---

## Decision 2: 全站 LLM 调用熔断的存储后端

**Decision**: 用 **SQLite 原子表 `llm_call_counter`** 按小时桶计数（每行 `(hour_bucket TEXT, count INTEGER)`，主键是 hour_bucket）。

**Rationale**:
- 阈值低（200 次/小时）→ 不需要 Redis 级别的高频原子操作
- SQLite WAL 模式下 `INSERT OR REPLACE` + `UPDATE counter SET count = count + 1 WHERE hour_bucket = ?` 行级锁足够这个 QPS
- 与 spec 002 "不引入新依赖" 约束一致（plan.md Constraints）
- 半小时重置时被清空，自然实现"按时间桶滚动"
- 老的 hour_bucket 行也会被重置一并清掉，无需额外清理任务

**Alternatives Considered**:
- **Redis**：标准方案但要新引入依赖；本 feature 量级 + Redis 部署成本（云厂商多收钱 + 一份维护负担）不划算
- **进程内内存 dict**：uvicorn 多 worker 时计数会分裂；公网部署可能起 2-4 worker，每个 worker 自己的 200 限额 = 实际全站 800 限额，失去全局熔断含义
- **APScheduler 持久化 store**：杀鸡用牛刀，且 APScheduler 自身的 jobstore SQL 表不适合做计数器

---

## Decision 3: Prompt Guard 黑名单的拦截策略

**Decision**: **软拦截**——命中黑名单返回固定友好话术 "抱歉，这超出了我作为 SFA CRM 助手的能力范围"，访客可继续对话；命中事件写 `chat_audit` 表供词表迭代。

**Rationale**:
- 硬拦截（封号 / 加黑名单 IP）会误伤合法 B 端 PM 用户讨论 "prompt 工程"、"system prompt 设计" 等正当话题（spec.md Edge Case 第 3 条）
- 软拦截配合 audit 日志，运维事后可分析"被拦的真是攻击 vs 合法语境"，迭代词表
- 即便恶意访客试图反复越狱，每次拦截不消耗 LLM token（spec.md FR-011），账单层面已经安全了
- 配合限流（10/分 + 100/天），恶意试探的总尝试次数也是封顶的

**Alternatives Considered**:
- **硬拦截 + 24h IP 封禁**：误伤代价过高；管理界面也要做"解封"功能，工作量增加 deferred 不合理
- **LLM judge 二次校验**：spec brainstorming 阶段已被用户否决（成本翻倍但收益边际，alignment.md Q4 答案）
- **完全不拦截，靠 LLM 自身识别**：LLM 自身识别有泄漏风险（system prompt 内容可能被回显），且测试样本不可控

**初始黑名单词表**（存 `SystemConfig.prompt_guard_keywords`，运维可改）：
```
忽略上述
忽略以上
ignore previous
ignore above
disregard instructions
disregard above
system prompt
原始 prompt
原始指令
你现在是
你将扮演
扮演一个
不受任何限制
no restrictions
override your
jailbreak
DAN mode
开发者模式
developer mode
```
匹配采用大小写不敏感的子串包含检查。

---

## Decision 4: 半小时数据重置的实现方式

**Decision**: **SQL 级 TRUNCATE（DELETE FROM）+ 重新种入种子**，包在事务里；**不复用** `reset-demo.bat` 删文件方案。

**Rationale**:
- 删 sqlite 文件三件套（`*.db` / `*.db-wal` / `*.db-shm`）需要 uvicorn 进程重启才能重建连接，会中断在线访客；scheduler 跑这个会让自己的 SQLAlchemy session 无效化
- SQL 级 DELETE 在事务里执行，连接池正常工作；并发请求最坏情况是写入被排到事务后（毫秒级延迟）
- 与 [`init_db.py:174-178`](d:/MyProgramming/cc/SFACRM/src/backend/app/core/init_db.py) 的幂等检查不冲突——本 feature 通过 `seed_demo_business_data()` 函数复用种子代码，不调用 `init_db()` 全函数
- 失败可回滚：事务包裹 DELETE + INSERT，中途失败不会留下"清空但未重新种入"的尴尬态

**Alternatives Considered**:
- **删文件 + 重启进程**：体验差，访客被踢出会话；与 spec.md FR-017 "重置不影响 JWT" 冲突
- **DROP TABLE + recreate**：复杂度过高，要重建索引、外键、触发器；SQLModel 的 metadata 管理复杂
- **备份恢复**：开机 dump 一份种子 db → 半小时 cp 覆盖 → 文件级 atomicity 难保证；同样要进程重启
- **逻辑标记 + 软删除**：数据膨胀，查询需 WHERE deleted_at IS NULL，影响业务代码（违反约束"不动业务代码"）

**清空表清单**（spec.md FR-013）：
```
lead, customer, contact, followup, key_event, notification,
chat_audit, llm_call_counter
```
**保留表清单**（spec.md FR-014）：
```
user, role, permission, role_permission, user_role,
org_node, user_data_scope, system_config, llm_config
```

执行顺序：先按外键依赖反序 DELETE（叶子表先删 → 主表后删），再调 `seed_demo_business_data()` 重新种入。事务级别 SERIALIZABLE，并发写入会等待。

---

## Decision 5: 前端倒计时小气泡的位置与挂载

**Decision**: **挂载点** = `(authenticated)/layout.tsx` + `m/(mobile-app)/layout.tsx`（PC + mobile 同时挂）；**位置** = 右下角，PC 端 `position: fixed; right: 24px; bottom: 96px`（错开 spec 001 的 chat launcher `bottom: 24px`），mobile 端 `right: 16px; bottom: 80px`（错开金刚区 tabbar）。

**Rationale**:
- 全局挂在 layout 而非每个页面手动加 → 自动覆盖所有 authenticated 路由
- PC 与 mobile 用同一个组件 + 不同的 fixed 偏移参数，组件用 `useIsMobile()` hook（spec 001 已实现）切换样式
- 错开 chat launcher 与金刚区，确保点击不被遮挡（spec.md FR-021 强约束）
- 视觉上倒计时与 chat launcher 在右下"垂直堆叠"，形成统一的"角落控件群"

**Alternatives Considered**:
- **挂在每个页面顶部**：跟随页面滚动会消失，不符合"持续可见"的 demo 体验需求
- **左下角**：与 sidebar 折叠按钮在 PC 端冲突
- **顶部右上**：跟通知铃铛冲突，spec 001 已经为铃铛留了 60px 右边距
- **悬浮中心提示**：打扰访客操作，过于显眼

**剩余 < 60s 警示**：背景从 `bg-slate-100` 切到 `bg-orange-100`，文案从 "⟳ 演示数据 X:XX 后重置" 改 "⟳ 演示数据将在 XX 秒后重置"。不弹模态、不阻塞操作。

---

## Decision 6: LLM API Key 加密的密钥管理

**Decision**: 用 Python `cryptography` 包的 **Fernet**（AES-128-CBC + HMAC-SHA256）；密钥来自 env `LLM_KEY_FERNET_KEY`；生产 ENV 缺失 → 拒绝启动；dev ENV 缺失 → fallback 固定 dev key + warning。

**Rationale**:
- Fernet 是 cryptography 推荐的"开箱即用"对称加密方案，自带 versioning 与时间戳，未来 rotate 不破坏老密文
- 单密钥管理简单：所有 `llm_config.api_key` 用同一个 Fernet key 加解密
- 不引入额外密钥管理服务（HashiCorp Vault / AWS KMS）：与 spec 002 "不引入新依赖" 约束一致；运维成本与 demo 站规模匹配
- dev fallback 让本地开发不卡壳；prod 强制让运维必须显式配置

**Alternatives Considered**:
- **AES-GCM 自己写**：Fernet 已封装好认证加密 + IV 生成，自己写易出错
- **数据库列级加密 (SQLCipher)**：需要替换 SQLite 驱动，影响面大
- **不加密**：DB 备份/泄露 = key 泄露；spec.md FR-027 / SC-010 强约束加密
- **环境变量直接存 LLM key（不入 DB）**：Admin UI 配置 LLM 的能力丢失，违反"管理员可切换 Provider"宪法约束

**Rotate 策略（本 spec 不实现，记录给 spec 003）**：未来需要 rotate Fernet key 时，提供管理脚本 `python -m app.scripts.rotate_fernet_key OLD NEW`：用旧 key 解密所有 `llm_config.api_key` → 用新 key 重新加密 → 提示运维更新 env。本 spec 只在 deploy.md 警告"丢 key = 全部解密失败"。

---

## Decision 7: 后端 LLM 代理的流式响应技术路径

**Decision**: **FastAPI `StreamingResponse` + HTTP chunked transfer**，前端 Vercel AI SDK 通过 fetch 接收 chunked body 自行解析（保持现有 AI SDK 用法不大改）。

**Rationale**:
- 现状前端用 `@vercel/ai` 的 `streamText()` 直接调 Anthropic SDK；改后端代理后前端调 `fetch('/api/v1/agent/llm-proxy', {method: 'POST'})` 拿 ReadableStream
- chunked transfer 是 HTTP/1.1 标准，所有现代浏览器 + Nginx 默认支持，无需特殊配置
- FastAPI `StreamingResponse(generator, media_type="text/event-stream"|"application/x-ndjson"|"text/plain")` 一行配置
- 后端在 generator 中 `async for chunk in anthropic_client.messages.stream(...)` 边读边 yield，不缓冲整个响应
- Nginx 反向代理需关 `proxy_buffering off`，deploy.md 中明确写

**Alternatives Considered**:
- **Server-Sent Events (SSE)**：标准更明确，但浏览器 EventSource API 不支持 POST（要用 GET），意味着把整个 chat 历史塞 query string，不实用；用 fetch 模拟 SSE 的话其实就是 chunked transfer
- **WebSocket**：双向通信能力本 feature 用不上，引入连接管理复杂度
- **轮询 + 状态查询**：极差体验，访客感知"AI 在卡顿"；spec.md SC-001 不允许

**实施细节**：
- 端点 `POST /api/v1/agent/llm-proxy`
- 入参：`{messages: ChatMessage[], tools: Tool[]?, ...}` （结构与现有 chat route.ts 内部传给 Anthropic SDK 的结构一致）
- 返参：chunked stream，每个 chunk 是 LLM 输出的增量 token + tool_use 事件（按 Vercel AI SDK 协议格式）
- 后端解密 LLM API Key（Fernet）→ 用 SDK 调 LLM provider → 流式转发
- Tool definitions 在后端写死（沿用 [`src/frontend/src/app/api/chat/route.ts:111-187`](d:/MyProgramming/cc/SFACRM/src/frontend/src/app/api/chat/route.ts) 现有定义，迁移到后端 `agent_service.py`）
- System prompt 由后端从 DB 拼装 + 边界条款（spec.md FR-004）

**风险与缓解**：
- 风险：Vercel AI SDK 协议格式严格，后端转发时格式不对 → 前端 stream 解析报错
- 缓解：在 research 阶段先 prototype 一次（最小 hello world），跑通"前端 fetch → 后端 LLM 调用 → 流式 chunk 返回"，再把生产代码切过去
- 备选回退：如果 chunked + AI SDK 协议适配复杂度过高，降级为"非流式整体响应"（用户体验差但功能可用）

---

## 跨决策一致性检查

- **Decision 1 与 Decision 2 协同**：限流计数（per (IP, user_id)）与全局 LLM 计数（per hour bucket）是两套独立计数器，分别用 SlowAPI 内置存储 + 自建 SQLite 表，不冲突
- **Decision 3 与 Decision 6 协同**：Prompt Guard 命中时不进 LLM = 不调用 `/llm-proxy` = 不解密 Fernet = 性能优；audit 写入只记输入摘要不记 LLM 响应（拦截了哪有响应）
- **Decision 4 与 Decision 5 协同**：scheduler 触发重置后，前端倒计时下个 sync（最多 60 秒后）会拿到新的 `next_reset_at`，自动归零开始下一轮；用户感知是"倒计时跳到 30:00"
- **Decision 7 与 Decision 6 协同**：流式响应中如果 LLM API Key 解密失败（Fernet 异常），后端返回 500 + 友好错误；前端转气泡"演示站当前不可用"

---

## 输出

✅ 所有 [NEEDS CLARIFICATION] 已解决，Phase 0 完成。

**下一步**：Phase 1 设计与契约
- `data-model.md`：`chat_audit` / `llm_call_counter` 表结构；5 个新 SystemConfig key；llm_config.api_key 加密存储语义
- `contracts/api-contracts.md`：`/agent/llm-proxy` 与 `/agent/demo-reset-status` 两个新端点的请求/响应契约
- `contracts/config-contracts.md`：5 个 SystemConfig key 与 .env 字段的契约（默认值 / 类型 / 校验规则）
- `quickstart.md`：4 类人工验收步骤（公网部署 / 限流验证 / 重置验证 / 倒计时验证）
