# API 接口契约

**项目**: SFA CRM | **日期**: 2026-03-31
**基础路径**: `/api/v1`
**认证**: JWT Bearer Token（除登录接口外，所有接口必须携带）

---

## 约定

- 所有请求/响应均为 JSON
- 时间字段统一使用 ISO 8601 格式：`2026-03-31T10:00:00Z`
- 分页参数：`?page=1&size=20`（默认 size=20，最大 100）
- 错误响应格式：
  ```json
  {
    "code": "LEAD_ALREADY_EXISTS",
    "message": "该企业已存在，当前归属：张三",
    "detail": {}
  }
  ```

---

## 认证

### POST /auth/login
登录，返回 JWT。

**请求**
```json
{ "login": "zhangsan", "password": "..." }
```

**响应 200**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": "uuid", "name": "张三", "roles": ["销售"] }
}
```

---

## 线索（Lead）

### GET /leads
查询线索列表（私有池 + 我的线索）。

**权限**: `lead.view`；数据范围由 `UserDataScope` 决定

**查询参数**
```
pool=private|public
stage=active|converted|lost
region=华北|...
search=公司名关键词
sort=created_at|last_followup_at（默认 last_followup_at desc）
page, size
```

**响应 200**
```json
{
  "total": 150,
  "items": [
    {
      "id": "uuid",
      "company_name": "华为技术有限公司",
      "unified_code": "91440300...",
      "region": "华南",
      "stage": "active",
      "pool": "private",
      "owner": { "id": "uuid", "name": "张三" },
      "source": "referral",
      "last_followup_at": "2026-03-28T10:00:00Z",
      "created_at": "2026-03-01T09:00:00Z"
    }
  ]
}
```

---

### POST /leads
录入新线索。触发唯一性检测。

**权限**: `lead.create`

**请求**
```json
{
  "company_name": "华为技术有限公司",
  "unified_code": "91440300...",
  "region": "华南",
  "source": "referral",
  "contacts": [
    {
      "name": "李四",
      "role": "CEO",
      "is_key_decision_maker": true,
      "phone": "13800138000"
    }
  ]
}
```

**响应 201**：返回创建的 Lead 对象

**响应 409 — 精确重复**
```json
{
  "code": "LEAD_DUPLICATE_EXACT",
  "message": "该企业已存在，当前归属：张三",
  "detail": { "existing_lead_id": "uuid", "owner_name": "张三" }
}
```

**响应 202 — 疑似重复（已创建，待主管确认）**
```json
{
  "code": "LEAD_DUPLICATE_WARNING",
  "message": "已录入，系统检测到疑似重复企业，已通知队长确认",
  "detail": { "lead_id": "uuid", "similar_leads": [...] }
}
```

---

### GET /leads/{id}
获取线索详情（含联系人、跟进记录、关键事件）。

**权限**: `lead.view` + DataScope 校验

---

### POST /leads/{id}/assign
分配线索给销售。

**权限**: `lead.assign`

**请求**
```json
{ "sales_id": "uuid" }
```

**响应 200**：返回更新后的 Lead 对象

**响应 400 — 私有池已满**
```json
{
  "code": "POOL_LIMIT_EXCEEDED",
  "message": "该销售私有池已满（当前 100 / 上限 100）"
}
```

---

### POST /leads/{id}/claim
从公共池抢占线索。

**权限**: `lead.claim`
**速率限制**: 每分钟 N 次（N 来自 `system_config.claim_rate_limit`）

**响应 200**：返回更新后的 Lead 对象

**响应 429 — 超出速率限制**
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "操作过于频繁，账号已锁定，请联系队长解锁"
}
```

**响应 409 — 已被抢占**
```json
{ "code": "LEAD_ALREADY_CLAIMED", "message": "该线索已被其他销售抢占" }
```

---

### POST /leads/{id}/release
释放线索回公共池（手动触发）。

**权限**: `lead.release`

---

### POST /leads/{id}/mark-lost
标记线索流失。

**权限**: `lead.mark_lost`

**请求**
```json
{ "reason": "明确拒绝，无意向" }
```

---

### POST /leads/{id}/convert
手动触发线索转化（兜底，通常由订单系统自动触发）。

**权限**: `lead.create`（销售对自己名下线索）或 `lead.assign`

---

## 客户（Customer）

### GET /customers
查询客户列表。

**权限**: `customer.view`；DataScope 决定数据范围

**查询参数**: `region`, `search`, `in_conversion_window=true`, `sort`, `page`, `size`

---

### GET /customers/{id}
获取客户详情（含联系人、跟进、关键事件、转化窗口状态）。

**响应额外字段**（派生，不存库）：
```json
{
  "conversion_window": {
    "in_window": true,
    "days_remaining": 7,
    "has_big_course": false
  }
}
```

---

### POST /customers/{id}/reassign
手工调配客户归属。

**权限**: `customer.reassign`

**请求**
```json
{ "new_owner_id": "uuid" }
```

---

## 跟进记录（FollowUp）

### POST /leads/{id}/followups
### POST /customers/{id}/followups
录入跟进记录。

