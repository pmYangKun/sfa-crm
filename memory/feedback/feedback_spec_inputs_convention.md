---
name: 每个 Spec 版本的需求沟通文件归档约定
description: 每次围绕新 spec 版本的需求沟通材料统一放到该 spec 文件夹下的 inputs/ 子目录，与 spec.md/plan.md 等 spec-kit 产物分开
type: feedback
---

每次跟用户沟通具体需求、产出一个新的 spec 版本时，相关的需求讨论 / 业务对齐 / 上下文材料**统一放到该 spec 文件夹下的 `inputs/` 子目录**，与 spec.md / plan.md / data-model.md 等 spec-kit 产物分开。

**Why:** spec.md 是"想清楚后的最终规格"，inputs/ 是"想清楚之前的原始材料"——两者性质不同，混在一起后续溯源、复盘、发起新一版 spec 时找不到出处。`specs/README.md` 已经把这套目录约定文字化，记忆里再固化一份避免下次又漏迁。

**How to apply:**
- master 版（项目从 0 到 1 的完整规格）：原始材料放 `specs/master/inputs/`，含 business-context / ontology / specifications 等
- 后续 feature 增量（001 / 002 / ...）：每个 feature 都在自己目录下建 `inputs/`，如 `specs/001-login-mobile-onboarding/inputs/alignment.md`
- 业务讨论一旦产生独立的需求 / 对齐 / 上下文文档，**立即** `git mv` 或新增到对应 `inputs/`，不要让它先散落在 docs/、根目录、聊天记录里再"以后整理"
- 文件命名：用语义化名字（business-context.md / ontology.md / alignment.md / discovery.md），不带日期前缀
- 跟用户讨论新一版 spec 时，主动检查这版 spec 是否已建 `inputs/`、本次讨论产物是否需要落盘进去
