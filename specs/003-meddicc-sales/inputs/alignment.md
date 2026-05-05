# Spec 003 — MEDDICC 销售视角 + 对话录入 + AI 抽证据：业务对齐文档

**日期**：2026-05-05
**Brainstorm 产出**：通过 `superpowers:brainstorming` skill 与 stakeholder 完整对话产出
**预期归档位置**：`specs/003-meddicc-sales/inputs/alignment.md`（spec-kit 创建分支后移动）
**状态**：待 stakeholder 审阅

---

## 一、背景与目标

### 1.1 项目语境

SFA CRM 项目刚完成 spec 002（公网部署安全/治理硬化），即将上线公开 demo 站。下一阶段进入"持续运营期"——按 `project_main.md` 既定的内容策略，从主题攻势候选池中选取「**对话式 CRM（借鉴 Gong 哲学，Mobile + 大客户打分 + Next Best Action）**」作为第一波主题攻势的核心功能落地。

### 1.2 灵感来源

Gong Pipeline 视图（含 MEDDICC 列、Score、Warnings、Activity Timeline）+ MEDDICC.com 官方方法论（含 NAMIE 概念、Winni AI 抽证据机制）。但本项目不照搬 Gong——而是借其哲学，结合 SFA CRM 的「**对话式 + 行为驱动 + Spec 工程化**」定位做差异化设计。

### 1.3 顶层目标

通过 spec 003 让演示用户（公开访客）在 5 分钟内体验"**AI 自动从对话记录中抽取 MEDDICC 7 维度证据并打分**"的魔法时刻，公开传递两个心智：

- **路径 1（CRM 业务形态）**："为什么 MEDDICC 不该当表单字段——它应该是 AI 从对话中自动浮现的仪表盘"
- **路径 2（ToB × AI 架构）**："AI 在低数据燃料环境下也能跑出实用的 MEDDICC 抽取能力"

### 1.4 演示场景画像

公网 demo 站访客（5 分钟体验）：
1. 登录任意演示账号（默认 sales01）
2. 进入"线索"页面，点开任一种子 demo 线索
3. 切换到"对话记录"或"MEDDICC 仪表盘"tab
4. 直接看到亮灯的仪表盘 + Score + Next Best Action（**轨道一**：开箱即用）
5. **或**点击页面上的"演示场景卡片"一键注入新对话 + AI 自动分析 + 仪表盘动画亮灯（**轨道二**：自己玩）
6. 切换到 Chat："给我看一下 XX 这条线索现在啥情况" → 渲染 MEDDICC 报告卡片（**轨道三**：对话式入口）

### 1.5 范围与拆分

本 spec 是「对话式 CRM 主题攻势」的第一发，专注**销售视角**。配套的**经理视角**（Pipeline 全表 + Forecast Categories + 团队 rollup + 趋势图 + Warnings 规则引擎）独立为 **spec 004**，本文档不涉及。

---

## 二、7 个锁定决策（brainstorming 产出）

| # | 议题 | 决策 |
|---|---|---|
| 1 | 用户视角 | **销售自检 + 经理 review 双视角**（spec 003 做销售，spec 004 做经理） |
| 2 | 演示范围 | **完整 Gong-like**（全套 MEDDICC + Score + 经理 Pipeline + 团队聚合），但拆为 spec 003 + 004 |
| 3 | 数据燃料 | **新增 Conversation 实体**——文本录入 + 5-7 张场景卡 + 5-10 条种子模拟对话；不做文件上传 / 音频转写 |
| 4 | HITL 边界 | **去掉 HITL 确认环节**（公网访客不会逐条点采纳）。AI 自动抽 + 自动写库 + 仪表盘自动亮灯。用户可重新分析 / 删除单条证据 / 删除对话 |
| 5 | MEDDICC 字母 | **标准 7 字母**（M/E/D/D/I/C/C），不加 P（Paper Process） |
| 6 | 评估对象 | **挂在 Lead 上**（评估 stage=active 的 Lead 转化为 Customer 的可能性） |
| 7 | 数据存储 | **Rich Evidence 表**（每条证据 first-class 行；Lead 表加 score / completion / last_analyzed_at 三个衍生字段缓存） |

