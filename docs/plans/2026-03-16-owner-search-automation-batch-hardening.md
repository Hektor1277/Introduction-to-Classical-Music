# Owner Search, Automation, And Batch Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复搜索分页、弹窗居中、人物/作品自动检查、候选应用、重复条目合并与批量导入链路中的关键可用性问题。

**Architecture:** 以现有 owner 前后端分层为基础，优先补齐 `packages/automation` 与 `apps/owner` 的回归测试，再修正 server 数据写入与 web 交互渲染逻辑。搜索页在 `apps/site` 独立实现分页；owner 侧问题按“前端渲染 -> 交互请求 -> 服务端持久化”链路逐段验证，避免只修 UI 症状。

**Tech Stack:** Astro, Express, vanilla JavaScript, TypeScript, Vitest, Playwright MCP

---

### Task 1: Search Result Pagination

**Files:**
- Modify: `apps/site/src/pages/search.astro`
- Test: `tests/unit/site-content.test.ts`

**Steps:**
1. 为“有查询词”和“无查询词”分别写失败测试，锁定展示条数与分页文案。
2. 实现按类型分页：无查询时保留示例条数，有查询时展示完整结果分页。
3. 运行相关单测并手动验证搜索页。

### Task 2: Owner Dialog Centering

**Files:**
- Modify: `apps/owner/web/styles.css`
- Modify: `apps/owner/web/index.html`
- Test: `tests/unit/owner-ui.test.ts`

**Steps:**
1. 增加针对弹窗结构/样式类名的失败测试。
2. 修正 dialog/backdrop/card 布局，使弹窗在视口中水平和垂直居中。
3. 用浏览器实际打开确认删除弹窗、预览弹窗、文本弹窗都居中。

### Task 3: Work Auto-Check Data And Rendering

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/web/review-utils.js`
- Test: `tests/unit/automation.test.ts`
- Test: `tests/unit/owner-review-utils.test.ts`

**Steps:**
1. 先写失败测试，覆盖作品候选必须包含作曲家与作品号、自动检查不能把“无新增”误判为成功。
2. 追踪作品自动检查输入、抓取结果、候选构造与前端展示，找出字段丢失与 no-op 根因。
3. 修正候选构造和 UI 文案，确保搜索结果卡片、自动检查面板、候选审查面板都显示完整关键信息。
4. 运行自动检查相关测试。

### Task 4: Proposal Apply/Discard Integrity

**Files:**
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `packages/automation/src/automation.ts`
- Test: `tests/unit/automation.test.ts`
- Test: `tests/unit/owner-ui.test.ts`

**Steps:**
1. 写失败测试，复现“直接应用/应用全部候选后未写入数据”和“应用/放弃后候选未移除”。
2. 检查按钮事件绑定、请求 payload、服务端 apply/ignore 路径与数据持久化。
3. 修复后让前端在成功后即时移除对应候选，并刷新详情/列表状态。
4. 运行相关测试，并在浏览器中验证单条与批量候选操作。

### Task 5: Manual Entity Merge

**Files:**
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `packages/data-core/src/*`（按实际需要）
- Test: `tests/unit/owner-tools.test.ts`
- Test: `tests/unit/library-schema.test.ts`

**Steps:**
1. 先写失败测试定义“主条目保留已填字段、补齐缺失字段、迁移别名/引用”的合并规则。
2. 实现后端 merge API 与前端手动选择流程。
3. 确保被合并条目的关系引用、索引、链接都迁移到主条目。
4. 验证合并后搜索与详情均只指向主条目。

### Task 6: Batch Import Parsing And Layout

**Files:**
- Modify: `packages/automation/src/batch-import.ts`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/web/ui-helpers.js`
- Modify: `apps/owner/web/styles.css`
- Test: `tests/unit/batch-import.test.ts`
- Test: `tests/unit/owner-ui.test.ts`

**Steps:**
1. 写失败测试覆盖文本规范化、缺字段容错、曲目下拉展示文案、批量分析成功生成草稿。
2. 追踪批量导入分析路径，定位“分析失败”和 UI 溢出的根因。
3. 加入输入规范化/预览逻辑，并优化 composer/work 选择区与预览布局。
4. 运行批量导入测试并在 owner 中手动验证。

### Task 7: Final Verification

**Files:**
- Verify only

**Steps:**
1. 运行聚焦单测。
2. 运行 `npm run runtime:build` 与 `npm test -- --runInBand`。
3. 使用浏览器复查搜索页、弹窗、作品自动检查、候选应用、批量导入。
