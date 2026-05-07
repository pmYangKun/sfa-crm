# 新一代 AI Native CRM 全景调研 + SFA CRM 演进参考路线图（2026-05）

> **本文档为参考资料，非行动指引。**
>
> 内容来自一次基于 11 家国际新一代 CRM 厂商的横向调研 + 与 Claude 的多轮对齐讨论。最终目的是给杨堃的 SFA CRM 演示项目提供"接下来可以往哪些方向走"的参考。
>
> **不要把第七部分的"6+1 版本路线图"当成必须按顺序执行的清单。** 用户会自己学习理解每家产品和每个范式的业务价值，按当下需要逐场景迭代。
>
> **使用方式建议**：先读第二部分（11 家 elevator pitch）建立画面感 → 选 1-2 家点开链接细看 → 读第三部分（12 范式）建立词汇表 → 第七部分（路线图）只作为"如果某天想做某个范式时怎么把它放进 SFA CRM" 的参考。

---

## 目录

1. [背景与方法](#一背景与方法)
2. [11 家厂商 elevator pitch + 入门链接](#二11-家厂商-elevator-pitch--入门链接)
3. [12 范式 + demo 适配性](#三12-范式--demo-适配性)
4. [SFA CRM 当前能力 vs 12 范式 差距矩阵](#四sfa-crm-当前能力-vs-12-范式-差距矩阵)
5. [关键术语澄清](#五关键术语澄清)
6. ["业务侧 / 架构侧"在每版里的关系](#六业务侧--架构侧在每版里的关系)
7. [6+1 版本参考路线图](#七61-版本参考路线图非顺序承诺仅作参考)
8. [刻意不做的 6 个范式](#八刻意不做的-6-个范式)
9. [来源 URL 列表](#九来源-url-列表)

---

## 一、背景与方法

### 调研动机

杨老师希望 SFA CRM 演示项目能持续迭代成"全世界最先进的 AI Native CRM 模拟"，便于：

- 路径 1：CRM 业务形态变革（表单驱动 → 对话驱动；行为驱动哲学；半结构化数据沉淀；Next Best Action）→ 锚定「现代 CRM 专家」心智
- 路径 2：ToB × AI 架构变革（Headless / MCP / Skill 自助 / Tool Use / Agentic 编排）→ 锚定「vibe coding 达人」心智

### 调研范围

11 家国际厂商，覆盖 conversation intelligence / revenue intelligence / sales engagement / customer success / modern CRM / AI Agent platform 全谱：

**深度调研 6 家**：Gong / Salesforce Agentforce / HubSpot Breeze / Clari / Attio / People.ai
**泛读 4 家**：Microsoft Copilot for Sales / Apollo.io / Outreach / Gainsight
**外加**：HubSpot Sales Hub（HubSpot 销售模块本体，与 Breeze AI 体系并列）

### 三次关键拷问对齐（用户驳回过 2 次）

1. 第一稿仅参考 Gong 一家被驳回 → 扩展到 11 家
2. 第二稿调研 11 家但未做 demo 适配性筛选被驳回 → 加 demo 适配列
3. "AI Agent 拆分"叙事被质疑 → 不拆，用"统一主 Chat 渐进增强 + 多场景调用入口"替代；同时 Activity 自动捕获 / Outlook 嵌入 等做不到的范式归入"刻意不做"

---

## 二、11 家厂商 elevator pitch + 入门链接

### 1. Gong
**做啥的**：起家于销售对话录音 + AI 自动转录分析（早期靠"Zoom/Teams 通话录音 → 自动打 tag"出名），后来扩展成 Revenue AI 平台。
**核心产品**：Engage（外联）、Forecast（预测）、Enable（教练）、AI Agents（14+ 个原子 Agent：Briefer / Tasker / Composer / Reviewer / Tracker 等）。
**最大特色**：**对话即数据**——把销售跟客户的每次互动（call/email/会议）当头等公民，自动转录并抽取信号。
**对 SFA CRM**：v1.1 Tracker 直接照搬概念、v1.2/v1.3 Tasker/Reviewer 借鉴 Agent 命名锚。

- 主推：[Understanding AI Agents](https://help.gong.io/docs/understanding-ai-agents) — Gong 14+ AI Agents 全景
- 补充：[Gong 产品页 6 大模块](https://www.gong.io/product/) — Revenue Graph / Engage / Forecast / Enable / AI / Collective

### 2. Salesforce Agentforce
**做啥的**：Salesforce 2024 推出的 Agentic AI 平台，是 Salesforce 对 GenAI 的官方答卷。
**核心产品**：打包 SDR Agent（自动跟进新线索）、Sales Coach Agent（陪练 + 反馈）、Service Agent（客服）等 7+ 行业垂直 Agent。
**最大特色**：**把 AI Agent 当 SaaS 产品卖**（按 Agent 收费），是 Agentic 商业化最激进的厂商。
**对 SFA CRM**：Einstein NBA 是 Next Best Action 这词的源头；本身是路线图"刻意不做拆 Agent"的反面教材（揭穿大厂 Agent 拆分本质）。

- 主推：[Agentforce 主页](https://www.salesforce.com/agentforce/)
- 补充：[Einstein SDR + Sales Coach 发布](https://www.salesforce.com/news/stories/einstein-sales-agents-announcement/)

### 3. HubSpot Breeze
**做啥的**：HubSpot 2024 推出的 AI 体系，针对 SMB 中小企业。
**核心产品**：三件套——Breeze Copilot（聊天助手）、Breeze Agents（5 个：Customer / Prospecting / Data / Company Research / Customer Health）、Breeze Intelligence（数据增强）。
**最大特色**：**2026 年推出 Audit Cards**——每次 AI 动作生成时间戳卡，记录改了什么字段、用了什么数据、AI 调了什么工具，可追溯审计。
**对 SFA CRM**：v1.3 Audit Cards 直接抄它的设计，v1.0 Health Score 借鉴 Customer Health Agent 思路。

- 主推：[Breeze AI Agents 产品页](https://www.hubspot.com/products/artificial-intelligence/breeze-ai-agents)
- 补充：[官方 understand Breeze 文档](https://knowledge.hubspot.com/ai/understand-breeze)

### 4. HubSpot Sales Hub
**做啥的**：HubSpot 的销售模块本体，不算 AI 增强，是传统 SFA CRM 的 modern 版本。
**核心产品**：Pipeline 管理、Deal 视图、Sequences（自动化外联序列）、邮件追踪、会议安排、文档追踪、对话智能。
**最大特色**：**一体化 + 上手快**（vs Salesforce 的"拼装平台 + 复杂 + 贵"），是 SMB 首选。
**对 SFA CRM**：v1.4 Sequences 模板直接参考它的形态，v1.2 NBA 参考它的 Guided Selling 实现。

- 主推：[Sales Hub 产品页](https://www.hubspot.com/products/sales)

### 5. Clari
**做啥的**：Revenue Operations 平台，专攻销售预测和管道治理（不做销售外联本身，做销售管理者用的"宏观面板"）。
**核心产品**：RevDB（统一收入数据库）、Forecast（AI 预测）、Copilot（对话智能）、Groove（销售外联）、Inspect（管道检查）。
**最大特色**：**洞察→自动触发 corrective workflow** 闭环（不只检测风险，还自动派任务/发提醒救火）。
**对 SFA CRM**：v1.3 风险预警 + 自动 Cadence 是 Clari 的强项，是这版本最强参照。

- 主推：[Clari Products 全景](https://www.clari.com/products/)

### 6. Attio
**做啥的**：Modern CRM 新派（2023+ YC 出来的），强调"AI-first 数据模型"，不是给大企业销售团队，是给 startups + builders。
**核心产品**：Object/Record/Workflow 高度可配置 + MCP + Apps SDK + Email/Calendar 同步 + 语义搜索。
**最大特色**：**AI 不是事后叠加，是设计起点**——schema 设计阶段就内置 AI 承载，数据与 UI 解耦让任何 LLM 客户端能挂。
**对 SFA CRM**：v1.5 Headless / MCP / AI-first Schema 反思的最强标杆。

- 主推：[Attio 主站](https://attio.com/)

### 7. People.ai
**做啥的**：Activity Capture 鼻祖（10 年前就在做这个），不卖完整 CRM，是给销售团队加装的"活动数据底座"。
**核心产品**：从邮箱/日历/通话/Slack/LinkedIn 自动抽销售活动 → 匹配到 CRM 对象 → 作为 AI 分析的数据底座 + SalesAI（生成式 AI 助手）+ Forensics（深度分析）。
**最大特色**：**数据完整度决定 AI 上限**——别上来做 AI，先把活动捕获做好；这是它跟所有"AI 驱动" 公司的根本差别。
**对 SFA CRM**：v1.0 Activity Timeline 概念来源 + "刻意不做" 第 1 项的代表（自动捕获需要企业部署 + 安全审批，demo 做不了）。

- 主推：[SalesAI 产品页](https://www.people.ai/product/sales-ai)
- 补充：[Activity Capture 原理博客](https://www.people.ai/blog/automated-sales-activity-capture-for-ai)

### 8. Microsoft Copilot for Sales
**做啥的**：微软的 AI 销售助手，定位是**嵌入 Outlook + Teams + Dynamics 365 / Salesforce**，不是独立 CRM。
**核心产品**：Outlook 写邮件时直接 update CRM、Teams 开完会自动总结写回 CRM、邮件自动关联 CRM 记录、销售动作建议在 Office 里原地浮现。
**最大特色**：**销售根本不打开 CRM**——AI 在销售已经在用的 Outlook/Teams 里原地出现，不让销售切换工具。
**对 SFA CRM**：v1.6 移动深度的灵感 + "刻意不做" 第 3 项的代表（Outlook/Teams 嵌入需要 Microsoft Graph API 对接，demo 走不通）。

- 主推：[官方 Sales Agent 介绍](https://learn.microsoft.com/en-us/microsoft-sales-copilot/introduction)
- 补充：[2026 release wave 1 features](https://learn.microsoft.com/en-us/copilot/release-plan/2026wave1/copilot-sales/)

### 9. Apollo.io
**做啥的**：Sales Intelligence + Engagement 一体平台，主打"用一家替代 5 个工具"。
**核心产品**：230M+ B2B 联系人数据库 + 多渠道外联序列（邮件/电话/LinkedIn）+ 通话录音 + 工作流引擎 + AI Power-ups。
**最大特色**：**B2B 数据库 + 外联 + 通话 + CRM enrichment + 工作流五合一**，不用多采购，对小销售团队特别经济。
**对 SFA CRM**：v1.4 Sequences 的对照、Engage 形态参考；让我们看到"整合 vs 拆分" 的另一种产品哲学。

- 主推：[Apollo Product 页](https://www.apollo.io/product)

### 10. Outreach
**做啥的**：Sales Engagement 老牌龙头（Gong Engage 对标的就是它），2026 年改名 Outreach.ai 强调 Agentic 转型。
**核心产品**：Sequences、Deal Management、Conversations、Forecast、AI Agents（自治执行外联任务）。
**最大特色**：**Mutual Action Plan** 独门——客户与销售共享一个 deal 推进计划页（含里程碑 + 双方任务 + 内部文档链接），把"我催客户"变成"和客户一起推进"。
**对 SFA CRM**：v1.4 Mutual Action Plan 直接抄它的形态。

- 主推：[Outreach Platform](https://www.outreach.ai/platform)

### 11. Gainsight
**做啥的**：Customer Success 平台鼻祖（2009 年就有），不是 SFA 而是售后客户运营（已经签约的客户怎么留住 + 增购）。
**核心产品**：Customer 360、Health Score、Playbooks、NPS、Customer Journey、Renewals & Expansion 风险预测。
**最大特色**：**Health Score 鼻祖**——客户/关系健康度评分（多维信号融合：产品使用 + NPS + 情绪 + 利益相关者状态）+ 账户级 + 关系级双层评估，是行业 Health Score 标准模板。
**对 SFA CRM**：v1.0 Health Score 5 维设计的祖师爷，杨老师写"为什么 stage 是谎言"那篇硬观点的最佳引用对象。

- 主推：[Customer Success 平台总览](https://www.gainsight.com/customer-success/)

---

## 三、12 范式 + demo 适配性

| # | 范式 | 鼻祖 / 标杆 | demo 适配 | SFA CRM 落地方式 |
|---|---|---|---|---|
| 1 | Activity Capture 自动化 | People.ai / Salesforce ACE / Gong / Clari | ❌ 不适配 | **重塑为 Activity Timeline**（FollowUp+KeyEvent+状态变更+AI 对话事件统一沉淀），不假装接外部渠道 |
| 2 | AI Agent 多体系拆分 | Salesforce Agentforce / HubSpot Breeze / Gong | ⚠️ 形似神不似 | **不装拆**，揭穿底层都是同 LLM+N 套 prompt+N 套工具白名单+N 个 UI 入口；SFA CRM 选择**统一主 Chat + 工具集 + 上下文渐进增强** |
| 3 | Health Score 双层 | Gainsight（鼻祖）/ Clari / Gong | ✅ 完美适配 | 客户级 5 维 Health（v1.0）+ KP 级关系健康（v1.3 可选） |
| 4 | Next Best Action / 跨客户 To-do | Salesforce Einstein NBA / HubSpot Guided Selling / Gong Tasker | ✅ 完美适配 | 跨客户 To-do 聚合 + NBA 推荐引擎（v1.2） |
| 5 | Tracker / Topic 抽象 | Gong（独门） | ✅ 完美适配 | Tracker 配置后台 + AI 自动命中（v1.1） |
| 6 | 风险预警 + 自动 Cadence | Clari（独门）/ Gainsight | ✅ 完美适配 | 多信号融合风险引擎 + 周报"救火榜"（v1.3） |
| 7 | Sequences / 外联节奏 | Outreach / Salesloft / HubSpot | ⚠️ 部分适配 | **模板配置 + 单步演示**（demo 30min 重置无法演示长生命周期），不做 7 天 nurture（v1.4） |
| 8 | Mutual Action Plan | Outreach（独门 2026 强化） | ✅ 适配 | readonly 客户共享视图 + 分享链接（v1.4） |
| 9 | Audit Cards | HubSpot Breeze 2026 创新（独门） | ✅ 完美适配 | 升级现有 chat_audit 表为可视化 Audit Card 时间线（v1.3） |
| 10 | AI-first 数据模型 | Attio（独门哲学） | ⚠️ 适合讨论不适合演示 | 写硬观点 + 代码层小重构示意（v1.5） |
| 11 | AI 在工作流原地出现 | Microsoft Copilot for Sales | ❌ 不适配 | **完全砍**，作为"刻意不做"硬观点素材 |
| 12 | Headless / MCP / Apps SDK | Attio MCP + Apps SDK | ✅ 完美适配 | MCP Server 化 + Lead/Customer 360 readonly REST（v1.5） |

**适配统计**：完美适配 6 + 部分适配/重塑 4 + 不适配 2。**6 + 4 已经够撑 6 版攻势，2 个不适配反而成就"刻意不做"硬观点。**

---

## 四、SFA CRM 当前能力 vs 12 范式 差距矩阵

✅ **已有**：单 Chat Copilot / HITL 边界 / 9 工具（4 读 + 5 navigate）/ Mobile 主入口 / RBAC + DataScope / Lead/Customer/FollowUp/KeyEvent/Report / 自动释放 / 多 LLM 厂商 / chat_audit / 限流熔断 / prompt_guard

❌ **缺（且应该补）**：Activity Timeline 聚合 / Health Score / Tracker / NBA / 跨客户 To-do / 风险预警 / Sequences / Mutual Action Plan / Audit Cards 可视化 / Skill 注册中心 / MCP

❌ **缺（但刻意不补）**：邮件/日历/通话外部集成 / Outlook/Teams 嵌入 / 真发邮件 / 企微钉钉集成 / 完整 7 天 sequences / 假装拆 Agent

---

## 五、关键术语澄清

- **Activity Timeline** = 客户/商机详情页按时间倒序的"互动流"。**不是**"自动捕获"，是已有数据统一沉淀。
- **Next Best Action（NBA）** = 系统主动告诉销售"下一步最该做什么"。词源 Salesforce Einstein NBA。
- **跨客户 To-do** = 所有客户的待办拉成一个全局清单，销售不用一个个翻。词源 Gong Engage / HubSpot Guided Selling。
- **Health Score** = 客户/商机 0-100 健康度分，多维信号融合。Gainsight 鼻祖。
- **Tracker** = 跟进/对话里追踪某个语义主题（如"竞品出现"），命中即标 tag。Gong 独门。
- **Mutual Action Plan** = 客户与销售共享的推进计划页。Outreach 独门。
- **Audit Cards** = 每次 AI 动作的可审计时间戳卡片。HubSpot 2026 独门。
- **Skill 注册中心** = 业务人员配 Prompt+SQL 模板成 Skill，AI 对话按需挂载调用。

---

## 六、"业务侧 / 架构侧"在每版里的关系

**一个版本里同时做两件事**（不是两件事各写一篇文章）：

- **业务侧**：销售/经理直接看得见用得上的产品功能（Activity Timeline / Health 分 / Tracker / Sequences / Mutual Plan）。对应路径 1 叙事，给杨老师写"CRM 业务该变了"硬观点提供产品依据。
- **架构侧**：底层架构能力。**注意：本路线图不再用"拆 Agent" 作为架构主线**，改为"统一 Chat + 工具集 + 上下文 + Skill + Audit + MCP" 的渐进增强。每版架构侧给杨老师写"ToB AI 架构应该长什么样"硬观点提供产品依据。

每版两路同时滋养，因为双心智（"现代 CRM 专家" + "vibe coding 达人"）需要并行喂料。

---

## 七、6+1 版本参考路线图（非顺序承诺，仅作参考）

> ⚠️ **本节是参考用**，不是必须按 v1.0 → v1.6 顺序执行的清单。
>
> 用户后续会自己学习理解每个范式的业务价值，按当下需要逐场景迭代实现。本表的作用是：当某天想做某个范式时，可以查到"它在 SFA CRM 里大概长什么样、对应哪几个文章选题、属于业务侧还是架构侧"。

| 版本 | 主题攻势 | 业务侧（路径 1） | 架构侧（路径 2，无 Agent 拆分版） | 杨老师硬观点（1 篇） | 克劳蛋系列选题（3-4 篇） | 时长估算 |
|---|---|---|---|---|---|---|
| **v1.0** | 行为驱动雏形 + 主 Chat 上下文增强 | **Activity Timeline**（FollowUp+KeyEvent+状态变更+AI 对话事件统一沉淀到客户详情页时间流）+ **5 维 Health Score**（互动频次 / 关键事件命中 / 最近活动距今 / 对话深度 / KP 触达） | 主 Chat 工具集扩展：新增 `get_activity_timeline` + `get_health_score` 两个工具；System prompt 升级让 Copilot 主动引用 timeline 和 health 上下文 | 「为什么传统 CRM 的 stage 字段是个谎言：从阶段驱动到行为驱动」 | • CRM 从被动记录变主动播报<br>• Health 5 维不是玄学：怎么设计的<br>• 调研 11 家 CRM 后我们刻意不做的 6 件事<br>• 杨老师批我第一稿太轻：12 范式怎么过 demo 适配性这关 | 1.5 月 |
| **v1.1** | Tracker 体系 + Skill 自助层 | **Tracker 配置后台**（管理员定义"竞品/价格/异议/承诺/KP 触达"等 tracker 规则，FollowUp/AI 对话命中后自动标 tag）+ 客户详情 Tracker 时间线 | **Skill 注册中心**：业务人员可视化配 SQL/Prompt 模板成 Skill，主 Chat 按需挂载调用——这是"不拆 Agent" 之后路径 2 的最大杠杆 | 「ToB AI 真正的杠杆不是大模型，是把'写规则'还给业务人员」 | • Tracker 上线：CRM 第一次听懂"对方提了竞品"<br>• Skill 自助：管理员不再求工程师改 prompt<br>• 能力下放的边界在哪<br>• Gong Tracker 哲学被中国市场低估了 | 1.5 月 |
| **v1.2** | 跨客户 To-do + NBA + 推理链可解释 | **跨客户 To-do 聚合视图**（首页 + Mobile chat 主入口看到"今天该联系谁"）+ **NBA 推荐引擎**（基于 Health + Tracker + KeyEvent 推荐"该约二访""该寄书""该报价"等具体动作） | 主 Chat **推理链可解释**：每条 NBA 推荐展示"AI 为什么这么建议"（哪个工具调用 + 哪些数据点 + 哪条规则触发）；新增 `nba_recommend` 工具 + 推理日志展示组件 | 「Next Best Action：销售管理从'盯过程'到'指动作'的范式转移」 | • To-do 聚合让人不再问今天干啥<br>• NBA 推荐引擎怎么算<br>• AI 推理链可解释：克劳蛋告诉你它为什么这么想<br>• Salesforce NBA 的中国本土化困境 | 1-1.5 月 |
| **v1.3** | 风险预警 + Audit Cards | **Customer 级风险信号引擎**（多 tracker 命中负面 / 30 天没动 / KP 失联 / Health 暴跌 → 风险等级 + 解释）+ 周报"本周需要救火的 N 个客户" | **Audit Cards**：升级 chat_audit 表为可视化 Audit Card 时间线（每次 AI 动作 / navigate / 推荐都生成时间戳卡，含调用工具 / 用了哪些数据 / 输出影响哪些字段），借鉴 HubSpot Breeze 2026 创新；主 Chat 在登录时主动 push 风险摘要 | 「Pipeline × 概率的 Forecast 已经过时——活动信号才是真预测；ToB AI 必须有审计身份证」 | • 危险客户雷达：克劳蛋开始主动报警<br>• Audit Cards：AI 不能再当甩手掌柜<br>• 学 HubSpot 2026 把每次 AI 动作变可审计<br>• Clari 风险预警的"自动触发 corrective workflow" 怎么本土化 | 1-1.5 月 |
| **v1.4** | Sequences 模板 + Mutual Action Plan + 多场景调用 | **FollowUp Sequences**（3 步触达 / 7 天 nurture / 失联唤醒模板，按 Health 自动推荐；只演示模板配置 + 单步触发，不演示长生命周期）+ **Mutual Action Plan**（仿 Outreach，readonly 客户共享视图 + 分享链接 + 含里程碑 + 双方任务） | 主 Chat **多场景调用入口**：在跟进编辑器旁加"问 AI 怎么写"按钮（自动带上下文调出主 Chat 起草），在 Mutual Plan 编辑页加"AI 帮我列里程碑"。叙事**不是拆 Composer Agent**，是同一个 Copilot 在更多场景出现 | 「外联自动化的下一阶段：从'我催客户'到'与客户一起推进'」 | • Sequences 上线：克劳蛋排好下周联系谁<br>• Mutual Action Plan：让甲方也参与 deal 推进<br>• 在跟进编辑器调出 Copilot 起草<br>• 我们为什么不做完整 7 天 sequences | 1.5 月 |
| **v1.5** | Headless / MCP 化 + AI-first Schema 反思 | Lead/Customer 360 readonly REST 接口标准化 + 字段语义文档化 + 简单 BI 接入示例 | **MCP Server 化**：把 SFA CRM 核心能力暴露成 MCP，Claude Desktop / 任何 MCP client 可直挂 SFA CRM 操作；借鉴 Attio "AI-first schema" 哲学讨论 Ontology 重构 | 「MCP 之后每个 ToB 产品都是 AI 工具集 + AI-first 数据模型该长什么样」 | • SFA CRM 长出 MCP 触手<br>• Headless 360：CRM 下一站不是 BI 是 Agent<br>• Attio 启示：AI-first schema 难在哪<br>• 把 SFA CRM 改成 MCP 服务器一周记 | 1.5 月 |
| **v1.6（可选）** | 多模态跟进 + Mobile 深度 | Mobile **语音转 FollowUp**（demo 端语音转文字 → AI 自动抽 tag 命中 Tracker）+ Mobile 主 Chat 优化（一键触发 sequence、To-do 滑动操作） | 跟进多模态化：语音 → 文字 → 结构化 → tracker 自动命中流水线；移动端 Audit Cards 适配 | 「移动端是 ToB AI 真正未被开拓的疆域」 | • 跟进可以说话了<br>• 移动 To-do 怎么不挤占视野<br>• Microsoft Copilot for Sales 的"工作流原地出现"对中国意味着什么 | 1.5 月 |

**版本节奏共识**：
- 顺序不预承诺，按当下兴趣 / 热点 / 反馈动态选取，可中途切换
- 每版收尾以"硬观点 1 篇 + 克劳蛋系列 ≥2 篇"为完成标志
- HITL 边界一以贯之
- Mobile + PC 双形态在所有版本同步交付

---

## 八、刻意不做的 6 个范式

| # | 范式 | 不做原因 | 替代方案 |
|---|---|---|---|
| 1 | **Activity 自动捕获**（接 Outlook/Gmail/钉钉/企微） | demo 没有外部生产环境，硬做就是表演；行业最佳实践（People.ai / Salesforce ACE）需要企业部署 + 安全合规审批，不是 demo 形态 | Activity Timeline：已有数据统一沉淀 |
| 2 | **AI Agent 拆分编排**（伪装成 Briefer/Tasker/Composer 多 Agent） | 行业大厂（Salesforce Agentforce、HubSpot Breeze）表面是多 Agent，**底层都是同 LLM + N 套 prompt + N 套工具白名单 + N 个 UI 入口**。SFA CRM 选择不装拆，揭穿这个把戏 | 统一主 Chat + 工具集 + 上下文 + 多场景调用入口的渐进增强 |
| 3 | **AI 在 Outlook/Teams 原地出现** | demo 没有 Microsoft Graph / Slack API 对接环境；中国用户也不用 Outlook/Teams | Web + Mobile 主入口做到极致 |
| 4 | **完整长生命周期 Sequences**（7 天 nurture / 30 天 cadence） | demo 数据每 30 分钟重置，长生命周期演示不出来 | Sequences 模板配置 + 单步演示 |
| 5 | **真实邮件/短信外发** | demo 不能群发邮件给真实地址；HITL 边界（spec 002）禁止 AI 直接执行写动作 | AI Composer 起草 + navigate 到表单让用户复制 |
| 6 | **企微 / 钉钉 / Salesforce 集成** | 商业封闭 API、需要企业认证、demo 走不通；且与"心智锚定"无关 | 通用 Web 入口 + Mobile + MCP（v1.5） |

**这一节本身就是杨老师硬观点文章素材**：「我们刻意不做的 6 个 CRM 范式 —— 边界感是 demo 的尊严，也是产品定位的底线」。区别于"我能做但选择不做"和"我做不到嘴硬说不做"，前者有尊严后者没有。这一节锚定的是**杨堃的产品判断力**，不只是技术能力。

---

## 九、来源 URL 列表

### 9.1 抓取成功源（WebFetch 命中）

- [Gong - Get started with configuring Gong](https://help.gong.io/docs/get-started-with-configuring-gong)（用户最初提供）
- [Gong - 帮助文档首页](https://help.gong.io/docs)
- [Gong - 产品页 6 大模块](https://www.gong.io/product/)
- [Gong - Understanding AI Agents](https://help.gong.io/docs/understanding-ai-agents)
- [Gong - Why use Gong Engage](https://help.gong.io/docs/why-use-gong-engage)
- [Gong - Plans and seats](https://help.gong.io/v1/docs/plans-and-seats)
- [HubSpot - Sales Hub 产品页](https://www.hubspot.com/products/sales)
- [Clari - Products 全景](https://www.clari.com/products/)
- [Attio - 主站](https://attio.com/)
- [Apollo - Product 页](https://www.apollo.io/product)
- [Outreach - Platform 页（已 rebrand 到 outreach.ai）](https://www.outreach.ai/platform)
- [Gainsight - Customer Success 平台](https://www.gainsight.com/customer-success/)

### 9.2 抓取失败但通过 WebSearch 补齐的源

Salesforce Agentforce（403 反爬）→ 通过 WebSearch 命中：
- [Trailhead - Discover Agentforce Sales Agents](https://trailhead.salesforce.com/content/learn/modules/agentforce-sales-agents-quick-look/discover-agentforce-sales-agents)
- [Salesforce - Einstein SDR 与 Sales Coach 发布](https://www.salesforce.com/news/stories/einstein-sales-agents-announcement/)
- [Salesforce Help - Sales Coach release notes](https://help.salesforce.com/s/articleView?id=release-notes.rn_sales_agents_coach.htm)

HubSpot Breeze（产品总览页 404）→ 通过 WebSearch 命中：
- [HubSpot - Breeze AI Agents 产品页](https://www.hubspot.com/products/artificial-intelligence/breeze-ai-agents)
- [HubSpot - 官方 understand Breeze 文档](https://knowledge.hubspot.com/ai/understand-breeze)

People.ai（TLS 证书问题）→ 通过 WebSearch 命中：
- [People.ai - SalesAI 产品页](https://www.people.ai/product/sales-ai)
- [People.ai - SalesAI 发布稿](https://www.people.ai/news/people-ai-unveils-sales-ai)
- [People.ai - Activity Capture 原理博客](https://www.people.ai/blog/automated-sales-activity-capture-for-ai)
- [People.ai - SalesAI Platform](https://www.people.ai/product/salesai-platform)

Microsoft Copilot for Sales（404）→ 通过 WebSearch 命中：
- [Microsoft Learn - Sales agent introduction](https://learn.microsoft.com/en-us/microsoft-sales-copilot/introduction)
- [Microsoft Learn - 2026 release wave 1 features](https://learn.microsoft.com/en-us/copilot/release-plan/2026wave1/copilot-sales/)
- [Microsoft Learn - Functional overview of Sales agent](https://learn.microsoft.com/en-us/microsoft-sales-copilot/functional-overview)
- [Microsoft Learn - Planned features](https://learn.microsoft.com/en-us/copilot/release-plan/2026wave1/copilot-sales/planned-features)

### 9.3 抓取失败的源（仅作记录）

- Salesforce Sales Cloud (403) - https://www.salesforce.com/sales/
- HubSpot Breeze 总览页 (404) - https://www.hubspot.com/products/breeze
- Microsoft Copilot for Sales 入口页 (404) - https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-for-sales

---

**文档生成日期**：2026-05-05
**生成会话**：基于杨老师与 Claude 关于"参考 Gong 给 SFA CRM 设计 AI Native CRM 演进路线"的多轮讨论
**对话过程中用户的 3 次驳回**塑造了本文档最终形态：

1. 第一稿仅参考 Gong → 用户要求扩展到 6+ 家深度调研
2. 第二稿调研 11 家但范式直接搬 → 用户要求加 demo 适配性筛选
3. 拆 AI Agent 叙事 → 用户判断"我这就一个智能体"，要求改为统一 Chat 增强

最终决策：**6 个范式真做 + 4 个范式部分做/重塑 + 6 个范式刻意不做**，全部以 demo 形态为约束。