---

## 三、MEDDICC 7 字段培训行业本地化定义

| 字母 | 维度 | 培训销售含义 | AI 抽信号示例 |
|---|---|---|---|
| **M** | Metrics | 客户希望培训改变的量化数字：业绩 / 团队留存 / 老板时间 / 人效 | "现在每月业绩 200 万，希望提到 300 万" / "团队流失率 30%" |
| **E** | Economic Buyer | 拍板付钱的人——绝大多数是老板（创始人/CEO），少数 VP/HR 总监 | "这事我自己定" / KP 联系人 = 创始人 / "我跟我合伙人商量了" |
| **D** | Decision Criteria | 客户怎么选培训公司：讲师品牌 / 朋友推荐 / 试听效果 / 同行案例 / 价格 / 课程体系 | "我看了 XX 老师视频" / "老李推荐你们" / "试听课不错" |
| **D** | Decision Process | 客户内部决策流程：老板独决 / 老板+配偶 / 老板+合伙人 | "这事我跟我老婆商量一下" / "我合伙人也得参与" / "我自己定就行" |
| **I** | Implicate the Pain | 客户真实在痛的事：业绩下滑 / 团队留不住 / 自己累 / 转型焦虑 / 卡瓶颈 | "现在累得不行" / "业绩从 X 跌到 Y" / "团队带不动" |
| **C** | Champion | 内部支持者——培训行业很特殊：常是配偶 / 合伙人 / HR；KP 不是 EB 时 KP 通常是 Champion | "我老婆觉得这课程有用" / "我们 HR 力荐" / 某 Contact 多次主动联系销售 |
| **C** | Competition | 在跟谁竞争：其他培训公司（樊登 / 行动派 / 同行）+ 自己摸索 + "暂时不上" | "我也在看 XX 课程" / "先自己想办法" / "今年再看看" |

**关键差异化**（影响 AI 抽取 prompt）：
- D-Process 简化为 3 种（独决 / 配偶 / 合伙人），不像 B2B SaaS 复杂的"采购委员会"
- Champion 强调"配偶可以是 Champion"，跟典型 B2B 不同
- Competition 列了"自己摸索"和"今年再看看"两类隐性竞争

---

## 四、整体架构

### 4.1 系统层面新增 / 扩展

```
┌── 新增数据实体 ────────────────────────────────────────┐
│ conversation 表           对话原文 + 来源              │
│ lead_meddicc_evidence 表  每条证据一行（无 status）     │
└────────────────────────────────────────────────────────┘

┌── 新增 AI 工具 ────────────────────────────────────────┐
│ analyze_meddicc_evidence(lead_id)                      │
│   读 lead 全部 conversation + followup + key_event     │
│   → 调 LLM 抽 7 维度证据                               │
│   → 写 lead_meddicc_evidence 表（Replace 策略）        │
│   → 重算 Lead.meddicc_score / completion               │
└────────────────────────────────────────────────────────┘

┌── 现有实体扩展 ────────────────────────────────────────┐
│ Lead 表 +3 字段：                                       │
│   meddicc_score (Float, 0-100)                         │
│   meddicc_completion (Int, 0-7)                        │
│   meddicc_last_analyzed_at (str, ISO)                  │
└────────────────────────────────────────────────────────┘

┌── 现有 UI 扩展 ────────────────────────────────────────┐
│ Lead 详情页 +2 tab：                                    │
│   ├ 对话记录（场景卡片网格 + 已有对话列表 + 新增）       │
│   └ MEDDICC 仪表盘（7 维度 + Score + NBA + 重新分析）   │
│ Chat（PC sidebar + Mobile fullscreen）：                │
│   ├ 自然语言识别"分析 XX 这条线索" → 调 analyze 工具    │
│   └ 渲染 ChatMeddiccReportCard（Score + 7 圆点 + NBA）  │
│ Mobile：                                                │
│   └ /m/leads/[id] 加 MEDDICC 折叠面板（无场景卡）        │
└────────────────────────────────────────────────────────┘
```

