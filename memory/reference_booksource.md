---
name: 原始书籍文献路径
description: 两本书和PRD模板的PDF原文路径，含图片，是生成skill的权威来源
type: reference
---

原始文献存放在 `D:\BaiduSyncdisk\Doc.Work\Writing\知识星球\AI资料\skills backup\booksource\`：

- `决胜B端第二版.pdf` — 《决胜B端》第二版全文，含图表
- `决胜体验设计v1.5.pdf` — 《决胜体验设计》v1.5全文，含图表
- `决胜B端PRD模板v2.0.pdf` — 《决胜B端PRD模板v2.0》，含结构规范

**使用说明：**
- 生成/更新 check-prd skill 时，优先读取这里的 PDF（图文完整）
- 不要再用 book1_full.txt / book2_full.txt（仅文字，图片丢失）
- 直接读取，不要再询问用户文件路径
