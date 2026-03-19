# Owner/Search Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不破坏当前 1.0 稳定框架的前提下，优化站点搜索页与本地维护工具的展示、结构标签、自动检查表现和若干交互细节。

**Architecture:** 优先沿用现有搜索索引、owner 表单和自动检查链路，只修正显示标签、数据映射、候选渲染和 catalogue（作品号）提取策略。所有改动都配套单测和真实浏览器回归，避免“看似正确”的 UI 回归。

**Tech Stack:** Astro, Express, vanilla JS, Vitest, Playwright MCP

---

### Task 1: 仓库基线与回归范围确认

**Files:**
- Inspect: `apps/site/src/lib/search-panel.ts`
- Inspect: `packages/data-core/src/indexes.ts`
- Inspect: `apps/owner/server/owner-app.ts`
- Inspect: `apps/owner/web/app.js`
- Inspect: `apps/owner/web/ui-helpers.js`
- Inspect: `apps/owner/web/styles.css`

1. 核对本地 `main` 与 `origin/main` 是否一致。
2. 记录当前工作树已有脏改，避免误回滚。
3. 识别会受影响的搜索、owner UI、自动检查和 schema 入口。

### Task 2: 站点搜索结果展示与分页修复

**Files:**
- Modify: `packages/data-core/src/indexes.ts`
- Modify: `apps/site/src/lib/search-panel.ts`
- Modify: `apps/site/src/components/SearchPanel.astro`
- Test: `tests/unit/search-panel.test.ts`

1. 让作品搜索条目稳定展示“中文译名 - 英文/原名 - 作品号 - 作曲家”。
2. 避免 `workGroup` 作为顶层重复展示。
3. 修复翻页时残留前一页条目的问题。
4. 补分页和作品展示回归用例。

### Task 3: Owner 搜索结果标签与条目结构优化

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Modify: `packages/shared/src/display.ts`
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `apps/owner/web/index.html`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/web/ui-helpers.js`
- Test: `tests/unit/owner-ui.test.ts`

1. 将“作曲家”并入“人物”角色；新增“团体”详情页与搜索标签。
2. 调整人物/团体角色集合与生卒年文案。
3. 修复搜索结果使用别名代替主中文名的问题。
4. 让合并后搜索结果自动刷新。

### Task 4: Owner 合并、自动检查与下拉菜单 UI 优化

**Files:**
- Modify: `apps/owner/web/index.html`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/web/styles.css`
- Test: `tests/unit/owner-ui.test.ts`

1. 将合并控件收纳为安全下拉，默认“请选择”，无选择时禁用合并。
2. 切换条目或 tag 时重置合并状态。
3. 调整自动检查面板高度填充、滚动条位置、空白区与候选头部冗余信息。
4. 限制图片候选等下拉菜单宽度，避免溢出。
5. 固定各 tag 顶部按钮与内容的垂直间距。

### Task 5: 作品自动检查质量与版本条目作品展示优化

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `apps/owner/web/ui-helpers.js`
- Modify: `apps/owner/web/app.js`
- Test: `tests/unit/automation.test.ts`
- Test: `tests/unit/owner-ui.test.ts`

1. 修正 `catalogue` 提取优先级，避免把正文年份或错误编号写入作品号。
2. 为作品候选增加更严格的 composer/work/catalogue 一致性约束。
3. 优化版本条目中所属作品的展示顺序。

### Task 6: 闭环验证

**Files:**
- Verify only

1. 运行受影响单测。
2. 运行 `npm run runtime:build`。
3. 用真实浏览器复测搜索分页、合并条目、候选 UI、作品自动检查、下拉宽度和专栏顶部对齐。
4. 复核 `git status -sb`，确认本轮改动范围。