### 4.2 演示用户路径（最终单轨简化版）

```
进入任意 demo lead 详情页
  ↓
看到种子已有对话 + 仪表盘已亮灯 + Score 已计算
  ↓
[用户操作 A] 点"演示场景卡片"
  → 后台批量插对话 + 同步触发 analyze（2-4s）
  → 仪表盘动画刷新（圆点逐个亮起 + Score 跳数）
  ↓
[用户操作 B] 手动新增对话（粘贴文本）
  → 保存后同步触发 analyze
  → 仪表盘刷新
  ↓
[用户操作 C] 切到 Chat："分析 XX 这条线索"
  → AI 调 analyze_meddicc 工具
  → 渲染 ChatMeddiccReportCard（含跳转仪表盘按钮）
```

---

## 五、数据模型

### 5.1 `conversation` 表（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid (pk) | |
| lead_id | str (fk lead.id) | |
| recorded_at | str (ISO) | 对话发生时间（演示用户填，或场景卡按今日往前推算） |
| content | text | 对话内容（自由文本，建议 `销售：xxx\n客户：yyy` 多轮 + 摘要） |
| source | str | `manual` / `scenario_card` / `mock_seed` |
| scenario_card_id | str (nullable) | 来自哪张场景卡（用于 unapply / 追溯） |
| created_by | str (fk user.id) | |
| created_at | str (ISO) | |

### 5.2 `lead_meddicc_evidence` 表（新建）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid (pk) | |
| lead_id | str (fk lead.id) | |
| dimension | str | `metrics` / `economic_buyer` / `decision_criteria` / `decision_process` / `pain` / `champion` / `competition` |
| source_type | str | `conversation` / `followup` / `key_event` |
| source_id | str | 指向源记录 id |
| evidence_text | text (≤200 字) | AI 抽出的原文片段或摘要 |
| confidence | float | 0-1，AI 给的置信度 |
| created_at | str (ISO) | |

> 不加 status 字段（无 HITL 状态机）；用户要剔除直接 DELETE row。

### 5.3 `lead` 表扩展（+3 字段）

| 字段 | 类型 | 说明 |
|---|---|---|
| meddicc_score | float (default null) | 0-100，每次 evidence 变更后重算 |
| meddicc_completion | int (default 0) | 0-7，已亮维度数 |
| meddicc_last_analyzed_at | str (ISO, nullable) | 上次成功 analyze 时间 |

### 5.4 数据重置（spec 002 集成）

`reset_business_data()` 的清空表列表追加：
- `conversation`
- `lead_meddicc_evidence`

且在 init_db 的 `seed_demo_business_data()` 中：
- 插入 5-10 条种子对话到 2-3 个 demo lead（详见 §9.1）
- **针对每个 demo lead 调用一次 `analyze_meddicc_evidence(lead_id)`**——写入种子 evidence + 更新 Lead.meddicc_score / completion / last_analyzed_at
- 半小时重置后再次跑 init_db 时同步重跑（保证下次访客进来仍看到亮灯）

> 半小时重置后状态归零，下次访客进来仍看到亮灯（因 init_db 已跑过 analyze）。

---

## 六、API 端点（8 个）

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/v1/leads/{id}/conversations` | GET | 列出对话 |
| `/api/v1/leads/{id}/conversations` | POST | 新增对话 → **同步触发 analyze** → 返回新仪表盘 |
| `/api/v1/conversations/{id}` | DELETE | 删除单条对话 → **同步触发 analyze** → 返回新仪表盘 |
| `/api/v1/leads/{id}/meddicc` | GET | 返回仪表盘数据（按维度聚合 + score + completion + last_analyzed_at） |
| `/api/v1/leads/{id}/meddicc/analyze` | POST | 触发 AI 分析（同步，1-3s 返回） |
| `/api/v1/meddicc-evidence/{id}` | DELETE | 删单条证据 → **同步触发 analyze** → 返回新仪表盘 |
| `/api/v1/leads/{id}/scenario-cards` | GET | 列出该 lead 适用的场景卡 |
| `/api/v1/leads/{id}/scenario-cards/{card_id}/apply` | POST | 一键应用：批量插对话 + 同步触发 analyze + 返回更新后 dashboard |

### 6.1 数据权限

所有端点遵循现有 DataScope 规则（参考 `permission_service.get_visible_user_ids`）：
- sales 只能操作自己拥有的 lead
- manager 可看团队的（但本 spec 不做经理视角 UI，权限只是底层兜底）

### 6.2 限流

`/meddicc/analyze` 与 `/scenario-cards/{id}/apply` 视作 LLM 调用，纳入 spec 002 的：
- 用户视角：10/分 + 100/天
- 全站熔断：200/小时

---

## 七、AI 抽证据工作流

### 7.1 完整流程

```
1. 读 lead 全量上下文：
   - conversations（按 recorded_at 降序）
   - followups（按 followed_at 降序）
   - key_events（按 occurred_at 降序）
   - lead 基本信息（公司 / 大区 / 来源 / 联系人）

