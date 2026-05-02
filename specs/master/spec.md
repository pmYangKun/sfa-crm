# SFA CRM — 功能规格

**分支**: `master` | **来源**: `docs/early-design/ontology.md` + `docs/early-design/specifications.md` + `docs/early-design/business-context.md`

---

## 项目概述

为企业家培训公司构建的 SFA CRM 系统。核心产品：
- **小课**：3天2夜线下课，2万元，线索转化的主要漏斗
- **大课**：半年制企业家MBA课程，20万元，核心收入来源

销售团队200人，覆盖全国。核心目标：客户资源的准确管理与智能分配——把好线索分给好销售，最大化整体转化率。

**技术栈**（已确定）：
- 前端：Next.js
- 后端：FastAPI（Python）
- 数据库：SQLite（演示/教学项目）
- 部署：Docker Compose + 腾讯云轻量服务器
- AI Agent：Vercel AI SDK（多 LLM，Admin 可切换）
- LLM：默认 Claude，可配置为 GPT/DeepSeek 等

---

## Ontology：核心对象

### 线索（Lead）
尚未转化（未购买小课）的目标企业。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| company_name | String | 企业名称，必填 |
| unified_code | String? | 组织机构代码（强推荐，非强制） |
| region | Enum | 所属大区 |
| stage | Enum | `active` / `converted` / `lost` |
| owner_id | FK → User? | 当前负责销售，公共池时为 null |
| pool | Enum | `private` / `public` |
| source | Enum | `referral` / `organic` / `koc_sem` / `outbound` |
| created_at | DateTime | |
| last_followup_at | DateTime? | 每次跟进后更新 |
| converted_at | DateTime? | 转化时填入 |
| lost_at | DateTime? | 标记流失时填入 |

**唯一性**：有组织机构代码时精确匹配；无时按公司名模糊匹配 + 联系人微信/手机预警，推主管确认。

**私有池上限**：可配置（默认100），只统计 `stage = active` 的线索。

**自动释放条件**（满足任一即释放回公共池）：
- 10天未跟进
- 30天未成单

---

### 客户（Customer）
线索购买小课后创建的记录。**无状态字段**——购买情况从课时订单系统实时推导。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| lead_id | FK → Lead | 来源线索（已归档） |
| company_name | String | 从线索继承 |
| unified_code | String? | 从线索继承 |
| region | Enum | 从线索继承 |
| owner_id | FK → User | 从线索继承，可手工调配 |
| source | Enum | 从线索继承 |
| created_at | DateTime | 转化时间 = 窗口起点 |

**派生逻辑**（不存库）：
- 是否购买大课 → 查课时订单系统
- 是否在14天转化窗口内 → `now - customer.created_at < 14天 AND 无大课订单`

---

### 联系人（Contact）
挂在线索或客户下的自然人，可多个。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| lead_id | FK → Lead? | 二选一 |
| customer_id | FK → Customer? | 二选一 |
| name | String | |
| role | String? | 职位 |
| is_key_decision_maker | Boolean | 是否关键决策人 |
| wechat_id | String? | |
| phone | String? | |
| created_at | DateTime | |

线索转化时联系人随之迁移到客户下。微信号/手机号重复时自动创建联系人关系并通知主管。

---

### 联系人关系（ContactRelation）
跨企业人脉网络记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| contact_a_id | FK → Contact | |
| contact_b_id | FK → Contact | |
| relation_type | Enum | spouse / relative / partner / friend |
| note | String? | |
| created_by | FK → User | |

---

### 跟进记录（FollowUp）
销售与线索/客户的接触记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| lead_id | FK → Lead? | 二选一 |
| customer_id | FK → Customer? | 二选一 |
| contact_id | FK → Contact? | 可选 |
| owner_id | FK → User | |
| type | Enum | phone / wechat / visit / other |
| source | Enum | `manual` / `ai`（预留） |
| content | Text | |
| followed_at | DateTime | 实际发生时间 |
| created_at | DateTime | 录入时间 |

---

### 关键事件（KeyEvent）
有业务意义的结构化节点，区别于普通跟进。

