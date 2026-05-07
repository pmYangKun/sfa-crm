# Spec 004 API Contracts

---

## 1. `GET /api/manager/pipeline`

**用途：** 经理 Pipeline 全表数据源

**Auth：** 需登录；DataScope 自动应用

**Query params：**
- `forecast_category` (optional, string) —— filter to one of 6 categories
- `owner_id` (optional, string) —— filter to specific sales (drill-down 用)
- `sort_by` (optional, default `score_asc`) —— `score_asc` / `score_desc` / `amount_desc` / `close_date_asc`
- `limit` (default 50)
- `offset` (default 0)

**Response 200：**
```json
{
  "leads": [
    {
      "id": "uuid",
      "company_name": "深圳前海微链",
      "owner": {"id": "uuid", "name": "王小明", "avatar_url": "..."},
      "amount": 100000,
      "close_date": "2026-06-15",
      "forecast_category": "必赢",
      "stage": "active",
      "meddicc_score": 69,
      "meddicc_completion": 5,
      "dimensions_lit": ["M", "D", "D", "I", "C"],
      "warnings": [
        {"code": "brag_without_evidence", "mitigation": "MEDDICC 维度还不够全..."}
      ],
      "warnings_count": 1,
      "last_activity_at": "2026-05-04T12:00:00Z",
      "next_call_at": "2026-05-10",
      "contacts_count": 3
    }
  ],
  "total": 27,
  "category_counts": {
    "进行中": 8, "必赢": 3, "大概率": 5, "乐观估算": 4, "已赢单": 6, "已丢单": 1
  },
  "category_warning_counts": {
    "进行中": 2, "必赢": 1, ...
  }
}
```

**Errors：**
- 401: 未登录
- 403: 无权限（DataScope 内查不到）

---

## 2. `GET /api/manager/team-rollup`

**用途：** Team 视图聚合数据

**Auth：** 需登录；DataScope 自动应用（manager 看下属，admin 全看）

**Query params：**
- `sort_by` (optional, default `score_asc`)
- `limit` / `offset`

**Response 200：**
```json
{
  "rows": [
    {
      "sales": {"id": "uuid", "name": "王小明", "avatar_url": "..."},
      "active_lead_count": 5,
      "avg_meddicc_score": 67.4,
      "warnings_count": 4,
      "total_amount": 800000,
      "last_activity_at": "2026-05-04T12:00:00Z"
    }
  ],
  "total": 3
}
```

---

## 3. `POST /api/leads/{lead_id}/validate-forecast`

**用途：** AI 校验某条 lead 升级 forecast_category 的合理性

**Auth：** 需登录；用户 MUST 对该 lead 有写权限

**Request Body：**
```json
{
  "target_category": "必赢"
}
```

**Response 200（含 verdict）：**
```json
{
  "verdict": "challenge",
  "reasoning": "Champion 维度还空着，Decision Process 维度只有 1 条证据。",
  "suggested_category": "大概率",
  "missing_dimensions": ["Champion", "Decision Process"]
}
```

verdict 值：`support` / `challenge` / `abstain`

**Errors：**
- 400: target_category 不合法 / 不需要校验（不是必赢/大概率）
- 401/403: 权限问题
- 408: LLM timeout（前端 fallback 直接放行）
- 503: 全站 LLM 熔断

**Cache 策略：** 同一 lead_id + target_category 60s 内命中 cache，直接返回上次结果。

---

## 4. `GET /api/leads/{lead_id}/meddicc-history`

**用途：** 趋势图数据源

**Auth：** 需登录；DataScope 自动应用

**Query params：**
- `since_days` (optional, default 30)
- `limit` (optional, default 50)

**Response 200：**
```json
{
  "snapshots": [
    {
      "snapshot_at": "2026-05-01T10:00:00Z",
      "meddicc_score": 45,
      "meddicc_completion": 3,
      "trigger_reason": "backfill"
    },
    {
      "snapshot_at": "2026-05-03T14:30:00Z",
      "meddicc_score": 60,
      "meddicc_completion": 4,
      "trigger_reason": "analyze"
    }
  ],
  "lead_id": "uuid"
}
```

---

## 5. `PUT /api/leads/{lead_id}` 增强

**变更：** 接受 spec 004 新加的 3 个字段

**Request Body（增量字段）：**
```json
{
  "amount": 100000,                  // 可选，REAL
  "close_date": "2026-06-15",        // 可选，ISO date
  "forecast_category": "必赢"         // 可选，6 选 1
}
```

**侧效应：**
- 如果 forecast_category 变更，写一行 `lead_meddicc_history` snapshot（trigger_reason='forecast_change'）
- 如果改成 stage 衍生值（'已赢单'/'已丢单'），同步更新 `lead.stage`（保持 invariant）

**Errors：**
- 400: forecast_category 不在 6 选 1 中

---

## 6. Chat Agent Tools (function call)

不通过 REST 暴露，走 Vercel AI SDK / DeepSeek function call。

### 6.1 `scan_team_warnings`

**Args:** （从 session 取 manager_id，无入参）

**Returns:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "company_name": "...",
      "owner": "王小明",
      "warnings": ["silent_deal", "no_champion_after_followups"],
      "meddicc_score": 45,
      "amount": 50000,
      "detail_url": "/leads/uuid"
    }
  ],
  "total_warnings": 12
}
```

### 6.2 `team_meddicc_summary`

**Args:** （从 session 取 manager_id）

**Returns:**
```json
{
  "team_avg_score": 65.3,
  "lit_density_per_dim": {"M": 0.8, "E": 0.3, "D1": 0.6, "D2": 0.4, "I": 0.7, "C1": 0.4, "C2": 0.5},
  "top_sales": [{"name": "王小明", "score": 72}],
  "bottom_sales": [{"name": "李思远", "score": 55}]
}
```

### 6.3 `top_attention_deals`

**Args:** `{ "limit": 5 }`（默认 5）

**Returns:**
```json
{
  "leads": [
    {
      "id": "uuid",
      "company_name": "...",
      "attention_score": 87.3,  // 内部加权（warnings 数 + score 反向 + amount 正向）
      "reasons": ["3 个 warning", "Score 仅 45", "金额高于团队中位数 2x"],
      "detail_url": "/leads/uuid"
    }
  ]
}
```

### 6.4 `forecast_category_distribution`

**Args:** （manager_id 从 session）

**Returns:**
```json
{
  "buckets": [
    {"category": "进行中", "count": 8, "total_amount": 400000, "warnings_count": 2},
    {"category": "必赢", "count": 3, "total_amount": 300000, "warnings_count": 1},
    {"category": "大概率", "count": 5, "total_amount": 250000, "warnings_count": 0}
  ]
}
```

注：返回值含 `total_amount`，但 **chat 答复 UI 默认不显示金额聚合**（仅显示条数 + warnings）——金额仅在用户 explicitly 问时返回。

---

## 7. Schema Validation 规约

- 所有新增 endpoint 用 Pydantic schema 严格校验入参
- forecast_category 枚举校验：6 选 1 中文值
- LLM 响应 JSON schema 校验 verdict ∈ {support, challenge, abstain}（其他值 fallback 到 abstain）
- 所有金额字段：REAL ≥ 0
- 所有日期：ISO 8601
