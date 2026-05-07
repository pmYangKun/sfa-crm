# Spec 004 Research：关键技术决策记录

---

## 1. Pipeline 行 = Lead vs Opportunity 子模型 vs Lead+Customer 混合

**决策：行 = Lead + 3 新字段（amount / close_date / forecast_category）**

**Alternatives：**
- B：新建 Opportunity 子模型（Salesforce 派）
- C：Lead + Customer 混合表

**Why Lead 直接扩字段：**
- spec 003 MEDDICC Evidence 已挂在 Lead 上，零迁移成本
- Lead 转化为 Customer 时**保留 Lead 行**（status → converted），不归档迁移——这条已有 logic
- 避免引入新概念（Opportunity）增加心智复杂度
- B 方案需 evidence 表 FK 大改 + 数据回填脚本，2 周 timeline 内做不完
- C 方案 Pipeline 查询跨表，UI 渲染分叉，违反"单页所有信号"心智

---

## 2. Forecasting 体系是否做？

**决策：spec 004 主体 = Pipeline Management（漏斗管理），不做 Forecasting**

**Alternatives：**
- B：附带做 Forecast 显示层（聚合金额 + 至险子集）
- C：完整 Forecasting（多层提报链 + 准确率回测）

**Why Pipeline Management only：**
- Forecasting 的灵魂是"销售→经理→VP 多层提报 + 留痕 + 准确率反向追踪"，需独立大 spec
- B 看似轻量但金额聚合一旦显示，UI 会"假装是 Forecasting"误导用户
- spec 004 砍掉所有金额聚合显示——Forecast Categories 6 tab 仅显示**条数 + Warning 数**，不显示金额。**这是产品定位的硬边界。**
- C 留给远期独立 spec（spec 010+）

**澄清：** Forecast Category 字段本身保留（lead 加这个字段）——它是 Lead 的"销售信心标签"，独立存在。Pipeline 用它做分组筛选，但不上升到"预测金额聚合 + roll-up"的 Forecasting 心智。

---

## 3. Warning 计算：实时 lazy vs cron 持久化

**决策：Lazy compute on read, no cron, 不持久化结果**

**Alternatives：**
- B：cron 每 5 分钟扫一遍写持久化结果
- C：每次 lead 数据变更触发重算 + 持久化

**Why Lazy：**
- 100 lead 量级单次计算 < 50ms，性能足够
- 持久化引入"过期 stale 状态"问题——什么时候清？什么时候重算？
- "Warning 自动消除"语义最干净的实现：每次都重算，条件不满足就没有
- cron 引入定时任务调度，跟现有 APScheduler（限流 reset / demo 重置）共用，维护成本上升
- 超大量级（1000+ lead）问题留给 spec 005+ 优化（缓存 5 分钟）

---

## 4. AI 校验触发时机：常驻 vs 触发式

**决策：触发式 ——仅在 forecast_category 升级到必赢/大概率时触发**

**Alternatives：**
- B：Pipeline 全表常驻 sparkle ✨ AI 建议（每条 lead 都标）
- C：每日 cron 主动巡检 + 邮件 / 站内通知

**Why 触发式：**
- B 需要每天 cron 跑一遍全部 lead 的 LLM 调用——成本高 + 时延长
- B 的 sparkle 列在 Pipeline 全表已经 8 列时再加一列会过载
- 触发式恰好卡在"销售拍胸脯"这个最戏剧性的瞬间——比常驻"始终在那里"的张力强
- 触发式 LLM 调用次数 = forecast_category 升级次数（每天 < 50 次），成本可控
- C 留给 spec 005+ 主题攻势

---

## 5. 趋势图数据源：history 表 vs 实时聚合

**决策：新建 lead_meddicc_history 快照表 + 启动 backfill**

**Alternatives：**
- B：实时从 lead_meddicc_evidence 聚合（每条 evidence 的 created_at 作为时间序列点）
- C：仅建表不显示图（spec 005 再补 UI）

**Why 快照表：**
- B 的问题：spec 003 用 Replace 策略——每次 analyze 把旧 evidence 全删 + 写新——所以 evidence.created_at 是"最近一次 analyze 时间"，不是历史变化时间。从 evidence 表恢复趋势不可能
- B 的另一问题：跨 evidence 重新计算 Score 需要多次跑 score_calculator，性能差
- 快照表 schema 简单（一行 = 一个时点的 score + completion + dimensions_json），查询快
- 启动 backfill 一次性补齐历史 baseline，后续每次 analyze + forecast 变更增量写 1 行

---

## 6. Forecast Category 中文 vs 英文

**决策：DB 存中文 + 代码 + UI 全程中文**

**Alternatives：**
- B：DB 存英文枚举（OPEN / COMMIT / ...），UI 渲染时转中文
- C：DB 存中文 + 代码用英文常量 + 中间层映射

**Why 全程中文：**
- 用户明确要求 UI 中文（per `feedback_sfacrm_product_ui.md` + 2026-05-07 反馈）
- B 引入"翻译层"——code 写 `if forecast == 'COMMIT'`，UI 显示"必赢"——容易出 bug（漏翻译 / 错位）
- C 同 B 问题
- 全程中文避免转换层 bug，跟 SFA CRM 既有 lead.stage（active / converted / lost 英文）的逻辑稍有差异，但 stage 是技术状态机不显示给用户，forecast 是给用户看的标签——分类不同合理

---

## 7. AI 校验 timeout：长 vs 短

**决策：3 秒超时直接放行**

**Alternatives：**
- B：30 秒 timeout（让 LLM 跑完）
- C：无 timeout（一直等）

**Why 3 秒：**
- 销售工作流不能被 AI 卡——3 秒是用户能接受的"等一下"上限
- DeepSeek-chat 大多数响应 1-2 秒，3 秒覆盖 95%+ case
- 超过 3 秒的边缘 case 直接放行，避免最差体验
- toast 提示告知用户"AI 没赶上"，保持透明度

---

## 8. Mobile 形态：视觉对等 vs 语义对等

**决策：语义对等 + 移动端原生布局（卡片化）**

**Alternatives：**
- B：视觉对等（移动端也横铺全表，左右滑动）
- C：功能裁剪（移动端只做摘要）

**Why 语义对等：**
- B 在 8 列宽表上左右滑动体验糟，违反 "无 mobile 红线" 但同时也不好用
- C 违反 spec 003 已立的 "无暂不支持移动端" 硬规则
- 语义对等是行业标准（Salesforce mobile / HubSpot mobile）
- 卡片化 UI 在 spec 003 已落地（MobileFormSheet 等），spec 004 复用

---

## 9. 推送 origin remote 的授权

按 user 2026-05-07 锻炼前授权："你就一路继续吧，不用再找我确认了 ... 全部都自动化"——本次允许 push origin（含 PR + tag）。

**注意：** 这是一次性授权，不延伸到下一个 spec（feedback_git_remote_authorization.md 规矩仍在）。spec 005 push 时仍需用户确认。
