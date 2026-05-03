> **已归档** — 当前规格见 `specs/master/spec.md`，本文件仅作历史记录保留。

# Ontology 设计

> 本文件基于业务上下文采集（`business-context.md`）整理，定义 SFA CRM 的核心业务对象、对象关系和可执行动作。
> 这是后续 API 设计、数据建模、权限体系的直接输入。

---

## 核心对象

### 1. 线索（Lead）

销售正在跟进、尚未购买小课的目标企业。有明确的归属、生命周期和流转规则。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| company_name | String | 企业名称 |
| unified_code | String? | 组织机构代码（强推荐，非强制） |
| region | Enum | 所属大区 |
| stage | Enum | 当前状态（见下方枚举） |
| owner_id | FK → User? | 当前负责销售（公共线索库时为 null） |
| pool | Enum | 所在池：`private` / `public` |
| source | Enum | 线索来源 |
| created_at | DateTime | 录入时间 |
| last_followup_at | DateTime? | 最近跟进时间 |
| converted_at | DateTime? | 转化为客户的时间（转化后填入） |
| lost_at | DateTime? | 标记流失的时间 |

**阶段枚举（stage）：**
- `active`：跟进中（默认状态）
- `converted`：已转化（购买小课，已生成客户记录，线索归档）
- `lost`：已流失（销售主动标记，明确无意向）

**线索来源枚举（source）：**
- `referral`：转介绍
- `organic`：自然流量
- `koc_sem`：KOC/SEM 付费引流
- `outbound`：销售主动陌拜

**唯一性规则：**
- 有组织机构代码：精确匹配，命中则阻断
- 无组织机构代码：名称相似度 + 联系人 wechat_id/phone 做模糊预警，推主管确认
- 同一线索只能有一个 owner

---

### 2. 客户（Customer）

购买了小课后升级创建的企业记录。无业务状态，购买了什么产品从课时订单系统实时查询。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| lead_id | FK → Lead | 来源线索（归档的线索记录） |
| company_name | String | 企业名称（从线索继承） |
| unified_code | String? | 组织机构代码（从线索继承） |
| region | Enum | 所属大区 |
| owner_id | FK → User | 归属销售（转化时从线索继承，后续可手工调配） |
| source | Enum | 线索来源（从线索继承，用于分析） |
| created_at | DateTime | 客户创建时间（= 转化时间） |

**关于客户状态：**
客户本身无状态字段。以下业务判断全部从课时订单系统数据实时推导：
- 是否购买大课 → 查课时订单
- 是否在转化窗口内 → `now - customer.created_at < 14天 AND 无大课订单`
- 后续新产品购买情况 → 同样从订单系统查

---

### 3. 联系人（Contact）

挂在线索或客户下的自然人，可多个。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| lead_id | FK → Lead? | 关联线索（二选一） |
| customer_id | FK → Customer? | 关联客户（二选一） |
| name | String | 姓名 |
| role | String? | 职位 |
| is_key_decision_maker | Boolean | 是否关键决策人 |
| wechat_id | String? | 微信号 |
| phone | String? | 手机号 |
| created_at | DateTime | 录入时间 |

> 线索转化为客户时，联系人随之迁移到客户下（`lead_id → null`, `customer_id = 新客户`）。

**联系人关系（ContactRelation）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| contact_a_id | FK → Contact | 联系人 A |
| contact_b_id | FK → Contact | 联系人 B |
| relation_type | Enum | 夫妻 / 亲属 / 合伙人 / 朋友 |
| note | String? | 备注 |
| created_by | FK → User | 录入者 |

⚠️ **预警规则：** 两个联系人 wechat_id 或 phone 相同时，系统自动创建 ContactRelation 并通知主管。

---

### 4. 跟进记录（FollowUp）

销售与线索/客户的接触记录，挂在线索或客户下。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| lead_id | FK → Lead? | 关联线索（二选一） |
| customer_id | FK → Customer? | 关联客户（二选一） |
| contact_id | FK → Contact? | 关联联系人（可选） |
| owner_id | FK → User | 跟进销售 |
| type | Enum | 电话 / 微信 / 拜访 / 其他 |
| source | Enum | `manual`（手动）/ `ai`（AI 自动，预留） |
| content | Text | 跟进内容 |
| followed_at | DateTime | 实际发生时间 |
| created_at | DateTime | 录入时间 |

> 线索转化为客户时，线索阶段的跟进记录迁移到客户下。

---

### 5. 关键事件（KeyEvent）

业务上有特殊意义的节点，结构化记录，区别于普通跟进。