| 事件类型 | 适用对象 | 特殊字段 |
|----------|---------|---------|
| `visited_kp` | Lead / Customer | contact_id |
| `book_sent` | Lead | sent_at, responded_at?, confirmed_reading? |
| `attended_small_course` | Lead | course_date, payment_confirmed（触发转化） |
| `purchased_big_course` | Customer | contract_amount, purchase_date |
| `contact_relation_discovered` | Lead / Customer | relation_id |

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| lead_id | FK → Lead? | |
| customer_id | FK → Customer? | |
| type | Enum | |
| payload | JSON | 事件特有字段 |
| created_by | FK → User | |
| occurred_at | DateTime | |

---

### 组织节点（OrgNode）
树形结构，层级不限。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | |
| type | Enum | `root` / `region` / `team` / `custom` |
| parent_id | FK → OrgNode? | 根节点为 null |

---

### 用户（User）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | |
| org_node_id | FK → OrgNode | |

---

### 角色（Role）
内置角色：销售、战队队长、大区总、销售VP、督导、系统管理员。支持自定义角色。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | |
| description | String? | |
| is_system | Boolean | 内置角色不可删除 |

---

### 权限点（Permission）
按模块分组的细粒度操作控制。

主要权限点：`lead.view`、`lead.create`、`lead.assign`、`lead.claim`、`lead.release`、`lead.mark_lost`、`customer.view`、`customer.reassign`、`followup.create`、`keyevent.create`、`report.submit`、`report.view_team`、`org.manage`、`user.manage`、`config.manage`、`log.view`

**多对多关联表**：`RolePermission`（角色 ↔ 权限点）、`UserRole`（用户 ↔ 角色，支持一人多角色）

---

### 用户数据权限（UserDataScope）
数据可见范围，与功能权限完全独立。

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | FK → User | |
| scope | Enum | 见下方枚举 |
| node_ids | FK[] → OrgNode | 仅 `selected_nodes` 时有效 |

**Scope 枚举**：`self_only` / `current_node` / `current_and_below` / `selected_nodes` / `all`

---

### 系统配置（SystemConfig）
所有可调参数的键值配置表。

| 配置键 | 默认值 | 说明 |
|--------|--------|------|
| private_pool_limit | 100 | 私有池线索上限 |
| followup_release_days | 10 | 未跟进释放天数 |
| conversion_release_days | 30 | 未成单释放天数 |
| claim_rate_limit | 10 | 每分钟最大抢占次数 |
| daily_report_generate_at | 18:00 | 日报生成时间 |
| region_claim_rules | {} | 各大区抢占规则 |

---

### AI 技能（Skill）
供 AI Agent 调用的业务最佳实践知识库。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | |
| trigger | String | 触发场景描述 |
| content | Text | 提示词文本——告诉 AI 该怎么做 |
| category | String | 分组 |
| is_active | Boolean | |

---

### LLM 配置（LLMConfig）
LLM Provider 配置，Admin 可切换。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| provider | Enum | `anthropic` / `openai` / `deepseek` / 等 |
| model | String | 模型名称 |
| api_key | String | 加密存储 |
| is_active | Boolean | 任意时刻只有一条为 true |

---

### 对话历史（ConversationMessage）
AI Agent 聊天记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| session_id | String | 会话标识 |
| user_id | FK → User | |
| role | Enum | `user` / `assistant` / `tool` |
| content | Text | |
| created_at | DateTime | |

---

## Ontology：业务动作（Actions）

### 线索动作

**assign_lead** — 主管分配线索给销售
- 主体：`manager`, `admin`
- 前提：`lead.pool == public` AND `sales.private_pool_count < pool_limit`
- 效果：`lead.owner = sales`, `lead.pool = private`

**release_lead** — 释放线索回公共池
- 主体：系统自动, `manager`
- 前提：`lead.pool == private` AND（未跟进超阈值 OR 未成单超阈值）
- 效果：`lead.owner = null`, `lead.pool = public`

**claim_lead** — 销售从公共池抢占线索
- 主体：`sales`
- 前提：`lead.pool == public` AND 大区规则允许 AND 速率未超限
- 效果：`lead.owner = 当前销售`, `lead.pool = private`