2. 构造 LLM prompt：
   - System：MEDDICC 分析助手 + 7 字段培训行业定义 + JSON schema 约束 + few-shot
   - User：序列化的 lead 上下文（每条记录带 source_type + source_id）

3. 调 LLM（默认 deepseek-chat，沿用 spec 002 LLM 配置）

4. 解析 JSON 输出 + 验证：
   - dimension 在 7 个枚举内
   - source_id 在 DB 中真实存在（防 LLM 幻觉 FK）
   - evidence_text ≤ 200 字
   - confidence ∈ [0, 1]
   - 验证失败的条目跳过，记日志

5. 写库（Replace 策略）：
   DELETE FROM lead_meddicc_evidence WHERE lead_id = X
   INSERT 新 evidence 行

6. 重算 Lead 表：
   meddicc_score / meddicc_completion / meddicc_last_analyzed_at

7. 返回结构化结果给调用方
```

### 7.2 LLM 输出 JSON 格式

```json
{
  "evidences": [
    {
      "dimension": "metrics" | "economic_buyer" | "decision_criteria" | "decision_process" | "pain" | "champion" | "competition",
      "source_type": "conversation" | "followup" | "key_event",
      "source_id": "<上下文里给的真实 id>",
      "evidence_text": "原文片段或一句话摘要，≤200 字",
      "confidence": 0.0-1.0
    }
  ]
}
```

### 7.3 错误处理

| 场景 | 处理 |
|---|---|
| LLM 不返回有效 JSON | retry 1 次 → 仍失败 → HTTP 503 + 前端"AI 分析失败，请稍后重试" |
| LLM 返回的 source_id 在 DB 找不到 | 该条 evidence 跳过（沿用 spec 002 防 FK 幻觉哲学） |
| LLM 返回未知 dimension | 跳过 |
| LLM 调用超时 (>15s) | 503 |
| 上下文为空（lead 无 conversation/followup/key_event） | 不调 LLM，直接返回空 evidence + score=0 + 提示"请先录入对话或跟进记录" |

### 7.4 Score 算法

```
完整度分 = (有证据的维度数 / 7) × 60          # 0-60
深度分   = min(总证据条数, 14) / 14 × 25       # 0-25，14 条封顶
活跃度分 = 15 if 7 天内有新对话或新分析
         = 8  if 30 天内
         = 0  otherwise                        # 0-15