**事件类型：**
| 事件 | 属于 | 触发条件 | 特殊字段 |
|------|------|----------|----------|
| `visited_kp` | Lead / Customer | 拜访关键决策人 | contact_id |
| `book_sent` | Lead | 送出专著 | sent_at, responded_at?, confirmed_reading? |
| `attended_small_course` | Lead | 购买小课（触发转化） | course_date, payment_confirmed |
| `purchased_big_course` | Customer | 购买大课 | contract_amount, purchase_date |
| `contact_relation_discovered` | Lead / Customer | 发现跨企业人脉 | relation_id |

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| lead_id | FK → Lead? | 关联线索（二选一） |
| customer_id | FK → Customer? | 关联客户（二选一） |
| type | Enum | 事件类型 |
| payload | JSON | 事件特有字段 |
| created_by | FK → User | 录入者 |
| occurred_at | DateTime | 事件发生时间 |

---

### 6. 组织节点（OrgNode）

树形结构表达组织层级，深度不限。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| name | String | 节点名称 |
| type | Enum | `root` / `region` / `team` / `custom` |
| parent_id | FK → OrgNode? | 父节点（根节点为 null） |

---

### 7. 用户（User）

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| name | String | 姓名 |
| org_node_id | FK → OrgNode | 所属组织节点 |

用户可挂载一个或多个角色（通过 UserRole 关联表）。

---

### 8. 角色（Role）

系统内可自定义的权限集合。初始内置角色：`销售`、`战队队长`、`大区总`、`销售VP`、`督导`、`系统管理员`，可按需新增。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| name | String | 角色名称 |
| description | String? | 描述 |
| is_system | Boolean | 是否内置角色（内置角色不可删除） |

---

### 9. 权限点（Permission）

系统内所有可控制的操作，按模块分组。

**示例权限点：**
| 权限点 | 说明 |
|--------|------|
| `lead.view` | 查看线索 |
| `lead.create` | 录入线索 |
| `lead.assign` | 分配线索给销售 |
| `lead.claim` | 从公共线索库抢占 |
| `lead.release` | 释放线索回公共线索库 |
| `lead.mark_lost` | 标记线索流失 |
| `customer.view` | 查看客户 |
| `customer.reassign` | 调配客户归属 |
| `followup.create` | 录入跟进记录 |
| `keyevent.create` | 录入关键事件 |
| `report.submit` | 提交日报 |
| `report.view_team` | 查看团队日报 |
| `org.manage` | 管理组织架构 |
| `user.manage` | 管理用户和角色 |
| `config.manage` | 修改系统配置 |
| `log.view` | 查看操作日志 |

**关联表：**
- `RolePermission`：角色 → 权限点（多对多）
- `UserRole`：用户 → 角色（多对多，支持一人多角色）

---

## 对象关系图

```
OrgNode ──tree──► OrgNode
    │
    └──► User ──UserRole──► Role ──RolePermission──► Permission
          │
          ├──UserDataScope──► DataScope（+ 可选 node_ids → OrgNode[]）
          │
          └──owns──► Lead ──converted──► Customer
                      │                      │
                 Contact ◄──────────── Contact（转化后迁移）
                      │
               ContactRelation（跨企业）

         Lead ──has many──► FollowUp ──migrates──► Customer
         Lead ──has many──► KeyEvent ──migrates──► Customer
```

---

## 数据权限规则

数据权限与功能权限**完全分离**：

- **功能权限**（Role + Permission）：控制用户能执行哪些操作
- **数据权限**（DataScope）：控制用户能看到哪些范围的数据，基于用户在 OrgNode 树的位置 + 固定控制符

### DataScope 枚举

| 控制符 | 含义 |
|--------|------|
| `self_only` | 仅自己名下的数据（`owner == self`） |
| `current_node` | 仅当前所在 OrgNode 下的数据 |
| `current_and_below` | 当前 OrgNode 及所有子节点下的数据 |
| `selected_nodes` | 手工指定的 OrgNode 列表（需配合 `UserDataScope.node_ids`） |
| `all` | 全部数据，不受 OrgNode 限制 |

### UserDataScope（用户数据权限配置）

每个用户可单独配置数据权限，独立于其角色：

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | FK → User | 用户 |
| scope | Enum | DataScope 控制符 |
| node_ids | FK[] → OrgNode | 仅 `selected_nodes` 时有效 |

> 典型配置举例：
> - 一线销售：`self_only`
> - 战队队长：`current_and_below`
> - 督导：`all`（只读，通过功能权限限制不可操作）
> - 跨大区协作角色：`selected_nodes`，手工指定几个大区节点

---

## 核心业务规则

### 线索流转

1. 录入时检测唯一性，冲突推主管确认
2. 主管手动分配线索给销售，进入私有池
3. 私有池上限：可配置（默认 100，不含已转化客户）
4. 自动释放条件（可配置）：
   - 10 天未跟进 → 释放回公共线索库
   - 30 天未成单 → 释放回公共线索库
