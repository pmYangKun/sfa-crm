---
name: 复杂任务用Opus模型
description: 深度阅读+综合生成类任务要用Opus，不要默认用Sonnet
type: feedback
---

深度阅读大量文档、综合理解后生成高质量内容的任务，必须使用Opus 4.6，不要用Sonnet。

**Why:** 今天用Sonnet合并书籍内容时生成质量不足，换Opus后质量显著提升。模型差异不只是速度，是推理深度和内容质量上限的差异。

**How to apply:** 任务开始前先评估难度——凡是需要"读大量资料+深度理解+生成长篇内容"的任务，直接用 `model: "opus"` 启动 Agent，不要等出了问题再换。日常对话、代码修改、文件读写用Sonnet即可。
