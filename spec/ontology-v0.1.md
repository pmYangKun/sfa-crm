# Ontology 设计 v0.1

> 本文件基于业务上下文采集（`business-context.md`）整理，定义 SFA CRM 的核心业务对象、对象关系和可执行动作。
> 这是后续 API 设计、数据建模、权限体系的直接输入。

---

## 核心对象

### 1. 企业（Company）

签约和归属的核心主体。线索和客户都归属在企业上，不归属在个人上。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| name | String | 企业名称 |
| unified_code | String? | 组织机构代码（强推荐，非强制） |
| region | Enum | 所属大区（用于分配归属） |
| stage | Enum | 当前阶段：线索 / 客户 |
| owner_id | FK → User | 当前负责销售 |
| pool | Enum | 所在池：私有 / 公共 |
| source | Enum | 线索来源（见下方枚举） |
| created_at | DateTime | 录入时间 |
| last_followup_at | DateTime | 最近跟进时间 |

**线索来源枚举（source）：**
- `referral`：转介绍（质量最高）
- `organic`：自然流量（SEO/直接访问）
- `koc_sem`：KOC/SEM 付费引流
- `outbound`：销售主动陌拜（质量最低）

**阶段枚举（stage）：**
- `lead`：线索（未购小课）
- `customer`：客户（已购小课，处于大课转化窗口）
- `converted`：已转化（已购大课）
- `lost`：已流失

**唯一性规则：**
- 有组织机构代码：以代码作为去重键，强校验
- 无组织机构代码：用企业名相似度 + 关键联系人微信号/手机号做模糊预警，推给主管确认
- 同一企业只能有一个 owner，不允许多销售同时持有

---

### 2. 联系人（Contact）

挂在企业下的自然人，可以有多个。CEO 是关键决策人，但也可能有其他购课对象（骨干员工）。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| company_id | FK → Company | 所属企业 |
| name | String | 姓名 |
| role | String? | 职位（CEO / 骨干员工等） |
| is_key_decision_maker | Boolean | 是否为关键决策人 |
| wechat_id | String? | 微信号（唯一性检测用） |
| phone | String? | 手机号 |
| created_at | DateTime | 录入时间 |

**联系人关系（ContactRelation）：**
用于记录跨企业的人脉关联，事后发现时补录。

| 字段 | 类型 | 说明 |
|------|------|------|
| contact_a_id | FK → Contact | 联系人 A |
| contact_b_id | FK → Contact | 联系人 B |
| relation_type | Enum | 关系类型：夫妻 / 亲属 / 合伙人 / 朋友 |
| note | String? | 备注 |
| created_by | FK → User | 由谁发现并录入 |

⚠️ **预警规则：** 当两个联系人的 wechat_id 或 phone 相同时，系统自动创建关联记录并通知主管。

---

### 3. 跟进记录（FollowUp）

销售每次与企业/联系人的接触记录。挂在企业下，可关联具体联系人。

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| company_id | FK → Company | 关联企业 |
| contact_id | FK → Contact? | 关联联系人（可选） |
| owner_id | FK → User | 跟进销售 |
| type | Enum | 跟进方式：电话 / 微信 / 拜访 / 其他 |
| source | Enum | 录入来源：手动 / AI自动（预留） |
| content | Text | 跟进内容 |
| followed_at | DateTime | 实际发生时间 |
| created_at | DateTime | 录入时间 |

---

### 4. 关键事件（KeyEvent）

业务上有特殊意义的动作节点，带时间戳结构化记录，区别于普通跟进记录。

**事件类型：**
| 事件 | 触发条件 | 特殊字段 |
|------|----------|----------|
| `visited_kp` | 拜访了关键决策人 | contact_id |
| `book_sent` | 送出专著 | sent_at, responded_at?, confirmed_reading? |
| `attended_small_course` | 参加小课（线索→客户转化点） | course_date, payment_confirmed |
| `purchased_big_course` | 购买大课（最终转化） | contract_amount, purchase_date |
| `contact_relation_discovered` | 发现跨企业人脉关联 | relation_id |

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| company_id | FK → Company | 关联企业 |
| type | Enum | 事件类型（见上表） |
| payload | JSON | 事件特有字段 |
| created_by | FK → User | 录入者 |
| occurred_at | DateTime | 事件发生时间 |

---

### 5. 用户（User）

系统内的操作人员，对应组织结构中的角色。

**角色枚举：**
- `sales`：一线销售
- `team_lead`：战队队长
- `region_head`：大区总
- `vp`：销售VP
- `admin`：总部管理员

**属性：**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 系统唯一标识 |
| name | String | 姓名 |
| role | Enum | 角色 |
| region | Enum? | 所属大区（大区总及以下） |
| team_id | FK → Team? | 所属战队 |

---

## 对象关系图

```
User ──owns──► Company ──has many──► Contact
                  │                      │
                  │              ContactRelation
                  │                （跨企业关联）
                  ├──has many──► FollowUp
                  └──has many──► KeyEvent
```

---

## 核心业务规则

### 线索分配与客保

1. 企业录入时，系统检测唯一性，冲突推主管确认
2. 主管手动分配企业给销售，进入销售私有池
3. 私有池上限：100 个企业（不含已转化客户）
4. 释放条件（可配置，当前默认值）：
   - 10 天未跟进 → 自动释放回公共池
   - 30 天未成单 → 自动释放回公共池
5. 公共池抢占规则：按大区配置，**仅总部管理员可修改规则**，大区总需申请审批

### 大课转化窗口

- 企业进入 `customer` 阶段（参加小课）后，系统开启 14 天转化窗口
- 窗口内未产生 `purchased_big_course` 事件，系统推送提醒给销售和战队队长
- 窗口关闭后标记为 `lost`，但记录保留

### 防刷保护

- 同一账号抢占公共池操作：每分钟不超过 N 次（N 可配置）
- 超出限制自动锁定账号，通知主管

### 日报自动生成

- 每日系统从当天 FollowUp 记录自动汇总生成日报草稿
- 销售确认后一键提交，不需要重复填写

---

## 待确认问题

1. **大课转化窗口**：14 天是否准确？是否可配置？
2. **私有池上限 100**：是否各大区统一，还是也需要可配置？
3. **企业 region 归属**：按企业注册地，还是按负责销售所在大区？
4. **联系人关系类型**：枚举是否够用，还有其他常见类型？
5. **日报提交对象**：提交给战队队长，还是也抄送大区总？

---

*v0.1 — 基于业务上下文采集整理，待杨老师确认后进入 v0.2*
