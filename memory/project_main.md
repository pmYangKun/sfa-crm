---
name: Main Project — 书籍方法论→Spec→SFA CRM
description: 核心合作项目：将两本书的方法论提炼为spec/skill，并用其构建SFA CRM验证落地
type: project
---

**项目目标：** 将《决胜B端》《决胜体验设计》的方法论转化为可执行的AI spec/skill，再用这些spec构建SFA CRM系统，验证方法论的落地价值。

**Why:** 验证"设计方法论→AI可执行规范→复杂系统落地"这条链路是否可行。若成功可开放给读者使用，并作为两本书最有力的实践背书。

**三个阶段：**
1. 书籍解读 → 提炼方法论 → 转化为spec/skill ✅ 已完成（2026-03-26）
2. 验证Skill实用性 → 用SFA CRM场景逐个跑一遍四个Skill，迭代优化
3. Spec Coding构建SFA CRM → 用Skill+Spec驱动AI完整构建系统，融入Agent/Chat能力

**How to apply:** Skill 阶段（check-prd 等）的决策追溯书中方法论；CRM 构建阶段完全依赖 AI/工程最佳实践，不强绑书中框架。

---

## 第一阶段完成情况（2026-03-26）

### 已创建的四个 Skill
文件位置：`C:\Users\YK\.claude\skills\`（同步备份：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\`）

| Skill | 文件 | 核心来源 | 用途 |
|-------|------|---------|------|
| `/b2b-research` | b2b-research.md | Book1 Ch.4 + Book2 Ch.2-3 | 双轨调研引导（业务+用户） |
| `/b2b-positioning` | b2b-positioning.md | Book1 Ch.5 + Book2 Ch.5 | 产品定位与子系统划分 |
| `/b2b-architecture` | b2b-architecture.md | Book1 Ch.5-6 + Book2 Ch.5 | 架构设计（模块/权限/蓝图） |
| `/check-prd` | check-prd.md | Book1 Ch.6 | PRD八维度质量检查 |

### 两本书的融合结论
- 《决胜B端》= 业务视角（战略/战术/执行三层框架、功能架构、数据建模）
- 《决胜体验设计》= 用户视角（画像/场景/旅程、信息架构、子系统设计）
- 两书互补，合并后形成完整的四阶段B端设计框架

### 重要设计决策
- 设计思路立足传统软件工程B端实践，不涉及纯AI原生产品设计（方法论尚未成熟）
- SFA CRM构建阶段会探索融入Agent能力和Chat交互形态，但以传统设计为地基

### 已发布内容
- 第一篇项目记录文章：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\articles\session-01.md`
  - 记录了完整的思考过程和对话脉络，用于微信公众号发布
