# API Contracts: MEDDICC 销售视角

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Data Model**: [data-model.md](../data-model.md)

本 feature **新增 8 个 REST 端点** + **新增 1 个 chat tool**。所有端点遵循 SFA CRM 现有 RESTful 风格，路径前缀 `/api/v1/`。所有端点要求 JWT Bearer Auth + 应用 DataScope 数据权限。

---

## 端点总览

| # | Method | Path | 用途 | LLM 调用 |
|---|---|---|---|---|
| 1 | GET | `/api/v1/leads/{lead_id}/conversations` | 列出对话 | 否 |
| 2 | POST | `/api/v1/leads/{lead_id}/conversations` | 新增对话 + 同步触发 analyze | 是 |
| 3 | DELETE | `/api/v1/conversations/{id}` | 删对话 + 同步触发 analyze | 是 |
| 4 | GET | `/api/v1/leads/{lead_id}/meddicc` | 取仪表盘数据 | 否 |
| 5 | POST | `/api/v1/leads/{lead_id}/meddicc/analyze` | 手动触发 AI 分析 | 是 |
| 6 | DELETE | `/api/v1/meddicc-evidence/{id}` | 删单条证据 + 重算 | 否 |
| 7 | GET | `/api/v1/leads/{lead_id}/scenario-cards` | 列出该 lead 适用的场景卡 | 否 |
| 8 | POST | `/api/v1/leads/{lead_id}/scenario-cards/{card_id}/apply` | 应用场景卡 = 批量插对话 + 同步 analyze | 是 |

**LLM 调用端点（2/3/5/8）共享限流**：`@limiter.limit("10/minute;100/day")`（沿用 spec 002 SystemConfig 配置）+ 全局熔断 200/小时。

---

## 1. `GET /api/v1/leads/{lead_id}/conversations`

**用途**：列出指定 lead 的所有对话记录，按 `recorded_at` 降序。

**Auth**: JWT Bearer + DataScope（lead 必须对当前用户可见）

**限流**: 不限流（GET 读操作）

**Path Params**:
- `lead_id` (str): Lead UUID

**Response 200**:
```json
{
  "lead_id": "uuid-xxx",
  "count": 5,
  "conversations": [
    {
      "id": "conv-001",
      "lead_id": "uuid-xxx",
      "recorded_at": "2026-05-04T14:00:00Z",
      "content": "销售：赵总您好...\n客户：是的，我们最近...",
      "source": "manual",
      "scenario_card_id": null,
      "created_by": "user-id",
      "created_at": "2026-05-04T14:01:23Z"
    },
    ...
  ]
}
```

**Errors**:
- `403`: lead 对当前用户不可见
- `404`: lead 不存在

---

## 2. `POST /api/v1/leads/{lead_id}/conversations`

**用途**：手动新增对话记录，**保存后同步触发** `meddicc_extractor.analyze(lead_id)`，返回新仪表盘。

**Auth**: JWT Bearer + DataScope

**限流**: `@limiter.limit("10/minute;100/day")` + 全局熔断 200/小时

**Path Params**:
- `lead_id` (str): Lead UUID

**Request Body**:
```json
{
  "recorded_at": "2026-05-04T14:00:00Z",
  "content": "销售：赵总您好...\n客户：..."
}
```

**字段约束**:
- `recorded_at`: ISO 8601, 必填，必须 ≤ now()
- `content`: 必填，1-50000 字
- `source`: 不接受客户端传值（后端固定 `manual`）
- `scenario_card_id`: 不接受客户端传值（保持 `null`）
- `created_by`: 不接受客户端传值（取 JWT user_id）

**Response 201**:
```json
{
  "conversation": { /* 新建的 Conversation 对象 */ },
  "dashboard": { /* 触发 analyze 后的 DashboardData，见 #4 */ }
}
```

**Errors**:
- `400`: content 太长 / recorded_at 格式错误 / recorded_at 在未来
- `403`: lead 对当前用户不可见
- `404`: lead 不存在
- `429`: 限流命中
- `503`: 全局熔断 / LLM 抽证据失败

---

## 3. `DELETE /api/v1/conversations/{id}`

**用途**：删除单条对话；**删除后同步触发** `analyze(lead_id)` 重算（因上下文变化）。

