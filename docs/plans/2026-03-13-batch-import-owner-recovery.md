# Batch Import And Owner Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 恢复 `batch-import.ts` 的可编译与可用状态，并修复 owner 工具中批量导入布局、新建条目入口和关键按钮交互。

**Architecture:** 先以测试和构建错误为准重建 `src/lib/batch-import.ts`，保持既有导出接口不变；再用 owner 前端已有状态模型调整批量预览与详情布局，并修正“新建”按钮的创建态切换；最后用针对性测试和 runtime 构建验证所有关键路径。

**Tech Stack:** TypeScript, Vitest, Astro, Express, owner plain JS UI

---

### Task 1: 锁定 batch-import 回归面

**Files:**
- Modify: `tests/batch-import.test.ts`
- Test: `tests/batch-import.test.ts`

**Step 1: Write the failing test**

补充测试覆盖：
- `loadOrchestraAbbreviationMap(...)` 读取文本文件
- `cloneBatchDraftEntities(...)` 深拷贝

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/batch-import.test.ts`

Expected:
- 先因 `src/lib/batch-import.ts` 语法损坏失败

**Step 3: Write minimal implementation**

在 `src/lib/batch-import.ts` 重建：
- 类型定义
- 缩写表解析/加载
- 批量草稿分析
- confirmed 依赖闭包选择
- 深拷贝工具

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/batch-import.test.ts`

Expected:
- `tests/batch-import.test.ts` 全绿

### Task 2: 锁定 owner 批量预览与“新建”交互

**Files:**
- Create: `tests/owner-ui.test.ts`
- Modify: `owner/app.js`
- Modify: `owner/index.html`
- Modify: `owner/styles.css`

**Step 1: Write the failing test**

增加测试覆盖：
- 批量预览 DOM 结构应为“上方预览列表 + 下方详情”
- `resetEntityForm(...)` 应清空 `existingId`、清空预览并重置创建态
- 搜索加载旧条目后点击“新建”，后续保存 payload 不应带旧 `id`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/owner-ui.test.ts`

Expected:
- 当前结构/状态不符合预期而失败

**Step 3: Write minimal implementation**

实现：
- 调整批量预览容器结构与样式
- 为条目点击和详情渲染保留现有状态流
- 重置表单时同步清理 `state.activeEntity`
- 确保新建态保存请求不携带旧条目上下文

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/owner-ui.test.ts`

Expected:
- 新增 UI 测试通过

### Task 3: owner 关键按钮回归

**Files:**
- Modify: `owner/app.js`
- Modify: `tests/owner-review-utils.test.ts`
- Modify: `tests/owner-assets.test.ts`

**Step 1: Write the failing test**

补一个轻量回归测试，至少覆盖：
- `setResult(...)` 在批量动作中不再把整段 session JSON 当主要反馈
- 批量列表点击后详情跟随切换

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/owner-ui.test.ts tests/owner-review-utils.test.ts tests/owner-assets.test.ts`

Expected:
- 新测试先失败

**Step 3: Write minimal implementation**

实现精简结果区反馈、列表选择态和详情同步逻辑。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/owner-ui.test.ts tests/owner-review-utils.test.ts tests/owner-assets.test.ts`

Expected:
- 相关测试全绿

### Task 4: 全量验证

**Files:**
- Modify: `src/lib/batch-import.ts`
- Modify: `owner/app.js`
- Modify: `owner/index.html`
- Modify: `owner/styles.css`

**Step 1: Run targeted verification**

Run:

```bash
npm test -- tests/batch-import.test.ts tests/articles.test.ts tests/automation-job.test.ts tests/recording-auto-check.test.ts tests/owner-ui.test.ts tests/owner-assets.test.ts tests/owner-review-utils.test.ts
```

Expected:
- 所有相关测试通过

**Step 2: Run build verification**

Run:

```bash
npm run runtime:build
```

Expected:
- TypeScript runtime build 通过

**Step 3: Run broader verification**

Run:

```bash
npm test
```

Expected:
- 无新增回归
