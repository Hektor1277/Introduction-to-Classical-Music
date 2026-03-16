# 线程热切换入口（Thread Handoff Entry）

本目录是线程切换入口。完整状态包在：
- `.codex-handoff/current/`

请在新线程按顺序读取：
1. `.codex-handoff/current/manifest.json`
2. `.codex-handoff/current/project_context.md`
3. `.codex-handoff/current/progress.md`
4. `.codex-handoff/current/decisions.md`
5. `.codex-handoff/current/next_actions.md`
6. `.codex-handoff/current/risks_open_questions.md`
7. `.codex-handoff/current/environment_bootstrap.md`

本次切换的特殊提醒：
- 上一线程最后一步在“整体替换 `src/lib/batch-import.ts`”时被中断。
- 该文件当前是损坏状态，会直接导致 `npm run runtime:build` 失败。
- 新线程不要继续在坏文件上做零碎 patch，应优先整体重写该模块并恢复构建。

建议在新线程首条消息附上：
- “请先读取 `.codex-handoff/current`，完成 environment bootstrap，然后优先恢复 `src/lib/batch-import.ts`，再继续 owner 工具联调。”