5. `converted` 和 `lost` 状态的线索不参与自动释放

### 线索转化为客户

1. 购买小课事件触发（优先课时订单系统，销售可手动兜底）
2. 执行：
   - `lead.stage = converted`, `lead.converted_at = now`
   - 创建 Customer 记录，`customer.lead_id = lead.id`
   - 联系人、跟进记录、关键事件全部迁移到 Customer 下
3. 转化后线索归档，不再出现在活跃线索列表

### 大课转化窗口（派生逻辑，不存状态）

- 条件：`now - customer.created_at < 14天 AND 课时系统无大课订单`
- 系统在第 7 天、第 12 天推送提醒给销售和队长
- 第 14 天仍无大课订单：推送提醒"转化窗口已关闭"，不改客户任何字段

### 客户归属调配

- 客户归属固定，不参与公私池流转
- 主管可手动调配客户归属（不受私有池上限约束）
- 调配后原销售立即失去可见性

### 防刷保护

- 同一账号抢占公共线索库：每分钟不超过 N 次（N 可配置）
- 超限自动锁定，通知主管

---

## Actions（业务动作）

### Lead Actions

**assign_lead** — 分配线索给销售
- 主体：`manager`, `admin`
- 前提：`lead.pool == public` AND `sales.private_pool_count < pool_limit`
- 效果：`lead.owner = sales`, `lead.pool = private`

**release_lead** — 释放线索回公共线索库
- 主体：系统自动, `manager`
- 前提：`lead.pool == private` AND（未跟进超阈值 OR 未成单超阈值）
- 效果：`lead.owner = null`, `lead.pool = public`

**claim_lead** — 从公共线索库抢占线索
- 主体：`sales`
- 前提：`lead.pool == public` AND 大区规则允许 AND 速率未超限
- 效果：`lead.owner = sales`, `lead.pool = private`

**mark_lead_lost** — 标记线索流失
- 主体：`sales`（自己名下）, `manager`
- 前提：`lead.stage == active`
- 效果：`lead.stage = lost`, `lead.lost_at = now`

**convert_lead** — 线索转化为客户
- 主体：系统自动（课时订单系统），`sales`（手动兜底）
- 前提：`lead.stage == active`
- 效果：`lead.stage = converted`，创建 Customer，迁移联系人/跟进/关键事件

---

### Customer Actions

**reassign_customer** — 手工调配客户归属
- 主体：`manager`, `admin`
- 前提：无（不受私有池约束）
- 效果：`customer.owner = 目标销售`，原销售立即失去可见性

---

### Contact Actions

**add_contact** — 添加联系人
- 主体：`sales`（仅自己名下线索/客户）
- 效果：创建 Contact，检测 wechat_id/phone 重复，触发预警

**link_contacts** — 建立联系人关系
- 主体：`sales`, `manager`
- 效果：创建 ContactRelation，触发跨企业归属冲突检测

---

### FollowUp Actions

**log_followup** — 记录跟进
- 主体：`sales`（仅自己名下线索/客户）
- 效果：创建 FollowUp，更新 `lead.last_followup_at`（线索阶段）

---

### KeyEvent Actions

**record_book_sent** — 记录送书
- 主体：`sales`
- 前提：对象为 Lead
- 效果：创建 `book_sent` KeyEvent

**confirm_small_course** — 确认购买小课（触发转化）
- 主体：系统自动, `sales`（手动兜底）
- 效果：触发 `convert_lead` Action

**record_big_course** — 记录购买大课
- 主体：系统自动, `sales`（手动兜底）
- 前提：对象为 Customer
- 效果：创建 `purchased_big_course` KeyEvent

---

### Report Actions

**generate_daily_report** — 生成日报草稿
- 主体：系统自动（每日定时）
- 效果：汇总当天 FollowUp 生成草稿

**submit_daily_report** — 提交日报
- 主体：`sales`
- 效果：提交给 `team_lead`（必达）+ `region_head`（可选）

---

## 已确认决策

| 问题 | 决策 |
|------|------|
| 线索与客户关系 | 两个独立对象，转化时创建客户，线索归档 |
| 客户状态 | 无状态，购买情况从课时订单系统实时推导 |
| 大课转化窗口 | 派生逻辑，14天固定，不写入客户字段 |
| 客户流失标记 | 不显式存储，从订单数据推导 |
| 公私池机制 | 仅属于线索，客户归属固定 |
| 客户归属调配 | 主管手工调配，不受私有池上限约束 |
| 转化后历史数据 | 联系人/跟进/关键事件全部迁移到客户下 |
| 大课转化窗口时长 | 14天，固定 |
| 私有池上限 | 可配置，默认 100 |
| 企业大区归属 | 按企业注册地 |
| 组织结构 | OrgNode 树形，层级不限 |