meddicc_score = round(完整度分 + 深度分 + 活跃度分)  # 0-100
```

> spec 004 经理视角时可重调权重；spec 003 这套足够直观。

### 7.5 Replace 策略 vs 历史趋势

每次 analyze 用 Replace（DELETE 旧 + INSERT 新）。代价是 evidence.created_at 时间序列丢失。

**spec 004 启动时**：引入 `lead_meddicc_history` 表（每次 analyze 写一行 snapshot）做趋势图，不影响 spec 003。

### 7.6 重新分析触发场景

**统一为同步触发**（避免 fire-and-forget + 轮询的复杂性，所有用户操作都 await 1-3s 拿最新仪表盘）：

| 场景 | 方式 |
|---|---|
| 新增 conversation（POST） | 同步触发，返回新仪表盘 |
| 应用 scenario card | 同步触发，返回新仪表盘 |
| 删除 conversation / 删除 evidence | 同步触发，返回新仪表盘 |
| MEDDICC tab "重新分析"按钮 | 手动同步 |
| Chat "重新分析 XX 线索" | LLM 调 analyze_meddicc 工具 |

---

## 八、前端 UX

### 8.1 PC：Lead 详情页加 2 tab

#### Tab A — 对话记录

```
[ 演示场景卡片网格（横向 3-5 张）]
  ├ 卡 1：拜访赵总（演示 EB / Pain / D-Process 抽取）
  ├ 卡 2：Champion 涌现（演示 D-Process / Champion）
  ├ 卡 3：竞品被揭（演示 Competition / Metrics）
  └ ...
  每张卡：title + description + [应用 →] / [已应用 ✓]

  注：「已应用 ✓」状态由后端 GET /scenario-cards 返回时附带计算
       （当 conversation 表中存在 scenario_card_id = 该卡 id 的行时为已应用）

[ 已有对话列表 ]
  + 新增对话（按钮，弹窗：textarea + 时间）
  对话条目：时间 + 来源标签（手动/场景卡/种子）+ 内容预览 + [展开] + [删除]
```

#### Tab B — MEDDICC 仪表盘

```
[ 顶部条 ]
  Score 78/100   完成度 6/7   上次分析 3 分钟前   [重新分析]

[ 7 维度卡片网格（2 行 × 4/3 列）]
  每张卡：维度名 + 圆点（亮/灰）+ 证据条数 + 第一条 evidence 预览
  点开 expand：evidence 列表 + 每条 confidence 条 + 来源跳转 + [删除]

[ Next Best Action ]
  ⚠ Decision Process 维度还没亮，建议下次拜访问 "您内部一般这种采购走什么流程？"
```

> NBA 用前端常量字典生成（按最弱维度查表），不调额外 LLM。

### 8.2 Mobile：`/m/leads/[id]` 简版

```
[折叠卡 1] 对话记录 (5 条)
[折叠卡 2] MEDDICC 仪表盘（默认展开）
  Score 78  完成度 6/7
  ━━━━━━━━━━━━━━━━━━━━ 78%
  ● M  Metrics      3 条
  ● E  EB           1 条
  ● D  Criteria     2 条
  ○ D  Process      0 条 ⚠
  ● I  Pain         4 条
  ● C  Champion     1 条
  ● C  Competition  1 条
  [重新分析]
```

> 移动端不显示场景卡片网格（移动端经理消费 chat 报告 + 一线销售看仪表盘）。

### 8.3 Chat 集成

#### 自然语言触发

- "分析 [公司名] 这条线索" → LLM 调 `analyze_meddicc(lead_id)`
- "看一下 [公司名] 状态" → LLM 调 `get_lead_detail(lead_id)`，返回值含 `meddicc_summary`
- "重新分析 [公司名]" → 同上 analyze_meddicc

#### 新增组件 `ChatMeddiccReportCard`

```
🎯 [公司名]   Score 78/100
━━━━━━━━━━━━━━━━━━━━━━━━ 6/7

● M Metrics      ● D Criteria
● E EB           ○ D Process ⚠
● I Pain         ● C Champion
                 ● C Competition

⚠ NBA: Decision Process 维度还没亮...

[去仪表盘 →]   [重新分析]
```

> 视觉沿用现有 `ChatFormCard`（PC 用按钮 / Mobile 用卡片）模式，保持 chat 内嵌组件视觉一致。

### 8.4 应用场景卡的 UX 流（关键演示亮点）

```
用户点 [应用 →]
  ↓
toast: "正在注入对话并分析中..."
  ↓ POST /scenario-cards/{id}/apply（同步等结果，2-4s）
  ↓
toast: "✓ 完成"
  ↓