- 第二篇项目记录文章：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\articles\session-02.md`
  - 复盘第二天工作，客观分析双方失误，已于2026-03-28发布至微信公众号

---

---

## 第二次会话（2026-03-27）

### Skill架构大调整
- 将原8个独立skill文件（4个b2b-*生成类 + 4个check-*检查类）合并为**1个 check-prd.md**
- 原因：用户指出多文件对读者不友好，目的单一就是检查PRD，不需要理解8个文件的关系
- 合并时第一版内容被过度压缩（1800+行→245行），丢失了大量细节，后来用Opus重新生成

### 最终 Skill 状态
- 唯一文件：`check-prd.md`（828行，13个检查维度 + 6个附录）
- 来源：Opus模型深度阅读《决胜B端》《决胜体验设计》《决胜B端PRD模板v2.0》三个文档生成
- 内容：13维度覆盖从业务调研到AI功能设计的完整PRD检查体系

### 解决的技术问题
- settings.local.json 覆盖全局 bypassPermissions 导致工具调用仍需手动确认
  → 修复：local文件也加 bypassPermissions，并在 allow 数组加通配符 Bash/Read/Write/Edit/Glob/Grep

### 书籍源文件位置（已提取为txt备用）
- `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\bak\book1_full.txt`（《决胜B端》，5442段）
- `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\bak\book2_full.txt`（《决胜体验设计》，3155段）
- `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\bak\prd_template.txt`（PRD模板，357段）

---

## 第三次会话（2026-03-28）— check-prd skill 重建与验证

### Skill 架构再次重建（层级化）
- 原因：单文件828行太大，Opus也会控制输出长度，细节被压缩
- 方案：1个主编排文件 + 13个子维度文件 + 2个附录文件，共15个文件
- 来源：直接读取三个PDF（含图表），比txt更完整
- 文件位置：`C:\Users\YK\.claude\skills\`（13个 check-prd-XX.md + 2个 appendix）
- 总行数：1905行

### Skill 调用方式修复
- 问题1：`~/.claude/skills/*.md` 的平铺文件不被识别，需要是目录结构
- 修复：创建 `C:\Users\YK\.claude\skills\check-prd\SKILL.md` 目录+入口文件
- 问题2：SKILL.md 缺少 frontmatter（name/description），导致"no matching command"
- 修复：加入 `---\nname: check-prd\ndescription: ...\n---` frontmatter
- 同步到：`C:\Users\YK\.claude\commands\check-prd.md`
- **现状：`/check-prd` 命令已可正常调用** ✅

### 三份真实PRD验证结果
文件位置：`C:\Users\YK\Desktop\A\prd\`

| PRD | 总分 | 否决项 | 成熟度 |
|-----|------|--------|--------|
| 城市经理人考核PRD v1.4 | 34分 | 4项（定位/流程/ER图/权限） | 需重大修订 |
| 贷款知心MRD | 32分 | 6项（含金融合规缺失） | 需重大修订 |
| 客户加V-CRM底层 MRD | 46分 | 2项（定位/ER图） | 需重大修订 |

- 三份共同缺陷：**ER图、产品定位声明、角色权限矩阵**
- 用户待讨论：有多个想法，饭后沟通

### 关于 skill 效果的关键结论
- 纯LLM分析 ≠ skill驱动分析
- Skill价值在于：强制13维度结构覆盖 + 书中具名框架（业务调研三层框架、五环节法等）+ 权重评分体系 + 一票否决机制
- 本次验证是真正调用 `/check-prd` 后读取15个子文件完成的，是有效验证

---

## 第四次会话（2026-03-29）— session-03.md 公众号文章写作与迭代

### 本次工作内容
- 以"克劳蛋"AI身份写作第三篇公众号文章 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\articles\session-03.md`
- 文章定位：`check-prd` Skill 介绍 + 8份真实PRD验证案例 + 两个深度讨论话题

### 文章最终结构
1. 固定系列介绍块（大型VibeCoding真人秀）
2. 两个讨论话题：PRD会消亡吗？Skill最佳实践会被LLM偷师吗？
3. check-prd 工具介绍（17文件层级架构、产品定型机制、14维度表格、8个风险项）
4. 如何使用（Claude Code Skill + 通用Prompt两种方式）
5. 真实验证：从8份中选2个典型案例
   - 案例一：金融知识库MRD，6个风险项，产品类型定性错误导致系统性缺失
   - 案例二：CRM客户管理模块，展示《决胜体验设计》组件级交互分析（38字段表单、弹窗vs抽屉）
6. 数字总结（100%角色权限矩阵缺失等）
7. 后记 + 下期预告（Spec Coding设计阶段）

### 写作过程中的关键决策
- check-prd 定位为"旅途中产出的工具"，而非项目终点，CRM才是主线
- 删除了第三个讨论话题（Spec Coding背景），直接过渡到工具介绍
- 添加了案例四（现案例二）专门展示《决胜体验设计》的UI分析价值
- 14个检查维度从详细描述压缩为一个表格
- 安装说明从Mac/Windows分块压缩为一个bash代码块
- 8个案例压缩到2个典型案例展示

### check-prd Skill 最终状态（更新）
- 文件结构：17个文件（1主编排 + 14维度 + 2附录）
- 已在8份真实企业PRD上完整验证
- GitHub地址：`github.com/pmyangkun/check-prd-skill`（预备发布）
- 支持两种使用方式：Claude Code Skill（推荐）+ 通用Prompt单文件

---

## 第五次会话（2026-03-29下午）— check-prd Skill 仓库规范化

### Skill 仓库最终状态
- 本地路径：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\check-prd\`（完整 git 仓库，已连接 GitHub）
- GitHub：`https://github.com/pmYangKun/check-prd-skill`
- 合并了贡献者 Scofy0123 的 PR #1，主要改动：
  - 新入口：`SKILL.md`（替代原 `check-prd.md`）
  - 维度文件移入 `references/dimensions/`，附录移入 `references/appendices/`
  - 新增 `scripts/build.py`（生成 universal prompt）、`validate.py`、安装脚本
  - `dist/check-prd-universal-prompt.md` 已生成

### 工作流
1. 修改：直接编辑 `skills/check-prd/` 下的文件
2. 备份：改动前备份到 `D:\BaiduSyncdisk\Doc.Work\Writing\知识星球\AI资料\skills backup\` 目录下
3. 测试：跑安装脚本 `.\install.ps1` 同步到 `~/.claude/skills/`，测试 `/check-prd`
4. 发布：`git push` 到 GitHub，无需手工同步

---

## 第六次会话（2026-03-29晚）— 系统方向确定 + 需求采集 + session-04文章

### 方向确定（三次纠偏）
1. check-prd反向构建需求 → 否定：check-prd是验收框架不是采集框架
2. 传统SFA + Gong.io叠加 → 简化：通话语义分析用API+Claude解决，不自建
3. 传统SFA作底座 → 否定：Ontology和表格+外键是两种哲学，直接从Ontology建

### 确定架构
- 第一层：Ontology数据底座（对象/关系/动作显式建模）
- 第二层：API-first GUI（人和Agent共用同一套操作层）
- 第三层：Copilot协同（后续叠通话语义分析）
- 方法论：Spec Coding + Harness Engineering，不写PRD

### 业务上下文（已采集完整）
甲方：企业家培训公司，小课2万+大课20万，销售200人全国。
组织：VP→5大区总→战队队长→一线销售，提成阶梯递减（存在拆单风险）。
线索：多渠道进线→手动分配→私有池（上限100）→超时释放→公共池（各大区规则不同，需可配置）。
关键约束：客户唯一性校验、公共池防刷、送书事件结构化记录、日报自动生成。
周边系统：课时订单/上课管理/OA/飞书，均无系统级集成。
首要目标：客户资源准确管理与智能分配，最大化转化率。

### 已发布文章
- session-04.md：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\articles\session-04.md`
  记录三次纠偏过程、三层架构科普、需求采集精彩片段（送书洞察/商机阶段拆解/拆单风险/按键精灵/日报重复录入）

---

---

## 第七次会话（2026-03-29）— spec-kit 引入与工作方式讨论

### 主要工作
- 项目文件夹从 `D:\MyProgramming\claudecode\SFACRM\` 迁移至 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\`，所有路径引用已更新
- 初始化 git 仓库，推送到 GitHub 私有仓库：`https://github.com/pmYangKun/sfa-crm`
- 安装 spec-kit（v0.4.3），完成 constitution 编写（中文，六条核心原则）
- 书籍原始PDF迁移至 `D:\BaiduSyncdisk\Doc.Work\Writing\知识星球\AI资料\skills backup\booksource\`

### 关键判断（spec-kit 使用时机）
- spec-kit 是**执行框架**，不是思考框架——假设你已想清楚，帮你结构化并约束AI实现
- 正确介入时机：业务讨论全部完成后，编码开始前
- 当前仍处于业务讨论阶段，spec-kit 暂不介入

### 已发布文章
- session-05.md（原 session-06）：Ontology 设计文章（已重新编号）

---

---

## 第八次会话（2026-03-30）— Ontology 设计完成 + session-06 文章

### 主要工作
- GitHub 仓库从私有改为公开：`https://github.com/pmYangKun/sfa-crm`
- 添加 README.md，面向公开访问者说明项目背景和进度
- 完成 Ontology v0.5 设计，文件：`spec/ontology-v0.1.md`
- 完成 session-06 文章，主题：Ontology 探讨与 AI-native CRM

### Ontology 关键决策
- 线索和客户不是两个对象，是**企业（Company）的两个阶段**（stage 字段）
- 企业是归属核心主体（B2B，对公付款），联系人挂在企业下
- 联系人关系（ContactRelation）用于记录跨企业人脉，事后补录 + 微信/手机号自动预警
- 关键事件（KeyEvent）独立于跟进记录，结构化记录送书/小课/大课等业务节点
- 组织结构用 **OrgNode 树**，不写死层级，支持任意深度扩展
- Action 层显式声明：主体、前提、效果——这是 Ontology 区别于纯 ER 建模的核心
- 数据可见性：sales→自己名下，manager→子树，admin→全部

### 重要讨论结论
- Ontology 本质 = ER + 显式业务操作层（Action），营销吹过头但价值真实存在
- API 颗粒度合理性才是真正难点，语义/命名是次要问题（杨老师观点）
- AI-native CRM 的底层仍需结构化数据，演进的是输入层（从人填→AI提取+人确认）
- Spec-First 的价值：在代价最低的时刻（spec 阶段）做正确决定，上线后改组织结构代价极高

---

## 第九次会话（2026-03-30）— Spec 阶段完成 + 重大设计决策

### 主要工作
- 完成功能规格文件：`spec/specifications.md`（12个SPEC + 菜单结构 + 视图规范）
- Ontology 重大更新：线索/客户拆分为独立对象，RBAC 体系完整建模
- 文章 session-07 完成，主题：Spec 阶段设计决策与 AI 需要人定基调

### 重大设计决策变更

#### 线索（Lead）与客户（Customer）拆分
- **原设计**：同一 Company 对象，stage 字段区分
- **新设计**：两个独立对象，Lead 有状态（active/converted/lost），Customer **无状态**
- **核心理由**：客户与业务逻辑解绑——买了什么课从课时订单系统实时查，CRM 不存状态。未来出新产品不会因客户状态耦合而混乱
- 转化时：Lead 归档，创建 Customer，联系人/跟进/关键事件全部迁移
- 大课转化窗口改为派生逻辑，不写入客户字段

#### RBAC 权限体系
- **原设计**：User 上固定 role 枚举（sales/manager/admin）
- **新设计**：Role（独立对象）+ Permission（权限点）+ UserRole（用户-角色关联）+ RolePermission（角色-权限关联）
- 内置角色：销售、战队队长、大区总、销售VP、督导、系统管理员
- 支持自定义角色，一人多角色，权限取并集

#### 数据权限与功能权限分离
- 功能权限：Role + Permission，控制能做什么
- 数据权限：UserDataScope，独立配置，五种控制符：`self_only / current_node / current_and_below / selected_nodes / all`
- 两个维度完全解耦，督导等特殊角色可配 `all` 数据范围 + 只读功能权限

### 菜单结构（已确认）
- 销售：我的线索 / 公共线索库 / 我的客户 / 我的日报
- 主管：数据概览 / 团队线索 / 公共线索库 / 团队客户 / 团队日报
- Admin：全部线索 / 全部客户 / 组织管理 / 用户管理 / 权限管理 / 系统配置 / 操作日志

### 列表页视图规范（已确认）
预设默认列 + 用户可显示/隐藏列、调整列顺序、保存常用筛选条件。不支持自定义字段，不支持跨对象拼接。

### Spec 文件目录（当前状态）
`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\spec\`
- `business-context.md` ✅
- `ontology.md` ✅（已去除版本号后缀）
- `specifications.md` ✅（SPEC-001～014，含菜单结构和视图规范）

### 当前状态与下一步
#### 已完成
- ✅ Spec 阶段全部完成
- ✅ 文章 session-01～07 均已完成

---

## 第十次会话（2026-03-30）— 技术栈确定 + session-08 文章

### 技术栈最终确定

**基础层：**
- 前端：Next.js
- 后端：FastAPI（Python）
- 数据库：SQLite（演示用）
- 部署：Docker Compose + 腾讯云轻量服务器

**AI Agent 层：**
- LLM 交互：Vercel AI SDK（多 Provider，抹平各家 API 差异）
- LLM Provider：数据库配置，Admin 后台可切换（Claude/GPT/DeepSeek 等）
- 工具调用：Ontology Actions → tool definitions（SDK 原生 Tool Use）
- Skill 系统：DB 存储，工具调用检索，Admin 维护，本质是提示词文本
- 对话记忆：DB 存每轮 messages

**界面控制：** 新建系统直接 GUI API 化，不需要 Computer Use 或 DOM 解析

**Agent 工作模式：** 用户主动问（chat 触发）+ 系统主动推（事件触发）两种

### 关键技术讨论结论

- **AI 控制界面五种方式**：CLI / DOM（OpenClaw 用 CDP） / Computer Use / GUI API / DSL，进化线清晰
- **老系统 AI 操控障碍**：业务语义隐式化——前端藏业务逻辑（GUI API 化解决）+ 后端代码藏业务规则（Ontology Action 化解决）
- **不用 Dify 的理由**：Dify 是平台不是组件，深度集成自有 Ontology 时黑盒难调试；Dify 的每项能力都有颗粒度更低的开源组件替代
- **Skill 本质**：提示词文本，不是 Claude 专属，LLM 可替换后 Skill 完全有效
- **Skill 两种用法**：用户主动问 vs 系统事件触发（Gong.io 模式）

### 已完成文章
- session-07-技术栈.md：`articles/session-07-技术栈.md`
  主题：AI 控制界面五种方式、老系统改造障碍、技术栈选型、Agent 架构、Skill 系统

### 当前状态与下一步
#### 已完成
- ✅ 技术栈确定
- ✅ 文章 session-01～07 均已完成（原 session-05 已删除，后续重新编号）

#### 下一步
- 🔜 **Plan 阶段**：生成整体架构、模块划分、开发顺序，进入编码

---

## 第十一次会话（2026-03-31）— spec-kit 全流程完成 + 流程复盘 + session-08 文章

### 主要工作
- 更新 constitution.md 至 v1.1.0（新增技术栈约束 + AI Agent 层约束）
- 执行 /speckit.plan：生成 plan.md / research.md / data-model.md / contracts/api-contracts.md / quickstart.md
- 执行 /speckit.tasks：生成 tasks.md（110个任务，14个 Phase）
- 复盘 spec-kit 使用流程，修正三个偏差
- 归档原始 spec 文件到 spec/archive/，specs/master/spec.md 成为唯一真相源
- 更新 plan.md 宪法校验，补充 Phase 1 复查（对照 v1.1.0）
- 完成 session-08 文章，主题：Spec Coding 正确打开方式与 spec-kit 定位

### spec-kit 产出文件（specs/master/）
- `spec.md` ✅ 业务规格（唯一真相源）
- `plan.md` ✅ 实现计划（宪法 v1.1.0 两次校验均通过）
- `research.md` ✅ 技术调研（5项决策）
- `data-model.md` ✅ 数据模型（15张表 + 索引 + 状态机）
- `contracts/api-contracts.md` ✅ API 接口契约
- `quickstart.md` ✅ 启动指南
- `tasks.md` ✅ 110个任务，14个 Phase

### 流程复盘三个偏差
1. **constitution 时机错误**：应先更新 constitution → 再跑 plan，我们先跑了 plan 再补更新，事后补了校验
2. **spec.md 孤岛**：原始文件（ontology/specifications/business-context）和 spec.md 并存，已修正：原始文件归档，spec.md 唯一真相源
3. **research.md 是确认结论而非调研**：技术选型在文章讨论阶段已确定，research 只是文档化，非问题但需知晓

### spec-kit 协作分工（已确定）
- 杨老师：业务判断、需求决策、方向确认（自然语言对话）
- Claude：翻译成设计决策，更新文档，执行编码
- 增量设计：先对话 → 判断是否影响 constitution → 局部更新文档 → 追加任务 → 编码

### 文章文件（当前最终状态）

文件名规则：`session-{编号}-{主题}.md`，均在 `articles/` 目录下。

| 文件名 | 主题 |
|--------|------|
| session-01-skill提炼.md | 从书到方法论 Skill |
| session-02-skill迭代.md | Skill 落地与迭代 |
| session-03-check-prd.md | check-prd 工具与 PRD 验证 |
| session-04-需求采集.md | 业务上下文采集与架构方向 |
| session-05-ontology.md | Ontology 设计 |
| session-06-老登反击.md | Spec 阶段：线索客户拆分、RBAC、数据权限分离 |
| session-07-技术栈.md | 技术栈与 AI Agent 架构 |
| session-08-speccoding.md | Spec Coding 正确打开方式与 spec-kit 定位 |

### 当前状态
- ✅ 所有设计文档完成，编码可以开始
- ✅ 全部 8 篇文章已完成，文件名已加主题词
- 🔜 **下一步**：从 T001 开始，Phase 1 项目初始化

---

## 第十二次会话（2026-03-31）— Phase 1+2+3 编码完成

### 主要工作
- 代码全部放入 `src/` 子目录（src/backend, src/frontend, src/docker-compose.yml），保持根目录整洁
- 完成 Phase 1 初始化：T001-T006（pyproject.toml、package.json、docker-compose、Dockerfile、ruff、tsconfig/eslint）
- 完成 Phase 2 基础设施：T007-T025（数据库、ORM 模型、RBAC、JWT 认证、FastAPI 主应用、前端 API 封装）
- 完成 Phase 3 US1：T026-T036（Lead/Contact 模型、唯一性服务、Leads API、前端三页）

### 代码目录结构
```
src/
  backend/
    app/
      api/auth.py, leads.py
      core/config.py, database.py, auth.py, deps.py, init_db.py
      models/org.py, auth.py, config.py, audit.py, lead.py, contact.py
      services/permission_service.py, audit_service.py, uniqueness_service.py, lead_service.py
      main.py
    pyproject.toml, Dockerfile, .ruff.toml
  frontend/
    src/
      app/layout.tsx, globals.css
      app/login/page.tsx
      app/leads/page.tsx, new/page.tsx, [id]/page.tsx
      lib/api.ts, auth-context.tsx
      types/index.ts
    package.json, tsconfig.json, Dockerfile
  docker-compose.yml
```

### 关键实现细节
- SQLite WAL+foreign_keys+busy_timeout=5000+synchronous=NORMAL（T007）
- OrgNode adjacency list（remote_side 配置）+ in-memory BFS for DataScope（T008, T017）
- UserDataScope 五种 scope（self_only/current_node/current_and_below/selected_nodes/all）
- rapidfuzz token_sort_ratio 85 分阈值，剥离法律后缀后比较（T029）
- Lead 录入：201 正常 / 202 模糊预警（已创建）/ 409 代码冲突阻断（T030）
- require_permission() 依赖注入方式：`Depends(require_permission("lead:create"))`

### commit 记录（本 session，共 19 次）
- Phase 1: T001~T006 各自独立 commit
- Phase 2: T007~T021 后端各自独立 commit，T022~T025 前端打包一次 commit + 登录页单独 commit
- Phase 3: T026-T028 / T029 / T030-T032 / T033 / T034-T036 各自独立 commit

### 当前状态
- ✅ Phase 1+2+3 已全部完成并提交
- ✅ 工作区干净（git status clean）

---

## 第十三次会话（2026-04-01）— Phase 4 编码完成

### 主要工作（T037-T046，共 6 次 commit）
- T037: `services/rate_limiter.py` — 按用户ID限速（从JWT解析，非IP）
- T038+T040+T042+T043: `lead_service.py` 新增 assign/claim/release Actions + 大区规则引擎
  - `_check_private_pool_limit`：读 SystemConfig `private_pool_limit`，超限抛 ValueError
  - `_get_user_region`：向上遍历 OrgNode 树找 type=="region" 的节点名
  - `assign_lead`：校验受让人私有池容量，转移 owner_id + pool="private"
  - `claim_lead`：校验 pool/stage/region规则/私有池，单事务 SELECT+UPDATE 防并发双抢
  - `release_lead`：active 私有池线索 → pool="public"，owner_id=None
  - `_check_region_claim_rules`：支持三种模式（any/same_region_only/priority）
- T039+T041+T044: `api/leads.py` 新增接口
  - `POST /leads/{id}/assign`（需 lead:assign 权限）
  - `POST /leads/{id}/claim`（SlowAPI callable 方式动态读 DB 限速）
  - `POST /leads/{id}/release`（需 lead:release 权限 + 数据权限校验）
  - `POST /leads/{id}/mark-lost`（需 lead:mark_lost 权限）
- T045: `frontend/src/app/public-pool/page.tsx` — 公共线索库（含抢占按钮）
- T046: `frontend/src/app/leads/team/page.tsx` — 团队线索（主管视图，含分配弹窗）

### 关键实现细节
- SlowAPI 动态限速：`@user_limiter.limit(callable)` 在请求时读 SystemConfig `claim_rate_limit`
- 并发保护：SQLite WAL + 单事务内 get+update，无需显式锁
- 大区规则 priority 模式：以 lead.created_at 为基准计算优先窗口（简化实现）
- user_limiter 通过 `user_limiter.app = app` 挂载到 FastAPI 实例

### 当前状态
- ✅ Phase 1+2+3+4 已全部完成并提交
- ✅ 工作区干净（git status clean）
- ✅ Phase 4 完成（T037-T046，线索分配/抢占/释放/标丢失）

---

## 第十三次会话（2026-04-01）— Phase 4+5+6 编码完成

### Phase 4（T037-T046）
- rate_limiter.py（用户ID限速）、assign/claim/release Actions + 大区规则引擎
- 四个 API 接口：assign/claim/release/mark-lost
- 前端：公共线索库页面（抢占）+ 团队线索页面（主管分配弹窗）

### Phase 5（T047-T049）
- T047: `release_service.py`：APScheduler 每日 02:00 运行，双规则（followup_release_days/conversion_release_days），释放时写 Notification 记录
- T048: `main.py` lifespan 注册 APScheduler + init_db + customers/webhooks 路由
- T049: `models/notification.py`（Notification 表）

### Phase 6（T050-T056）
- T050: `models/customer.py`（Customer 表，lead_id UNIQUE）
- T051: `convert_lead` Action：创建 Customer + 迁移 contacts（lead_id→customer_id）+ lead.stage="converted"
- T052: `POST /leads/{id}/convert`（手动兜底，权限+数据权限校验）
- T053: `POST /webhooks/order-payment`：unified_code优先 → 公司名精确匹配，幂等处理
- T054: `GET /customers` + `GET /customers/{id}`（含派生 days_since_conversion）
- T055: 前端客户列表页（转化天数颜色标记）
- T056: 前端客户详情页（基本信息 + 来源线索链接）

### 代码目录新增
```
src/backend/app/
  api/customers.py, webhooks.py
  models/customer.py, notification.py
  services/release_service.py
src/frontend/src/app/
  customers/page.tsx, [id]/page.tsx
```

### 当前状态
- ✅ Phase 1+2+3+4+5+6 已全部完成并提交
- ✅ 工作区干净
- 🔜 **下一步**：Phase 7（US6+US7 跟进记录 + 关键事件，T057-T066）
