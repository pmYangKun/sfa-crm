# API Contracts: 公网部署安全/治理硬化

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

本 feature **新增 2 个端点** + **改造 1 个端点**。所有端点遵循 SFA CRM 现有 RESTful 风格，路径前缀 `/api/v1/`。

---

## 1. 新增：`POST /api/v1/agent/llm-proxy`

**用途**：后端 LLM 代理；前端不再持有 LLM API Key（spec.md FR-030 / FR-031）。

**Auth**：JWT Bearer（需 `agent.chat` 权限）

**限流**：`@limiter.limit("10/minute;100/day")`（FR-007）+ prompt_guard + global circuit breaker

**Request Body**:
```json
{
  "messages": [
    {"role": "system" | "user" | "assistant" | "tool", "content": "..."},
    ...
  ],
  "tools": [
    {"name": "search_leads", "description": "...", "input_schema": {...}},
    ...
  ],
  "options": {
    "max_tokens": 4096,
    "temperature": 0.7
  }
}
```

**字段约束**：
- `messages`：数组长度 ≤ 50；每条 `content` 长度 ≤ 2000 字（spec.md FR-001 对最后一条 user message 严格 ≤ 2000）
- `tools`：可选，由后端在拼装时合并默认工具集；前端可不传
- `options`：可选，缺省走 SystemConfig 默认值

**Response**:
- **成功**：`HTTP 200`，`Content-Type: text/event-stream` 或 `application/x-ndjson`（chunked transfer），body 是流式 SSE 事件序列：
  ```
  data: {"type":"text_delta","delta":"你"}
  data: {"type":"text_delta","delta":"好"}
  data: {"type":"tool_use_start","tool_name":"search_leads","input":{...}}
  data: {"type":"tool_result","tool_use_id":"...","output":{...}}
  data: {"type":"done"}
  ```
- **被 prompt_guard 拦截**：`HTTP 200`（不报错，让前端正常渲染气泡），body 是单条 chunk：
  ```
  data: {"type":"text_delta","delta":"抱歉，这超出了我作为 SFA CRM 助手的能力范围"}
  data: {"type":"done","reason":"prompt_guard"}
  ```
- **被限流（429）**：`HTTP 429`，header `Retry-After: <seconds>`，body：
  ```json
  {"code":"RATE_LIMITED","scope":"minute"|"day","retry_after_seconds":42}
  ```
- **被全局熔断（503）**：`HTTP 503`，header `Retry-After: <seconds-to-next-hour>`，body：
  ```json
  {"code":"LLM_CIRCUIT_BREAKER_OPEN","retry_after_seconds":1800}
  ```
- **输入超长（422）**：`HTTP 422`，body：
  ```json
  {"code":"INPUT_TOO_LONG","detail":"消息长度 2156 超过上限 2000"}
  ```
- **JWT 无效（401）/ 权限不足（403）**：标准 FastAPI 行为

**前端处理**：
- 前端 [`src/frontend/src/app/api/chat/route.ts`](d:/MyProgramming/cc/SFACRM/src/frontend/src/app/api/chat/route.ts) 改成 `fetch('/api/v1/agent/llm-proxy', ...)` 接收 ReadableStream
- 429 / 503 → 转对话气泡友好提示（spec.md FR-008 / FR-010）
- 422 → 输入框下方红字提示
- prompt_guard 拦截响应跟正常响应在协议上一致（HTTP 200 + 流），前端无需特殊分支

**与现有 chat 端点关系**：
- 现有 `POST /api/v1/agent/chat` 端点保留但**改造**——本身不再调 LLM，而是作为前端 [`route.ts`](d:/MyProgramming/cc/SFACRM/src/frontend/src/app/api/chat/route.ts) 的"轻代理"，把 messages 透传到 `/llm-proxy`
- 等价方案：直接让前端调 `/llm-proxy`，去掉 `/chat` 中转层；初版保留 `/chat` 兼容现有调用方，spec 003 可清理

---

## 2. 新增：`GET /api/v1/agent/demo-reset-status`

**用途**：前端倒计时组件读取下次重置时间（spec.md FR-020）

**Auth**：JWT Bearer（任何已登录用户均可访问，无特殊权限）

**限流**：默认全局（不专门限流）

**Request**: 无 body

**Response 200**:
```json
{
  "enabled": true,
  "next_reset_at": "2026-05-04T14:30:00Z",
  "interval_minutes": 30,
  "server_time": "2026-05-04T14:01:23Z"
}
```

**字段说明**：
- `enabled`：从 `SystemConfig.demo_reset_enabled` 读
- `next_reset_at`：基于上次重置时间 + `interval_minutes` 推算；scheduler 每次跑完更新一个内存中的 `last_reset_at`，端点动态计算 next
- `interval_minutes`：从 `SystemConfig.demo_reset_interval_minutes` 读
- `server_time`：当前服务端时间，前端用来计算"剩余秒数 = next_reset_at - server_time"以纠正客户端时钟漂移（FR-022）

