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
- session-05.md：`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\articles\session-05.md`
  主题：Spec Coding 与 Taste。记录 spec-kit 使用方式的纠偏、以及杨老师关于"人的价值/taste"的思考（taste是什么、如何构建、未来AI越来越强后人是否还需要taste）

---

## 当前状态与下一步（2026-03-29）

### 已完成
- ✅ check-prd Skill 已上GitHub，PR #1已合并，仓库规范化完成
- ✅ SFA CRM 业务上下文采集完整，存于 `spec/business-context.md`
- ✅ 系统架构方向确定：Ontology底座 + API-first GUI + Copilot协同
- ✅ spec-kit 已安装，constitution 已完成
- ✅ 文章 session-01～05 均已完成
- ✅ 项目已纳入 git 版本管理（私有仓库）

### 待办（下次继续）
- ⚠️ **skill install.ps1 还未运行**：PR合并后新目录结构（references/dimensions/）尚未同步到 `~/.claude/skills/`，需运行 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\skills\check-prd\install.ps1`
- 🔜 **业务概念讨论**：线索/客户/商机的边界与定义，转化时机
- 🔜 **Ontology建模**：定义核心业务对象，设计对象关系和状态机
- 🔜 **模块边界划分**
- 🔜 **进入 spec-kit specify 阶段**（待业务讨论完成后）

### Spec文件目录
`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\spec\`
- `business-context.md` ✅ 业务上下文 v0.1

### spec-kit 文件目录
`d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\.specify\`
- `memory/constitution.md` ✅ 项目宪法 v1.0.0