**Auth**: JWT Bearer + DataScope（基于 conversation.lead_id 反查 lead 的 owner）

**限流**: `@limiter.limit("10/minute;100/day")` + 全局熔断 200/小时（视作 LLM 调用）

**Path Params**:
- `id` (str): Conversation UUID

**Response 200**:
```json
{
  "deleted": true,
  "lead_id": "uuid-xxx",
  "dashboard": { /* 重算后的 DashboardData */ }
}
```

**Errors**:
- `403`: 对应 lead 对当前用户不可见
- `404`: conversation 不存在
- `429`: 限流命中
- `503`: 全局熔断

---

## 4. `GET /api/v1/leads/{lead_id}/meddicc`

**用途**：返回 MEDDICC 仪表盘数据（按 7 维度聚合 + score + completion + last_analyzed_at）。

**Auth**: JWT Bearer + DataScope

**限流**: 不限流

**Path Params**:
- `lead_id` (str): Lead UUID

**Response 200**:
```json
{
  "lead_id": "uuid-xxx",
  "meddicc_score": 78,
  "meddicc_completion": 6,
  "last_analyzed_at": "2026-05-05T10:30:00Z",
  "dimensions": [
    {
      "dimension": "metrics",
      "is_lit": true,
      "count": 3,
      "evidences": [
        {
          "id": "ev-001",
          "lead_id": "uuid-xxx",
          "dimension": "metrics",
          "source_type": "conversation",
          "source_id": "conv-001",
          "evidence_text": "现在每月业绩 200 万，希望提到 300 万",
          "confidence": 0.9,
          "created_at": "2026-05-05T10:30:00Z"
        },
        ...
      ]
    },
    {
      "dimension": "economic_buyer",
      "is_lit": true,
      "count": 1,
      "evidences": [...]
    },
    ...
    {
      "dimension": "decision_process",
      "is_lit": false,
      "count": 0,
      "evidences": []
    },
    ...
  ]
}
```

**返回保证**：`dimensions` 数组**总是 7 个元素**（按 metrics / economic_buyer / decision_criteria / decision_process / pain / champion / competition 顺序），即使没证据也返回 `is_lit: false, count: 0, evidences: []`，前端无需处理"维度缺失"。

**Errors**:
- `403`: lead 对当前用户不可见
- `404`: lead 不存在

---

## 5. `POST /api/v1/leads/{lead_id}/meddicc/analyze`

**用途**：手动触发 AI 抽证据（用户点"重新分析"按钮 / chat 调 analyze_meddicc tool）。

**Auth**: JWT Bearer + DataScope

**限流**: `@limiter.limit("10/minute;100/day")` + 全局熔断 200/小时

**Path Params**:
- `lead_id` (str): Lead UUID

**Request Body**: 空（POST 触发，无参数）

**Response 200**:
```json
{
  "analyzed_at": "2026-05-05T10:30:00Z",
  "evidence_count": 9,
  "skipped_count": 1,
  "dashboard": { /* 新 DashboardData，结构见 #4 */ }
}
```

**字段说明**:
- `evidence_count`: 实际写入的 evidence 数
- `skipped_count`: 因 LLM 幻觉 source_id 等原因跳过的数（research.md Decision 6）

**特殊响应 — 上下文为空**：
```json
{
  "analyzed_at": "2026-05-05T10:30:00Z",
  "evidence_count": 0,
  "skipped_count": 0,
  "dashboard": { /* 7 维度全为 is_lit: false，score=0 */ },
  "message": "线索暂无对话/跟进/事件记录，请先录入"
}
```
（此情况不调 LLM，直接返回；FR-010）

**Errors**:
- `403`: lead 对当前用户不可见
- `404`: lead 不存在
- `429`: 限流命中
- `503`: 全局熔断 / LLM JSON 解析连续失败 / LLM 超时（>15s）

---

## 6. `DELETE /api/v1/meddicc-evidence/{id}`

**用途**：删除单条证据；**同步重算 Lead.meddicc_score**。

**Auth**: JWT Bearer + DataScope（基于 evidence.lead_id 反查 lead 的 owner）

**限流**: 不限流（GET/DELETE 不调 LLM）

**Path Params**:
- `id` (str): Evidence UUID

**Response 200**:
```json
{
  "deleted": true,
  "lead_id": "uuid-xxx",
  "dashboard": { /* 重算后的 DashboardData */ }
}
```

