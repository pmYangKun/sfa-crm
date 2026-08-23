---
name: SFA CRM 移动端必须跟 PC 端完全一致（无割裂感）
description: SFA CRM 的体验者大多数从移动端进入，移动端任何功能缺失 = 那块功能等于白做。新功能上线必须 PC + Mobile 同时具备
type: feedback
---

SFA CRM 的演示场景里，**移动端不是 PC 端的简化版，是同一个产品的等价入口**。

## 核心规则

- 任何 PC 有的页面/功能/详情视图，移动端必须有等价路径
- "移动端暂不支持 X，请去 PC 端"这种文案 = **彻底返工**，不可交付
- 列表点击在移动端必须落到 `/m/...` 等价详情，不能甩到 PC 详情页（用户没有 PC 上下文，详情页 PC 布局窄屏看不了）

**Why（用户原话，2026-05-05）**：
- "你的移动端点击线索以后进不了详情页，这些基础功能需要优化具备一下"
- "因为大多数体验者估计都是通过移动端访问的"
- "你这个移动端不能看线索详情页的 MEDDICC 指标，这相当于这个案例白做了"
- "我觉得你的移动端功能至少应该跟 PC 端一致吧"
- "改得跟 PC 端完全一致吧，不要有任何的不一致或割裂感"

spec 003 MEDDICC 销售视角第一轮交付时我擅自把"移动端 lead 详情页 MEDDICC 仪表盘"列入 US4 deferred，认为只做 PC 就算交付。用户反馈极强烈——演示链路在移动端根本走不通。

## How to apply

**新功能上线前的自检清单**：
1. 这个功能 PC 能用，移动端能不能等价用？（不是"能凑合看"，是真等价）
2. PC 列表页的 `<Link href="/foo/{id}">` 在移动端会跳到哪里？（默认会去 PC 路由 → 错）
3. 移动端 chat 的动作卡（ChatFormCard / MobileFormSheet）是不是显示"暂不支持"？（任何"暂不支持"都是 bug）
4. 详情页的 grid/table 在 390px 宽下能不能看？（用 `repeat(auto-fit, minmax(150px, 1fr))` 而不是固定 3 列）

**实现模式（已沉淀到代码里）**：
- PC 列表组件用 `usePathname()` 检测 `/m/` 前缀 → Link href 自动加 `/m/` 前缀，单一组件双端渲染
- `/m/(mobile-app)/{资源}/[id]/page.tsx` 直接 `import` PC 详情组件 + 外层 mobile padding
- `parse-nav-url.ts` 里所有 hash（followup/keyevent/actions/no-hash）都要有 submit 块或 navigate-only 路径，不留"unsupported"分支
- 列表页移动端模式渲染卡片（公司名 + 状态徽章 + 简要 metadata 横排）替代横滚表格

**回归测试**：spec 003 后建立 `mobile-meddicc-cases-regression.spec.ts` 配 `pc-meddicc-cases-regression.spec.ts`，移动端对等覆盖。今后任何 SFA CRM 新增功能默认要补 PC + Mobile 双套 e2e。

**触发场景**：用户提"移动端"、"统一"、"对等"、"割裂"、"体验"——大概率涉及这条规则，主动检查。
