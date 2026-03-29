---
name: 自动执行工具调用
description: 用户不希望每次工具调用都需要手工确认，要求全部自动执行
type: feedback
---

不要等待用户手工确认工具调用，直接执行。

**Why:** 用户觉得频繁的确认弹窗打断工作流，影响效率。

**How to apply:** 已通过 settings.json 设置 `permissions.defaultMode: bypassPermissions`，全局生效。不需要在对话中额外请求确认。