**mark_lead_lost** — 标记线索流失
- 主体：`sales`（自己名下），`manager`
- 前提：`lead.stage == active`
- 效果：`lead.stage = lost`, `lead.lost_at = now`

**convert_lead** — 线索转化为客户
- 主体：系统自动（课时订单系统），`sales`（手动兜底）
- 前提：`lead.stage == active`
- 效果：`lead.stage = converted`，创建 Customer，迁移联系人/跟进/关键事件

---

### 客户动作

**reassign_customer** — 手工调配客户归属
- 主体：`manager`, `admin`
- 前提：无（不受私有池约束）
- 效果：`customer.owner = 目标销售`，原销售立即失去可见性

---

### 联系人动作

**add_contact** — 添加联系人
- 主体：`sales`（仅自己名下线索/客户）
- 效果：创建 Contact，检测微信/手机重复，重复时触发预警

**link_contacts** — 建立联系人关系
- 主体：`sales`, `manager`
- 效果：创建 ContactRelation，触发跨企业归属冲突检测

---

### 跟进动作

**log_followup** — 录入跟进记录
- 主体：`sales`（仅自己名下线索/客户）
- 效果：创建 FollowUp，更新 `lead.last_followup_at`

---

### 关键事件动作

**record_book_sent** — 记录送书
- 主体：`sales`
- 前提：对象为 Lead
- 效果：创建 `book_sent` KeyEvent

**confirm_small_course** — 确认购买小课（触发转化）
- 主体：系统自动，`sales`（手动兜底）
- 效果：触发 `convert_lead` 动作

**record_big_course** — 记录购买大课
- 主体：系统自动，`sales`（手动兜底）
- 前提：对象为 Customer
- 效果：创建 `purchased_big_course` KeyEvent

---

### 日报动作

**generate_daily_report** — 生成日报草稿
- 主体：系统自动（每日定时）
- 效果：汇总当天 FollowUp 生成草稿

**submit_daily_report** — 提交日报
- 主体：`sales`
- 效果：提交给战队队长（必达）+ 大区总（可选）

---

## 功能规格摘要

### SPEC-001：线索录入与唯一性校验
- 有组织机构代码 → 精确匹配，重复则阻断，显示当前归属
- 无组织机构代码 → 公司名模糊匹配，触发预警推主管确认
- 微信/手机重复 → 自动创建联系人关系 + 通知主管
- 新线索默认进入公共池

### SPEC-002：线索分配（私有池管理）
- 主管将公共池线索分配给销售
- 目标销售私有池已满时阻断
- 私有池只统计 `stage = active` 的线索
- 所有分配操作记日志

### SPEC-003：公共池抢占
- 销售可查看公共线索库（仅本大区）
- 抢占校验：池状态、私有池上限、大区规则、速率限制
- 超速率 → 账号锁定，通知主管，主管手动解锁
- 并发抢占 → 先到先得，后者返回"已被抢占"
- 大区规则可配置：仅战队内 / 战队间 / 助理手工分派

### SPEC-004：线索自动释放
- 每日定时检测私有池活跃线索
- 满足任一条件释放：10天未跟进 OR 30天未成单
- 释放时通知原销售
- 阈值 admin 可配置

### SPEC-005：线索转化
- 触发：课时订单系统事件（优先）或手动（兜底）
- 创建 Customer，迁移所有联系人/跟进/关键事件
- 线索归档，从活跃列表消失

### SPEC-006：跟进记录
- 销售对自己名下线索/客户录入跟进
- 更新 `lead.last_followup_at`
- 不可删除，可追加补充说明
- `followed_at` 不能晚于当前时间

### SPEC-007：关键事件记录
- book_sent：仅限线索阶段，可更新回应/阅读字段
- attended_small_course：触发转化
- purchased_big_course：仅客户阶段，记录合同金额
- 同一对象同类型事件不可重复创建（改为更新）

### SPEC-008：14天转化窗口
- 派生条件：`now - customer.created_at < 14天 AND 无大课订单`
- 第7天、第12天各推送提醒
- 第14天：推送"窗口已关闭"，不修改客户任何字段
- 固定14天，v1 不可配置