**权限**: `followup.create`

**请求**
```json
{
  "type": "phone",
  "content": "与李总通话20分钟，对方表示有意向...",
  "followed_at": "2026-03-31T14:00:00Z",
  "contact_id": "uuid"
}
```

---

### GET /leads/{id}/followups
### GET /customers/{id}/followups
获取跟进记录列表。

---

## 关键事件（KeyEvent）

### POST /leads/{id}/key-events
### POST /customers/{id}/key-events
录入关键事件。

**权限**: `keyevent.create`

**请求（送书）**
```json
{
  "type": "book_sent",
  "occurred_at": "2026-03-31T10:00:00Z",
  "payload": { "sent_at": "2026-03-31T10:00:00Z" }
}
```

**请求（购买大课）**
```json
{
  "type": "purchased_big_course",
  "occurred_at": "2026-03-31T10:00:00Z",
  "payload": { "contract_amount": 200000, "purchase_date": "2026-03-31" }
}
```

### PATCH /key-events/{id}
更新关键事件字段（如更新送书的"是否已阅读"）。

---

## 日报（DailyReport）

### GET /reports/daily
获取我的日报列表。

### GET /reports/daily/today-draft
获取今日草稿（如已生成）。

### POST /reports/daily/{id}/submit
提交日报。

**权限**: `report.submit`

**请求**
```json
{
  "content": "今日跟进情况：...",
  "recipients": {
    "team_lead_id": "uuid",
    "region_head_id": "uuid"
  }
}
```

### GET /reports/team
查看团队日报（主管）。

**权限**: `report.view_team`

---

## AI Agent

### POST /agent/chat
发送消息，流式响应。

**请求**
```json
{
  "session_id": "uuid",
  "message": "帮我把华为这条线索分配给张三"
}
```

**响应**: Server-Sent Events（streaming）
```
data: {"type": "text", "content": "好的，我来帮你分配..."}
data: {"type": "tool_call", "tool": "assign_lead", "args": {"lead_id": "...", "sales_id": "..."}}
data: {"type": "tool_result", "success": true, "message": "线索已分配给张三"}
data: {"type": "text", "content": "已成功将华为线索分配给张三。"}
data: [DONE]
```

### GET /agent/skills
获取 Skill 列表（Agent 用于工具调用）。

### GET /agent/llm-config
获取当前激活的 LLM 配置（供 Next.js 侧动态初始化 Vercel AI SDK Provider）。

---

## 组织管理

### GET /org/nodes — 获取组织树
### POST /org/nodes — 新增节点
### PATCH /org/nodes/{id} — 更新节点
### DELETE /org/nodes/{id} — 停用节点（有活跃数据时阻断）

**权限**: `org.manage`

---

## 用户管理

### GET /users — 用户列表
### POST /users — 新增用户
### PATCH /users/{id} — 更新用户（含 org_node_id、DataScope）
### POST /users/{id}/deactivate — 停用用户
### POST /users/{id}/roles — 分配角色
### DELETE /users/{id}/roles/{role_id} — 移除角色

**权限**: `user.manage`

---

## 权限管理

### GET /roles — 角色列表
### POST /roles — 新增角色
### PATCH /roles/{id}/permissions — 更新角色权限点
### DELETE /roles/{id} — 删除角色（有用户持有时阻断）

**权限**: `user.manage`

---

## 系统配置

### GET /config — 获取所有配置项
### PATCH /config — 批量更新配置项（仅 Admin）

**权限**: `config.manage`

---

## Webhook（外部系统回调）

### POST /webhooks/order-payment
课时订单系统付款事件回调（触发线索转化）。

**请求**（由订单系统发起）
```json
{
  "event": "payment_confirmed",
  "order_type": "small_course",
  "company_name": "华为技术有限公司",
  "unified_code": "91440300...",
  "amount": 20000,
  "paid_at": "2026-03-31T10:00:00Z"
}
```

**处理逻辑**：
1. 按 `unified_code` 或 `company_name` 匹配线索
2. 找到唯一匹配：自动触发 `convert_lead`
3. 无匹配或多匹配：记录日志，通知 admin 手动处理

**认证**: 共享密钥（`X-Webhook-Secret` header），与普通 JWT 认证独立

---

## 错误码汇总

| 错误码 | 含义 |
|--------|------|
| `LEAD_DUPLICATE_EXACT` | 精确重复，阻断录入 |
| `LEAD_DUPLICATE_WARNING` | 疑似重复，已录入待确认 |
| `LEAD_ALREADY_CLAIMED` | 线索已被抢占 |
| `POOL_LIMIT_EXCEEDED` | 私有池已满 |
| `RATE_LIMIT_EXCEEDED` | 抢占频率超限 |
| `PERMISSION_DENIED` | 无功能权限 |
| `DATA_SCOPE_DENIED` | 无数据可见权限 |
| `LEAD_NOT_ACTIVE` | 线索状态不允许该操作 |
| `DUPLICATE_CONVERSION` | 线索已转化，不可重复 |
| `USER_HAS_ACTIVE_DATA` | 用户名下有活跃数据，无法停用 |