仪表盘整体动画刷新（圆点逐个亮起 + Score 跳数 + 数字补间）
```

> "圆点逐个亮起 + Score 跳数"是纯前端动画，演示效果的灵魂。

### 8.5 新增前端组件清单

| 组件 | 用途 |
|---|---|
| `ConversationTab.tsx` | PC 对话记录 tab |
| `MeddiccDashboardTab.tsx` | PC 仪表盘 tab |
| `ScenarioCardGrid.tsx` | 场景卡片网格 |
| `MeddiccDimensionCard.tsx` | 单维度卡片（含展开） |
| `EvidenceListItem.tsx` | 单条证据 row（含删除） |
| `ChatMeddiccReportCard.tsx` | chat 内嵌报告卡片 |
| `MobileMeddiccPanel.tsx` | 移动端 MEDDICC 面板（折叠卡） |

---

## 九、种子数据策略

### 9.1 Demo Lead 选择

基于现有 init_db 的 lead，选 2-3 条作为"丰富展示"对象：

| Demo Lead | 拥有者 | 预置内容 |
|---|---|---|
| 深圳前海微链 | sales01 | 5 段种子对话 + 已有跟进/事件 + init_db 末跑一次 analyze |
| 北京数字颗粒科技 | sales01 | 3 段种子对话 + 跟进/事件 |
| 天津智联云 | sales02 | 4 段对话 + 跟进/事件（不同销售，演示数据权限边界） |
| 其他 lead | 任 | MEDDICC 空白（演示用户能在这些 lead 上玩） |

### 9.2 场景卡数量与分布

- **5-7 张**场景卡（不要太多，免演示用户选择困难）
- 主要绑定到 1-2 条 demo lead（深圳前海微链 + 北京数字颗粒）
- 每张卡覆盖 2-3 个 MEDDICC 维度，5-7 张合起来覆盖全部 7 维度

### 9.3 场景卡剧本写作准则

- 每段对话 500-1000 字
- 风格：`销售：xxx\n客户：yyy` 多轮
- 培训公司真实语境：业绩压力 / 团队问题 / 老板焦虑 / 配偶讨论 / 同行推荐
- 避免塑料感（不要"这个产品太棒了"假对话）
- 自然嵌入 MEDDICC 信号（让 AI 真能抽到东西）

### 9.4 写作分工

实施阶段由 Claude 写草稿，stakeholder 审一遍改话术。预计 3 天。

### 9.5 场景卡数据存储

不建表，前端常量 + 后端字典：

```python
# backend: app/services/scenario_cards.py
SCENARIO_CARDS = {
  "scenario_001_kp_visit": {
    "title": "拜访赵总（首次深聊）",
    "description": "演示 EB / Pain / Decision Process 三个维度的证据抽取",
    "applies_to_lead_company": "深圳前海微链",
    "conversations": [
      {
        "recorded_at_offset_days": -3,
        "content": "..."
      }
    ]
  },
  ...
}
```

---

## 十、工期估算

| 模块 | 工期 |
|---|---|
| **后端**：DB schema + migrations + 8 API + analyze service + LLM prompt + score 算法 + chat tool + 单测/集测 | 5.5 天 |
| **前端**：PC 2 tab + 7 维度卡 + 场景卡网格 + 仪表盘动画 + Mobile 简版 + ChatMeddiccReportCard + Playwright | 7 天 |
| **内容**：5-7 张场景卡剧本 + 种子数据 + init_db 集成 + system prompt 调优 + few-shot | 3 天 |
| **文档 + spec-kit 流程 + 修 bug + 演示脚本** | 1.5 天 |
| **合计** | **17 天 ≈ 2.5 周** |

---

## 十一、风险与权衡

| 风险 | 缓解 |
|---|---|
| LLM 抽 MEDDICC 不稳定（错抽 / 漏抽 / JSON 格式坏） | few-shot examples + JSON validate + retry 1 次 + 失败显式 503 + 用户可点单条删除 |
| DeepSeek 限流 / 公网账单爆 | spec 002 的 200 次/小时熔断 + 用户视角限流（10/min, 100/day）已在线 |
| 场景卡剧本"塑料感" | stakeholder 审 + 改话术；上线前内部演示一遍 |
| Score 算法主观 | 演示用够；spec 004 经理视角时可重调 |
| Mobile 体验降级 | 接受，移动端经理不是主战场 |
| 仪表盘动画演示效果不达预期 | 做完先内部 demo，不行就调 |

---

## 十二、明示不在 spec 003 范围（防 scope creep）

- ❌ 经理 Pipeline 全表视图（spec 004）
- ❌ Forecast Categories（Open / Commit / Most Likely / Best Case / Closed Won / Closed Lost）
- ❌ 团队 rollup 视图 / 趋势图（spec 004）
- ❌ Warnings 规则引擎（spec 004）
- ❌ 历史 snapshot 表（spec 004 引入）
- ❌ 音频上传 + 转写
- ❌ 文件上传（.txt/.md/.docx）
- ❌ MEDDICC 编辑/审计 UI（演示用户不需要，已可单条删除）
- ❌ HITL 采纳/拒绝工作流（已在 brainstorming 阶段去除）

---

## 十三、后续衔接

### 13.1 spec 004 预告

经理视角 + 团队管理：
- 团队 Pipeline 列表（所有 lead + MEDDICC 完整度条 + Score 排序）
- Forecast Categories（Open / Commit / Most Likely / Best Case / Closed Won / Closed Lost）
- 团队 rollup（按销售员聚合）
- Warnings 规则引擎（5-7 种主动报警）
- 趋势图（基于新增的 `lead_meddicc_history` 表）
- 经理版 Chat 提问（"团队哪几单存在风险"）

预计 2 周。

### 13.2 内容产出（4 轨道）

| 轨道 | 产出 |
|---|---|
| A 杨老师硬观点 | 1 篇："培训销售的 MEDDICC 跟 ToB SaaS 的 MEDDICC 哪里不一样" |
| B 功能扩展 | spec 003 本身落地 |
| C AI 玩法实验 | 文章："analyze_meddicc 是个完整的 multi-step Tool Use 案例" |
| D 克劳蛋系列 | 2-3 篇："这次 AI 学会了 MEDDICC" / "场景卡片：一键演示的力量" / "为什么我去掉了 HITL" |

---

## 十四、spec-kit 落地步骤

```
1. stakeholder 审本设计稿 → commit 到 docs/brainstorm/

