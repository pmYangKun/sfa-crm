# Claude Code 项目配置

## 记忆系统路径

**重要：** 本项目的记忆文件存储在 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\memory\`，不使用 C 盘默认路径。

每次对话中：
- 读取记忆：从 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\memory\MEMORY.md` 和相关文件读取
- 写入记忆：写到 `d:\BaiduSyncdisk\Doc.Work\Programming\claudecode\SFACRM\memory\` 目录下
- **不要**读写 `C:\Users\YK\.claude\projects\` 下的任何路径

## 编码阶段提交规则

**每完成 tasks.md 里的一个任务，必须立即 commit，不允许跨任务积压未提交文件。**

- 每个 session 结束前，`git status` 必须是干净的工作区
- 写入关键文件后，用 Read 工具回读确认内容正确，再 commit
- 不得用"一次性提交所有改动"代替逐任务提交
