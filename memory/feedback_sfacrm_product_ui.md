---
name: SFA CRM 产品 UI 风格偏好（区别于 POC）
description: SFA CRM 是真实在线产品，登录/着陆页用现代 SaaS 风（Linear/Vercel），不是给客户 PPT 截图的 POC 色块卡片风
type: feedback
---

SFA CRM 是公网真实产品（pmYangKun/sfa-crm，给观众点开手机/PC 体验），不是给领导 PPT 截图的 POC，所以视觉规则跟 `feedback_poc_ui_design.md` 完全不同。

## 风格基调

- 现代 SaaS：Linear / Vercel / Stripe 风
- 浅 radial-gradient 背景（`#eef2ff` 渐到 `#fafbfc`）+ 大量留白
- 卡片：白底 + 1px `#e2e8f0` 浅边 + 8-12px 圆角 + 极淡阴影
- 主 CTA 用深色 `#0f172a` 实底按钮（不是品牌色）
- 角色卡顶部用 4px 品牌色 accent 条

**Why:** POC 色块+emoji 风对真实产品太业余、不专业。Linear/Vercel 风对开发者/产品圈观众有审美共鸣，能锚定"vibe coding 达人"心智。

## 布局硬性约束

- **底部对齐：** 多列布局（如左角色卡 + 右登录表单）必须底部对齐。用 `gridTemplateColumns: 'minmax(0,1fr) 380px'` + `alignItems: 'stretch'`，子项内部用 `flex` + `marginTop: 'auto'` 把 CTA 推到底
- **Hero 不能挤压右侧卡片：** 标题 + 描述要放进**左列内部**，不能横跨两列把右边登录表单顶到下方
- **移动端不浪费横向空间：** 角色卡 2 列并排（`repeat(2, minmax(0,1fr))`），不要竖排
- **顶部 logo 可以删：** 如果 logo 放在最顶部会让 Hero 标题跟右侧登录卡顶部对不齐，宁可去掉 logo

**Why:** 用户多次纠"卡片底下没对齐"、"账号登录被 Native AI 那行字顶到下面去了"、"右边大面积留白浪费"。视觉对齐对真实产品着陆页是底线，不是优化项。

**How to apply:**
- 用户说 SFA CRM 改 UI 时，默认按现代 SaaS 风改，不要套 POC 色块风
- 多列布局先想清楚高度策略（哪个撑高度、哪个跟随）
- 改完先 playwright 截图自查上下/左右对齐再交付，不要等用户红线框出来
- 移动端默认想"能不能并排放"，不要默认竖排

## 登录后 = 纯净 CRM 体验，外站链接只能进登录页

CRM 上线后会挂在 `crm.pmyangkun.com` 子域名下。外部 / 营销类链接（"返回个人主页"、"GitHub" 等）**只能放登录页底部**，不能放登录后 sidebar / "我的" / chat / dashboard 等任何位置。

**Why（用户原话，2026-05-06）**：
- "登录以后人家就是一个纯 CRM 演示环境了，不要把我的网站加进去，太恶心了"

登录后访客就是来玩 CRM 的，要营造"独立产品"的演示氛围。塞个人主页链接进去 = 把演示框打破、让访客分心、变成"老板的小广告"。

**How to apply：**
- 写需求"加个回主页的入口"时，**不要**默认放 sidebar / 我的 tab，先确认哪个页面
- 登录页的 footer / 着陆页底部 / login 注册的辅助文案是允许暴露站长身份的
- 登录后所有页面（sidebar / kingkong-tabbar / chat header / 我的 tab / dashboard footer 等）保持产品本身的纯粹性