2. 跑 spec-kit 创建 feature 分支
   .specify/scripts/powershell/create-new-feature.ps1 -ShortName "meddicc-sales" `
     "MEDDICC 销售视角：对话录入 + AI 抽 7 维度证据 + 仪表盘 + Score + Chat 集成"
   → 自动创建 specs/003-meddicc-sales/ + 切到分支 003-meddicc-sales

3. 归档对齐文档
   → 复制本文档到 specs/003-meddicc-sales/inputs/alignment.md

4. 跑 spec-kit 流水线
   /speckit.specify  → spec.md（功能需求 + 用户故事）
   /speckit.plan     → plan.md + data-model.md + contracts/ + research.md
   /speckit.tasks    → tasks.md（拆 30-50 个 task）

5. 实施
   推荐 superpowers:subagent-driven-development（沿用 spec 002 节奏）

6. PR + merge commit 收口（沿用 spec 001/002 模式，不 squash）
   gh pr create / gh pr merge --merge
```

---

## 附录 A：brainstorming 决策时间线

| 轮次 | 议题 | 决策 |
|---|---|---|
| Q1 | 用户视角 | 销售 + 经理双视角 |
| Q2 | 演示范围 | C → 拆为 spec 003 + 004，本 spec 聚焦 003 |
| Q3 | spec 拆分 | A 拆分（spec 003 销售 + spec 004 经理） |
| Q4 | 对话录入实现 | A 文本录入 + 种子 mock |
| Q5 | HITL 边界 | B 提案确认 → 后改为去掉 HITL（stakeholder 中途改主意） |
| Q6 | MEDDICC 字段本地化 | A 接受草稿（stakeholder："你定就好了，演示不重要"） |
| Q7 | 数据存储 | 2 Rich Evidence 表 |

设计稿确认（5 段全 OK）：Section 1 / 2 / 3 / 4 / 5 全部通过 stakeholder 简短"ok"确认。

---

**文档结束。请 stakeholder 审阅后回复"通过"或指出修改点。**
