# `specs/` 目录约定

本目录是 spec-kit 的工作空间。所有"想清楚再写代码"的功能增量都在这里有一个独立子目录。

---

## 一、目录结构

```text
specs/
├── README.md                          ← 本文件（目录约定）
│
├── master/                            ← 第一版（项目从 0 到 1 的完整规格）
│   ├── inputs/                          原始材料：项目立项时的业务理解
│   │   ├── business-context.md
│   │   ├── ontology.md
│   │   └── specifications.md
│   ├── spec.md                          业务规格（最终版）
│   ├── plan.md                          实现计划
│   ├── data-model.md                    数据模型
│   ├── research.md                      技术调研
│   ├── contracts/                       接口契约
│   ├── quickstart.md                    启动指南
│   └── tasks.md                         任务清单
│
├── 001-login-mobile-onboarding/       ← 增量 feature 1
│   ├── inputs/                          原始材料：和 stakeholder 对齐的业务决策
│   │   └── alignment.md
│   ├── spec.md
│   ├── plan.md
│   ├── research.md
│   ├── data-model.md
│   ├── contracts/
│   ├── quickstart.md
│   ├── tasks.md
│   └── checklists/                      自检清单
│
└── 00X-...                            ← 后续增量 feature
    └── inputs/...
```

---

## 二、命名规则

### 2.1 Feature 子目录

- **第一版**用 `master/`（已建立，不再变）
- **后续增量**用 `NNN-<short-kebab-name>/` 形式，由 spec-kit 的 `create-new-feature.ps1` 脚本**自动**生成：
  - 编号自动递增（sequential 模式，见 `.specify/init-options.json`）
  - kebab-name 由脚本根据 feature 描述自动归纳（也可用 `-ShortName` 参数覆盖）
- 一个 feature 子目录 = 一个 git 分支（脚本自动 `git checkout -b NNN-...`）

### 2.2 `inputs/` 子目录（每个 feature 自己的）

- 存放本 feature **跑 spec-kit 之前**的原始材料：
  - 和 stakeholder 对齐的决策文档
  - 业务背景说明
  - 早期讨论笔记
  - 任何"非 spec-kit 标准产物"但对理解 feature 必要的材料
- 文件名自由，但建议常见命名：
  - `alignment.md`（最常见：和 PM/stakeholder 对齐的业务决策定稿）
  - `business-context.md`（业务背景）
  - `ontology.md`、`specifications.md`（早期产品/数据设计稿）

### 2.3 spec-kit 标准产物

由 `/speckit.specify` / `/speckit.plan` / `/speckit.tasks` 等命令产出，**不要手改命名**：
- `spec.md` / `plan.md` / `research.md` / `data-model.md` / `quickstart.md` / `tasks.md`
- `contracts/`（子目录）
- `checklists/`（子目录）

---

## 三、工作流

### 3.1 一个新 feature 的完整生命周期

```text
1. 业务对齐
   → 和 PM/stakeholder 用对话方式定清楚业务边界
   → 把决策落定到一份对齐文档（暂时放任意位置或自己起草）

2. 创建 feature
   → 跑 .specify/scripts/powershell/create-new-feature.ps1 -ShortName "xxx" "feature 描述"
   → 自动生成 specs/NNN-xxx/ + 切到新 git 分支

3. 归档对齐文档
   → 把对齐文档挪到 specs/NNN-xxx/inputs/alignment.md

4. 跑 spec-kit 流水线
   → /speckit.specify → 生成 spec.md
   → /speckit.plan    → 生成 plan.md + research.md + data-model.md + contracts/ + quickstart.md
   → /speckit.tasks   → 生成 tasks.md
   → /speckit.implement → 写代码

5. 完成 → 合回主分支
   → git merge NNN-xxx 到 main
```

### 3.2 哪些改动需要走 spec-kit？

不要按"动了几个文件"判断，按**改动的不确定性**判断。三档心智：

#### 档位 1：直接改（≈ 80% 的日常改动）

一句话指令，AI 改完看效果。**不写任何文档**。

- 改文案 / emoji / 颜色 / 字号 / 间距
- 改一个页面的布局或样式（描述目标 → AI 改 → 不行再调）
- 修一个不涉及业务规则的小 bug

#### 档位 2：先对齐再改（≈ 10-15% 中等改动）

先用对话方式聊清楚需求，AI 给一段任务说明，你点头再写。**不开 spec 文件夹**。

- 改一个页面的交互逻辑（涉及数据流 / 状态）
- 改多个相关页面里的同一类东西（如所有列表页加筛选）
- 修触及业务规则的 bug

#### 档位 3：走 spec-kit（≈ 5-10% 真正的功能增量）

走完整 `create-new-feature` + `/specify` + `/plan` + `/tasks` + `/implement` 流程，开 `specs/NNN-xxx/` 整套文档。

- 全新独立功能 / 跨端的系统行为
- 大重构 / 架构调整
- 跨前后端 / 影响数据模型 / 改业务规则的功能增量
- 多件事打包的版本（如本仓库的 `001-login-mobile-onboarding`：登录页 + 移动端 + Onboarding 三件事打包）

#### 为什么这样划分

走一次完整 spec-kit 流程成本约 **半天**（业务对齐 + 写 spec/plan/tasks）。如果改动本身 5 分钟能搞定，走 spec-kit 是大炮打蚊子。

**spec-kit 的价值在于约束 AI 不漂移、防止改完发现方向错了**——这两个风险只在改动复杂时才存在。

#### 一句话口诀

> **想清楚就直接说。说不清楚就先聊。聊完还说不清楚就走 spec-kit。**

---

## 四、为什么要 `inputs/` 这个子目录？

spec-kit 标准产物（spec.md / plan.md / tasks.md）是"**Claude 已经想清楚的最终结论**"。

但每次任务的**原始材料**（和你对齐的过程性决策、业务背景、外部约束）也需要归档：
- 几个月后回头查 "为什么 001 feature 要做 chat 内嵌卡片"，看 `001-.../inputs/alignment.md` 一目了然
- 新人接手项目，按 `inputs/` → `spec.md` → `tasks.md` 顺序读，能完整理解一个 feature 的"前因后果"
- 避免对齐文档散落在 chat 历史 / 飞书 / 微信里找不到

**约定**：每个 spec-kit feature 都应有 `inputs/` 子目录（哪怕只放一份 README 说明"本 feature 没有额外原始材料，决策直接对话定的"）。
