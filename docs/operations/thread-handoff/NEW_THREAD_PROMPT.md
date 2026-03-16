# 新线程启动提示词（可直接粘贴）

请先读取并吸收以下交接状态包，然后继续本项目开发：
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/manifest.json
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/project_context.md
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/progress.md
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/decisions.md
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/next_actions.md
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/risks_open_questions.md
- E:/Workspace/codex/Introduction to Classical Music/.codex-handoff/current/environment_bootstrap.md

执行要求：
1. 先完成 environment bootstrap（环境启动前检查），不要直接进入编码。
2. 不要沿用旧线程里已经过时的判断；`src/lib/batch-import.ts` 不再是当前第一阻塞项。
3. 当前第一优先级是继续 owner 工具真实浏览器联调，尤其是 proposal（候选）按钮、删除确认、页面预览、结构化链接编辑、批量导入详情与专栏编辑页。
4. 先跑：
   - `npm ci`
   - `npm run runtime:build`
   - `npm run owner`
5. 然后做定向验证：
   - `node --check owner/app.js`
   - `npm test -- --runInBand tests/owner-ui.test.ts tests/library-schema.test.ts tests/batch-import.test.ts tests/recording-auto-check.test.ts tests/automation-job.test.ts`
6. 回归顺序建议：
   - 搜索与详情
   - 当前条目自动检查
   - 候选审查
   - 批量更新
   - 专栏
7. 本仓库工作树很脏，绝对不要做破坏性 Git 操作，尤其不要 `reset --hard`。
