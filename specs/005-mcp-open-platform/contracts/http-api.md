# Contract: 新增 HTTP 端点

**Feature**: 005-mcp-open-platform
**Base**: `/api/v1`（沿用既有前缀，复用现有 nginx 反代块）

> 演示区代理端点（原 §5）已于 2026-08-16 随首页演示区一并移除，见 spec.md §8。

---

## 1. `POST /api/v1/mcp` — MCP 协议端点

**用途：** 承载 MCP 协议消息（连接握手 / 工具列举 / 工具调用）。协议帧格式由 MCP 规范与所选 SDK 决定，本文不复述，只约定**本系统附加的行为**。

| 项 | 约定 |
|---|---|
| 鉴权 | `Authorization: Bearer <token>` **必填** |
| 会话 | 无状态。每请求独立鉴权，服务端不维护会话 |
| 限流 | 每密钥 `mcp_rate_per_minute` / `mcp_rate_per_day` |
| 流式 | 支持流式响应；**nginx 该 location 必须 `proxy_buffering off`** |
| 工具范围 | 仅 `mode == "read"` 的 9 个工具 |
| 数据范围 | 由密钥映射的账号经既有 DataScope 计算 |

### 错误响应（均须人类可读，会被 AI 助手转述给用户）

| 情形 | 状态 | 文案要点 |
|---|---|---|
| 缺少 / 格式错误的凭证 | 401 | 说明需要在配置中提供密钥，并给出 `/open` 领取地址 |
| 凭证无效（查无此摘要） | 401 | 凭证无效，前往 `/open` 领取 |
| 凭证已过期 | 401 | **明确说"已过期"**，并给出 `/open` 重新领取地址（FR-028） |
| 凭证已吊销 | 401 | 已吊销，前往 `/open` 领取新的 |
| 超出调用额度 | 429 | 说明额度与恢复时间 |
| 请求的工具不在暴露范围 | 协议层工具未找到错误 | 不泄露该工具存在，与"工具不存在"同一响应 |

---

## 2. `POST /api/v1/mcp/tokens` — 领取密钥

**鉴权：** 无（公开端点）
**限流：** 每来源 IP `mcp_issue_per_ip_per_day`（默认 30；取值须顾及共用出口 IP —— 办公室/会场常共用一个 IP，且每位访客通常领两把）

**Request**

```json
{ "persona": "sales" }
```

| 字段 | 类型 | 必填 | 取值 |
|---|---|---|---|
| `persona` | string | 是 | `sales` \| `manager`（**不接受 `admin`**） |

**Response 200**

```json
{
  "token": "sfa_ro_a3f9…",
  "token_prefix": "sfa_ro_a3f9",
  "persona": "manager",
  "persona_label": "主管 · 陈队长",
  "scope": "read",
  "expires_at": "2026-08-20T10:22:31Z",
  "endpoint": "https://crm.pmyangkun.com/api/v1/mcp"
}
```

- `token` **仅此一次返回**，此后不可再获取
- `endpoint` 由服务端返回，避免前端硬编码地址

**错误**

| 情形 | 状态 | 说明 |
|---|---|---|
| `persona` 非法 | 400 | 含 `admin` 在内的任何非法值 |
| 映射账号不存在于种子数据 | 500 | 明确报错，不静默降级到其他账号 |
| 超出发放频率 | 429 | 提示次日再试 |

---

## 3. `GET /api/v1/mcp/tokens/me` — 查询自身密钥状态

**鉴权：** `Authorization: Bearer <token>`
**限流：** 60/分

**Response 200**

```json
{
  "token_prefix": "sfa_ro_a3f9",
  "persona": "manager",
  "persona_label": "主管 · 陈队长",
  "scope": "read",
  "expires_at": "2026-08-20T10:22:31Z",
  "days_remaining": 6,
  "call_count": 37,
  "last_used_at": "2026-08-14T02:10:05Z"
}
```

**MUST NOT** 返回密钥明文或其完整摘要（FR-029）。

---

## 4. `GET /api/v1/mcp/tools` — 公开工具目录

**鉴权：** 无（公开端点，供 `/open` 站点与 `llms.txt` 取数）
**用途：** 支撑 Decision 6——站点展示的工具清单必须与实际暴露范围同源，杜绝文档漂移

**Response 200**

```json
{
  "tools": [
    {
      "name": "scan_team_warnings",
      "summary": "扫描数据范围内触发 warning 的线索",
      "parameters": { "type": "object", "properties": {} },
      "example_question": "我团队哪几单有风险？"
    }
  ],
  "count": 9
}
```

- 内容由 `TOOL_DEFINITIONS` 中 `mode == "read"` 的条目派生，**不得手工维护**
- `example_question` 为站点展示用的补充元数据，与工具定义分离维护

---

## 5. `GET /open/llms.txt` — 纯文本接入说明

**位置：** 前端 Route Handler（非后端端点）
**Content-Type:** `text/plain; charset=utf-8`

内容须包含：接入地址、凭证获取方式与放置位置、两个身份的差异、9 个工具清单与用途、限流与数据性质声明。目标是**一个 AI 助手读完即可自行生成配置**（FR-019）。

工具清单部分由 `GET /api/v1/mcp/tools` 取数生成，与站点其余部分同源。
