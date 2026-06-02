# Memory Index

本项目记忆文件固定存放在 `D:\MyProgramming\cc\SFACRM\memory\`。读取项目上下文时先读本文件，再按索引读取相关文件；写入项目记忆时也写到本目录下，不使用 `C:\Users\YK\.claude\projects\` 下的任何路径。

- [Main Project](project_main.md) — 书籍方法论→Spec/Skill→SFA CRM，三阶段验证项目
- [Feedback: CRM构建不强绑方法论](feedback_crm_methodology.md) — SFA CRM构建完全依赖AI/工程最佳实践，不把书中方法论强行映射进来
- [Feedback: spec coding 用 Playwright 自我验证](feedback_playwright_self_verify.md) — 每个 user story / phase 完成后跑 Playwright e2e，确认通过再报告
- [Feedback: Spec inputs 归档约定](feedback_spec_inputs_convention.md) — 每个 spec 版本的需求沟通材料统一放到该 spec 文件夹下的 inputs/，与 spec-kit 产物分开

## 2026-05-19 从全局 memory 下沉过来的 4 条

- [Feedback: SFA CRM 产品 UI 偏好](feedback_sfacrm_product_ui.md) — 真实产品着陆页用现代 SaaS 风（Linear/Vercel），区别于 POC 色块风；底部对齐/移动端 2 列并排是硬约束
- [Feedback: SFA CRM 移动端必须跟 PC 完全一致](feedback_sfacrm_mobile_pc_parity.md) — 体验者大多移动端进入；任何"暂不支持移动端"=返工；新功能必须 PC+Mobile 同时具备 + 双套 e2e
- [Feedback: 回归测试必须走 Playwright 真实前端模拟](feedback_regression_via_playwright.md) — 用户说"回归测试/全量测试"=PC+Mobile Playwright 真模拟登录进 chat 验证非空回复；禁止只跑后端 TestClient/curl 就交付
- [Writing: SFA CRM 系列文章结构](writing_claudegg_sfacrm_series.md) — 系列专属：固定开场白、复盘节、下期预告