**Errors**:
- `403`: 对应 lead 对当前用户不可见
- `404`: evidence 不存在

---

## 7. `GET /api/v1/leads/{lead_id}/scenario-cards`

**用途**：列出该 lead 适用的演示场景卡（按 `applies_to_lead_company == lead.company_name` 筛选）+ 每张卡是否已应用过。

**Auth**: JWT Bearer + DataScope

**限流**: 不限流

**Path Params**:
- `lead_id` (str): Lead UUID

**Response 200**:
```json
{
  "lead_id": "uuid-xxx",
  "lead_company": "深圳前海微链",
  "cards": [
    {
      "id": "scenario_001_kp_first_visit",
      "title": "拜访赵总（首次深聊）",
      "description": "演示 EB / Pain / D-Process 三个维度的证据抽取",
      "applies_to_lead_company": "深圳前海微链",
      "applied": false,
      "conversation_count": 1
    },
    {
      "id": "scenario_002_champion_emerges",
      "title": "Champion 涌现",
      "description": "演示 Champion / D-Process 维度抽取",
      "applies_to_lead_company": "深圳前海微链",
      "applied": true,
      "conversation_count": 1
    },
    ...
  ]
}
```

**字段说明**:
- `applied`: 通过查 `conversation` 表 `WHERE lead_id = X AND scenario_card_id = card.id` count > 0 计算
- `conversation_count`: 该卡片定义的对话数（用于 UI 显示"将注入 N 条对话"）

**特殊处理**：若 `lead.company_name` 在 `SCENARIO_CARDS` 中无任何匹配，`cards` 返回空数组（前端不显示场景卡区域）。

**Errors**:
- `403`: lead 对当前用户不可见
- `404`: lead 不存在

---

## 8. `POST /api/v1/leads/{lead_id}/scenario-cards/{card_id}/apply`

**用途**：一键应用场景卡 = 批量插对话 + 同步触发 analyze + 返回新仪表盘。

**Auth**: JWT Bearer + DataScope

**限流**: `@limiter.limit("10/minute;100/day")` + 全局熔断 200/小时

**Path Params**:
- `lead_id` (str): Lead UUID
- `card_id` (str): Scenario card 字典 key（如 `scenario_001_kp_first_visit`）

**Request Body**: 空

**Response 200**:
```json
{
  "applied_at": "2026-05-05T10:30:00Z",
  "card_id": "scenario_001_kp_first_visit",
  "inserted_conversation_ids": ["conv-008", "conv-009"],
  "dashboard": { /* 新 DashboardData */ }
}
```

**前置校验（按顺序）**:
1. lead 必须对当前用户可见（DataScope）→ 403
2. card_id 在 `SCENARIO_CARDS` 字典中存在 → 404
3. card 的 `applies_to_lead_company` 必须等于 `lead.company_name` → 400 "该卡不适用于此线索"
4. card 未应用过（防重复）→ 400 "该卡已应用过，无需重复"

**Errors**:
- `400`: 卡不适用 / 已应用过
- `403`: lead 对当前用户不可见
- `404`: lead 或 card_id 不存在
- `429`: 限流命中
- `503`: 全局熔断 / LLM 抽证据失败

---

## 9. Chat Tool: `analyze_meddicc`（新增）

**用途**：让 LLM 在 chat 自然语言对话中调用此工具，触发 MEDDICC 分析并返回结构化结果，前端渲染为 `ChatMeddiccReportCard`。

**Tool Definition**（注册到 `agent_service.TOOL_DEFINITIONS`）:

```python
{
    "name": "analyze_meddicc",
    "mode": "read",  # 概念上是读 + 写自己派生数据，不视为业务写入
    "description": "分析指定线索的 MEDDICC 7 维度，从对话/跟进/关键事件中抽取证据。当用户问'分析 XX 这条线索'/'看看 XX 的状态'/'重新分析 XX'时调用。",
    "parameters": {
        "type": "object",
        "properties": {
            "lead_id": {
                "type": "string",
                "description": "线索 ID。如果用户给的是公司名，先调 search_leads 获取 ID。"
            }
        },
        "required": ["lead_id"]
    }
}
```

**Tool 执行逻辑**（`agent_service.execute_tool`）:

```python
elif tool_name == "analyze_meddicc":
    # 1. 校验 lead_id 存在 + DataScope
    lead = session.get(Lead, args["lead_id"])
    if not lead:
        return {"success": False, "message": "线索不存在"}
    # ... DataScope 检查 ...

    # 2. 调 service（service 内部会限流 + 熔断 + 写 audit）
    from app.services.meddicc_extractor import analyze
    result = analyze(args["lead_id"], session, current_user_id=user_id)

    # 3. 返回结构化结果给 LLM 拼装回复
    return {
        "success": True,
        "lead_id": args["lead_id"],
        "company_name": lead.company_name,
        "meddicc_score": result.score,
        "meddicc_completion": result.completion,
        "dimensions": result.dimensions,  # 7 个 DimensionStatus
        "next_best_action": _generate_nba(result),  # 前端常量字典本地查
        "render_card": True,  # 前端识别此 flag → 渲染 ChatMeddiccReportCard
    }
```

**前端渲染**（chat-sidebar.tsx / chat-fullscreen.tsx）:

LLM 返回的 tool result 中若 `render_card: true`，渲染 `<ChatMeddiccReportCard data={...} />` 而非纯文本。视觉沿用 `ChatFormCard` 模式。

---

## 10. 跨端点共享：`DashboardData` Schema

```typescript
interface DashboardData {
  lead_id: string;
  meddicc_score: number;          // 0-100
  meddicc_completion: number;     // 0-7
  last_analyzed_at: string | null;
  dimensions: DimensionStatus[];  // 长度恒为 7（按固定顺序）
}

interface DimensionStatus {
  dimension: 'metrics' | 'economic_buyer' | 'decision_criteria' |
             'decision_process' | 'pain' | 'champion' | 'competition';
  is_lit: boolean;
  count: number;
  evidences: Evidence[];
}

interface Evidence {
  id: string;
  lead_id: string;
  dimension: Dimension;
  source_type: 'conversation' | 'followup' | 'key_event';
  source_id: string;
  evidence_text: string;
  confidence: number;
  created_at: string;
}
```

后端 SQLModel → response model 转换通过 Pydantic v2 schemas 完成，文件 `app/schemas/meddicc_schemas.py`（实施时新增）。

---

## 11. 限流与审计接入摘要

| 端点 | 限流 | 全局熔断 | chat_audit |
|---|---|---|---|
| GET /conversations | ❌ | ❌ | ❌ |
| POST /conversations | ✅ 10/min, 100/day | ✅ 200/hour | ✅ |
| DELETE /conversations/{id} | ✅ | ✅ | ✅ |
| GET /meddicc | ❌ | ❌ | ❌ |
| POST /meddicc/analyze | ✅ | ✅ | ✅ |
| DELETE /meddicc-evidence/{id} | ❌ | ❌ | ❌ |
| GET /scenario-cards | ❌ | ❌ | ❌ |
| POST /scenario-cards/{id}/apply | ✅ | ✅ | ✅ |
| chat tool analyze_meddicc | ✅（沿用 chat 端点既有限流） | ✅ | ✅ |

`chat_audit` 写入字段约定：
- `user_id`: 当前 JWT user
- `client_ip`: from request.headers
- `endpoint`: e.g. `meddicc.analyze`
- `input_summary`: e.g. `"lead_id=uuid-xxx, conversation_count=5"`
- `success`: True/False
- `latency_ms`: 完整请求耗时
- `error`: 失败时的错误摘要

---

## 12. 错误响应统一格式

沿用 spec 001/002 既有 `HTTPException` + FastAPI 自动响应：

```json
{
  "detail": "线索不存在"
}
```

或前端友好版（被 chat 拦截 / 全局熔断时）：

```json
{
  "detail": "AI 分析失败，请稍后重试",
  "code": "llm_circuit_open",
  "retry_after_seconds": 1800
}
```

---

## 13. api-contracts.md 完成状态

✅ 8 个 REST 端点契约（含 path / params / body / response / errors / 限流）
✅ 1 个 chat tool 定义（含 schema + 执行逻辑 + 前端渲染衔接）
✅ DashboardData / Evidence 共享 schema
✅ 限流与审计接入矩阵
✅ 错误响应统一格式

**下一步**：进入 `quickstart.md` 写人工验收路径（演示用户视角的 5-6 步路径）。