### SPEC-009：联系人管理
- 每个线索/客户可挂多个联系人
- 微信/手机重复 → 自动创建联系人关系 + 通知主管
- 手动建立关系：夫妻/亲属/合伙人/朋友
- 线索转化时联系人随之迁移

### SPEC-010：日报自动生成与提交
- 每日 18:00 从当天跟进记录生成草稿
- 销售审核编辑后提交给队长（必选）+ 大区总（可选）
- 当天无跟进 → 不生成草稿，20:00 推送提醒
- 提交前补录跟进则草稿自动更新
- 已提交日报不可修改

### SPEC-011：数据可见性与权限
- 功能权限：Role + Permission（能做什么）
- 数据权限：UserDataScope（能看什么），与功能权限独立
- 所有 API 端点同时校验两层权限
- 线索/客户转移后原销售立即失去可见性

### SPEC-012：组织架构管理
- OrgNode 树的增删改
- 节点下有活跃数据时阻断停用
- 用户调整挂载位置后数据可见性立即更新

### SPEC-013：用户管理
- 创建用户、分配角色（支持多角色）
- 停用前提示先转移线索/客户
- 至少保留一个系统管理员

### SPEC-014：角色与权限管理
- 自定义角色 + 可配置权限点
- 内置角色不可删除，但权限点可调整
- 修改立即生效（已登录用户下次请求生效）
- 多角色：功能权限取并集

---

## AI Agent 规格

### 聊天侧边栏
- 嵌入 CRM 的持久化 Chat UI
- 流式输出
- 对话历史按用户 session 存储

### 工具定义（来自 Ontology Actions）
所有 Ontology Actions 均暴露为 LLM 的 Tool Use 定义：
- `assign_lead`, `claim_lead`, `release_lead`, `mark_lead_lost`, `convert_lead`
- `reassign_customer`
- `log_followup`, `add_contact`, `link_contacts`
- `record_book_sent`, `confirm_small_course`, `record_big_course`
- `submit_daily_report`
- `get_skill(scenario)` — 按场景检索 Skill

### Skill 检索
- Agent 调用 `get_skill` 工具，传入场景描述
- 系统匹配 Skill.trigger，返回 Skill.content 作为上下文
- LLM 根据 Skill 内容生成更有针对性的建议

### Human-in-the-loop
- 低风险操作（查询、统计）：Agent 直接执行
- 高风险操作（分配、转化）：Agent 导航用户到预填表单，人工确认后提交

### 事件触发型 Agent（规划中）
- 后端事件（新跟进录入、小课付款、14天提醒）触发 Agent
- Agent 调用 Skill 生成建议，推送至前端，可自动创建任务

### LLM 可切换性
- Admin 在系统配置中切换激活的 LLM
- Vercel AI SDK 透明处理 Provider 切换
- Skill 内容与 LLM 无关，切换后完全有效

---

## 菜单结构

**销售**：我的线索 / 公共线索库 / 我的客户 / 我的日报

**主管**（数据范围随 OrgNode 自动变化）：数据概览 / 团队线索 / 公共线索库 / 团队客户 / 团队日报

**Admin**：全部线索 / 全部客户 / 组织管理 / 用户管理 / 权限管理 / 系统配置（含 LLM 配置 + Skill 管理）/ 操作日志

---

## 关键决策记录

| 决策点 | 结论 |
|--------|------|
| 线索与客户的关系 | 两个独立对象；线索有阶段，客户无状态 |
| 客户状态 | 无——购买情况从课时订单系统实时推导 |
| 14天转化窗口 | 派生逻辑，不存库，固定14天 |
| 数据权限与功能权限 | 完全解耦：Role+Permission vs UserDataScope |
| 公共池规则 | 按大区可配置，不硬编码 |
| 列表页视图 | 预设默认 + 用户可显示/隐藏列、保存筛选；不支持自定义字段 |
| AI 框架 | Vercel AI SDK（不用 Dify/n8n）；对话历史自行管理 |
| Skill | 纯文本存库，非 Claude 专属，LLM 无关 |
