# Owner Tool Taskboard Review Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复维护工具任务看板、候选审查和自动检查成功判定的问题，并统一名称规范化与图片复查逻辑。

**Architecture:** 保持现有本地 owner tool 架构不变，在 `automation-jobs` 中加入并发执行与后置复查，在 `automation-checks` 与 `display` 中补名称规范和图片质量规则，在 `owner/app.js` 与 `owner/styles.css` 中重做任务看板与候选审查渲染。所有修改先以测试锁定行为，再做最小实现。

**Tech Stack:** Astro, TypeScript, Vitest, 本地 owner Web UI

---

### Task 1: 为任务并发与任务详情补失败测试

**Files:**
- Modify: `tests/automation-job.test.ts`
- Modify: `src/lib/automation-jobs.ts`

**Step 1: Write the failing test**

增加测试覆盖：
- 任务管理器会以大于 1 的并发数执行多个条目。
- job 记录中包含紧凑任务项摘要与单任务详情数据。
- 若复查失败，条目应计入 failed 而不是 succeeded。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/automation-job.test.ts`

**Step 3: Write minimal implementation**

在 `createAutomationJobManager` 中：
- 引入固定并发池。
- 为每个 selection item 记录 item-level status、summary、detail events。
- 加入完成后复查钩子与失败降级。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/automation-job.test.ts`

### Task 2: 为名称规范化与图片过滤补失败测试

**Files:**
- Modify: `tests/display.test.ts`
- Modify: `tests/automation.test.ts`
- Modify: `src/lib/display.ts`
- Modify: `src/lib/automation-checks.ts`

**Step 1: Write the failing test**

增加测试覆盖：
- 中文俗名存在时，中文全名不能为空且会补齐。
- 网站展示优先使用中文全名。
- 图片排序会排除或强烈降权百度 logo、站点 logo、明显占位图。
- 候选成功时必须满足最小字段完整性要求。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/display.test.ts tests/automation.test.ts`

**Step 3: Write minimal implementation**

在 `display.ts` 中补规范化辅助函数；在 `automation-checks.ts` 中加入：
- 字段完整性复查。
- 图片候选过滤与打分惩罚。
- 简称/缩写/俗名并入 aliases。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/display.test.ts tests/automation.test.ts`

### Task 3: 重做任务看板 UI

**Files:**
- Modify: `owner/app.js`
- Modify: `owner/styles.css`
- Modify: `owner/index.html`

**Step 1: Write the failing test**

用现有 Vitest 能力补纯函数级或 DOM 片段级测试，覆盖：
- 任务看板渲染为紧凑状态方块。
- 点击任务项能切换到单任务详情视图。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/owner-tools.test.ts`

**Step 3: Write minimal implementation**

在前端：
- 把事件流平铺改为任务格子总览。
- 新增当前任务详情面板，仅展示被点击的任务。
- 错误与事件按单任务折叠展示。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/owner-tools.test.ts`

### Task 4: 精简候选审查 UI

**Files:**
- Modify: `owner/app.js`
- Modify: `owner/styles.css`

**Step 1: Write the failing test**

补测试覆盖：
- 审查视图不直接输出长 URL 作为主文本。
- 核心字段 diff 以结构化分组显示。
- 新增值与修改值有明确高亮标识。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/owner-tools.test.ts`

**Step 3: Write minimal implementation**

在候选审查页中：
- 把来源降为紧凑 pills。
- 只展示关键字段和摘要。
- 图片候选放入紧凑网格并限制宽度。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/owner-tools.test.ts`

### Task 5: 全量验证

**Files:**
- No code changes expected

**Step 1: Run focused test suites**

Run: `npm test -- tests/automation-job.test.ts tests/automation.test.ts tests/display.test.ts tests/owner-tools.test.ts`

**Step 2: Run full test suite**

Run: `npm test`

**Step 3: Run runtime build**

Run: `npm run runtime:build`

**Step 4: Run production build**

Run: `npm run build`

**Step 5: Manual owner tool validation**

Run:
- `npm run owner`
- 实际发起一次 composer 自动检查
- 确认任务看板为紧凑方块、单任务详情可见、候选审查不再横向爆开、字段与图片复查结果生效
