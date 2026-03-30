# 大型 VibeCoding 真人秀：用 AI 从零构建 SFA CRM

> 《决胜B端》作者杨堃老师，正在发起一场对传统软件工程的正面挑战。
> 这个 repo 是全程记录。欢迎见证——成功或翻车，都会完整保留。

---

## 这是什么

一个正在进行中的实验性工程项目，目标是：**基于 Spec Coding，从零构建一个 AI-Native 的 SFA CRM 产品**。

项目有四个核心野心：

- **没有 PRD**，全程基于结构化上下文（Spec）驱动，需求描述方式彻底改变
- **Palantir Ontology 方法论落地**，在系统底层对业务对象、对象关系、可执行动作进行显式建模，让 AI 真正理解结构化业务数据
- **所有界面 API 化**，每个操作都有对应接口，AI 可以直接控制界面，而不是靠模拟点击
- **Copilot 模式**，AI Agent 与人协同操控同一套系统，各司其职，真正的人机协作

工具栈：**VS Code + Claude Code**，日常编码用 Claude Sonnet 4.6，复杂任务切换 Claude Opus 4.6。

---

## Spec Coding 是什么

不写 PRD，用结构化的业务上下文（Spec）直接驱动系统设计和代码生成。

Spec 里有业务逻辑、对象定义、行为约束。AI 基于这些生成代码，出问题改 Spec 不改注释。Spec 是设计的唯一真实来源。

与此配合的还有 **Harness Engineering**：用 CLAUDE.md、Skill 文件、Memory 系统约束 AI 的行为边界，让它不跑偏。

---

## Repo 结构

```
├── articles/          # 系列文章，每集记录一次对话的过程和结论
│   ├── session-01.md  # 第一集：从两本书到第一批 Skill
│   ├── session-02.md  # 第二集：...
│   └── ...
├── spec/              # 业务上下文和系统设计规格文件
│   └── business-context.md   # 业务上下文 v0.1（甲方业务、组织、流程）
├── skills/            # Claude Code Skill 文件
│   └── check-prd/     # PRD 质量检查工具（独立子项目）
├── memory/            # Claude 跨会话记忆文件
└── CLAUDE.md          # Claude Code 项目配置
```

---

## 进度

| 集数 | 内容 | 状态 |
|------|------|------|
| 第一集 | 从两本书提炼方法论 Skill | 完成 |
| 第二集 | Skill 落地与迭代 | 完成 |
| 第三集 | check-prd 工具，解剖 8 份真实企业 PRD | 完成 |
| 第四集 | 业务上下文采集，确定架构方向 | 完成 |
| 第五集 | 安装 spec-kit，关于 Taste 的讨论 | 完成 |
| 第六集 | Ontology 设计（线索/客户/商机边界） | 进行中 |

---

## 配套公众号

每一集都有对应文章，由 Claude（克劳蛋）执笔，杨老师盖章。

文章存在 `articles/` 目录下，也会同步发布到杨老师的公众号**PM杨堃**。

---

## 关于「极有可能翻车」

这不是谦虚。Ontology 建模、API-first 架构、Copilot 协同——每一个单独拿出来都是重量级工程挑战，三个叠在一起没有人知道会发生什么。

如果翻了，复盘也会完整记录在这里。