**Response when disabled**:
```json
{
  "enabled": false,
  "next_reset_at": null,
  "interval_minutes": null,
  "server_time": "2026-05-04T14:01:23Z"
}
```

**前端轮询频率**：每 60 秒（spec.md FR-022）；本地每 1 秒 tick 不需要请求后端。

---

## 3. 改造：`POST /api/v1/agent/llm-config/full`

**变更**：响应中**移除 `api_key` 字段**（spec.md FR-029）

**Before**:
```json
{
  "id": 1,
  "provider": "anthropic",
  "api_key": "sk-ant-...",  ← 危险
  "model_name": "claude-3-5-sonnet-20241022",
  "active": true
}
```

**After**:
```json
{
  "id": 1,
  "provider": "anthropic",
  "model_name": "claude-3-5-sonnet-20241022",
  "active": true,
  "api_key_present": true   ← 只告诉前端"是否已配置"，不下发明文
}
```

**调用方影响**：
- 前端 admin 页面 [`src/frontend/src/app/(authenticated)/admin/config/page.tsx`](d:/MyProgramming/cc/SFACRM/src/frontend/src/app/(authenticated)/admin/config/page.tsx)：原本展示 api_key 输入框预填明文 → 改为"已配置"标识 + "重新输入 key" 按钮（清空后输入新 key）
- 现有 chat route.ts：原本读 api_key 调 Anthropic SDK → 改为转发到 `/llm-proxy`（不再需要 api_key）

---

## 4. 改造：`POST /api/v1/agent/llm-config`（写入）

**变更**：写入时透明加密 `api_key`（spec.md FR-027）

**Request Body** 不变：
```json
{"provider": "anthropic", "api_key": "sk-ant-real-key", "model_name": "...", "active": true}
```

**后端处理变更**：
- 接收明文 api_key → Fernet 加密 → 存入 DB
- 失败处理：Fernet key 不可用 → 返回 500 + 错误信息"加密服务不可用，请联系管理员"

**Response 不变**：
```json
{"id": 1, "message": "saved"}
```

---

## 5. 现有 `POST /api/v1/agent/chat` 端点改造

**变更点**：
1. `ChatRequest.message` Pydantic 字段加 `max_length=2000`（spec.md FR-001）
2. 端点装饰 `@limiter.limit("10/minute;100/day")` + 限流 key 为 `(IP, user_id)`（FR-006 / FR-007）
3. 进入处理体时按顺序跑 4 个 gate：
   - prompt_guard.check(message) → 命中返回 200 + 固定话术 + 写 audit
   - SlowAPI minute limit → 命中 429 + 写 audit
   - SlowAPI daily limit → 命中 429 + 写 audit
   - llm_circuit_breaker.check() → 触发 503 + 写 audit
4. 全部通过后转发到 `/llm-proxy`（或调用 service 层共享逻辑）
5. 流式响应完成后的 `finally` 块写 audit（含输出摘要）+ 累加 llm_call_counter

**Request 不变**：
```json
{"message": "我想看华南那边的线索"}
```

**Response**：
- 不变（与 spec 001 现状一致）
- 新增可能的错误响应：429 / 503 / 422，前端按 §1 规则处理

---

## 6. 端点访问矩阵

| 端点 | Auth | 限流 | prompt_guard | circuit_breaker | audit |
|---|---|---|---|---|---|
| `POST /agent/chat` | JWT + agent.chat | ✅ 10/min;100/day | ✅ | ✅ | ✅ |
| `POST /agent/llm-proxy` | JWT + agent.chat | ✅ 同上 | ✅ | ✅ | ✅ |
| `GET /agent/demo-reset-status` | JWT | ❌ | ❌ | ❌ | ❌ |
| `POST /agent/llm-config` | JWT + config.manage | 无 | ❌ | ❌ | ✅（已有） |
| `POST /agent/llm-config/full` | JWT + config.manage | 无 | ❌ | ❌ | ✅（已有） |

---

## 7. 错误响应统一格式

所有 4xx/5xx 响应遵循现有 [`src/backend/app/main.py`](d:/MyProgramming/cc/SFACRM/src/backend/app/main.py) 的全局异常处理器格式：
```json
{"code": "ERROR_CODE", "message": "human-readable", "detail": <optional struct>}
```

新增错误代码：
- `RATE_LIMITED`（429）
- `LLM_CIRCUIT_BREAKER_OPEN`（503）
- `INPUT_TOO_LONG`（422）
- `PROMPT_GUARD_REJECTED`（仅 audit 内部用，外部 HTTP 200）
- `FERNET_KEY_UNAVAILABLE`（500）
- `LLM_PROVIDER_ERROR`（502，LLM provider 自身报错时透传）

---

## 8. 输出

✅ API Contracts 完成。覆盖 spec.md 所有涉及 API 的 FR：FR-001 / FR-006~011 / FR-020 / FR-027~031。
