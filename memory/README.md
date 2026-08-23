# SFA CRM · AI 协作入口（先读这份）

> 项目的 AI 工作入口。每次开工**先读本文件**，再按需展开：当前状态 `current.md`、时间线 `log.md`、项目知识 `context/`、硬规则 `feedback/`。
>
> ⚠️ 根目录 `README.md` 是**给外部访客的 GitHub 门面**（快速体验 / 演示账号 / 技术栈），不是 AI 入口，两者别混。

---

## 一、项目一句话

杨堃用 ClaudeCode + Spec Coding，从零构建一个 AI-Native 的 SFA CRM，**全程公开记录**（公众号系列《大型 VibeCoding 真人秀：嘴喷CRM》+ 公开仓库）。项目同时是内容母体，用来构建"vibe coding 达人 + 现代 CRM 专家"双心智。

- 代码：`d:\MyProgramming\cc\SFACRM\`（GitHub `pmYangKun/sfa-crm`，公开，**主分支 master 不是 main**）
- 线上：https://crm.pmyangkun.com ｜ 开放平台 https://crm.pmyangkun.com/open

---

## 二、目录结构（对齐南方电网项目的 4 段架构）

```
SFACRM/
├── README.md      ← GitHub 公开门面（外部访客读）
├── src/           ← 代码
├── specs/         ← spec-kit 产物 + 各 spec 的 inputs/（需求沟通材料）
├── docs/          ← PRD、部署手册、演示案例
└── memory/        ← AI 工作运营层（你在这）
    ├── README.md      入口索引 + 更新规则（本文件）
    ├── current.md     当前在做什么 + 下一步          【高频变动】
    ├── log.md         时间线流水（倒序追加）          【只追加】
    ├── context/       沉淀的稳定结论                  【低频】
    │   ├── 项目知识.md   业务上下文 / 设计决策 / 部署约定
    │   └── 内容策略.md   心智构建 / 两条探索路径 / 文章主线 / 本体论结论
    └── feedback/      项目专属硬规则（动手前必读）    【低频】
```

**一个文件该放哪？两问：**
1. 它是"发生了一件事"还是"稳定的结论"？事 → `log.md`；结论 → `context/`
2. 它是"现在在做什么"还是"以后都得守的规矩"？在做 → `current.md`；规矩 → `feedback/`

> `memory/` 只装运营层三样：**当前状态 + 时间线 + 规矩**，外加 `context/` 里的项目知识。**不装代码说明、不装对外文案。**

---

## 三、更新规则（路由表 · 写东西前对一眼）

| 新内容类型 | 放哪 |
|---|---|
| **发生了一件事**（spec 收口 / 上线 / 修 bug / 踩坑） | `log.md` 顶部加一段（日期 + 做了什么 + 关键 commit/tag），**只记不堆原文** |
| 当前进度 / 下一步变了 | `current.md` |
| 沉淀出的稳定结论（设计决策 / 部署约定 / 业务上下文） | `context/项目知识.md`（**不是 log**） |
| 内容与文章相关的判断（心智 / 路径 / 已发文章状态 / 概念结论） | `context/内容策略.md` |
| 项目硬规则（UI 偏好 / 测试纪律 / 归档约定） | `feedback/feedback_*.md` 新建一条 |
| 新 spec 的需求沟通材料 | `specs/<spec>/inputs/`（见 `feedback/feedback_spec_inputs_convention.md`） |
| **跨项目**才复用的规矩 | 用户级 memory（`Kun's Work/../memory/`），**不放这里** |

> **纪律**：`log` 是流水（全量、按时间、可乱）；`context` 是沉淀（精炼、稳定、结论）。隔段 lint 一次——把 log 里沉淀够的提炼进 context，别让两者混。

---

## 四、动手前必读（按场景）

| 场景 | 必读 |
|---|---|
| 写克劳蛋系列文章 | **走 skill `create-claudegg-article`**（真的调 Skill 工具，不要 Read 代替）；文章状态见 `context/内容策略.md` |
| 改 UI / 加页面 | `feedback/feedback_sfacrm_product_ui.md` + `feedback/feedback_sfacrm_mobile_pc_parity.md`（**移动端必须跟 PC 同时具备**） |
| 说"回归测试 / 全量测试" | `feedback/feedback_regression_via_playwright.md`（PC + Mobile 真模拟，禁止只跑后端 TestClient 就交付） |
| 做完一个 user story / phase | `feedback/feedback_playwright_self_verify.md`（跑 e2e 确认通过再报告） |
| 开新 spec | `feedback/feedback_spec_inputs_convention.md` |
| 部署上线 | `context/项目知识.md` §发布部署约定 + `docs/deploy.md` + 用户级 `feedback_deploy_vocab.md`（增量 7 步 + 已知硬伤） |
| 讨论"要不要绑书里的方法论" | `feedback/feedback_crm_methodology.md`（**不强绑**） |

---

## 五、跟用户级 memory 的分工

- **用户级**（`Kun's Work` 同级的 `memory/`）：只放**跨项目复用**的规矩，和一条指向本项目的指针
- **本项目**（这里）：所有 SFA CRM 的执行细节、工程决策、内容判断

> 2026-08-20 重构：此前把大量 SFACRM 工程细节堆在用户级 `project_sfacrm_content.md`（spec 005 实测数据、本体论结论、每篇文章状态），已全部下沉到本目录。用户级只留指针。
