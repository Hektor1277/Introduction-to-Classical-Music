# Post-Normalization Regression Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复规范化重构后暴露出的网页端展示、owner 维护工具 UI、自动检查筛选与候选应用逻辑回归，并保持新结构下的实现一致性。

**Architecture:** 先以失败测试和浏览器复现锁定回归，再分别在 `packages/shared` 的展示模型、`apps/site` 的渲染组件、`apps/owner` 的前后端交互、`packages/automation` 的筛选与复核链路中做最小闭环修复。所有行为性修改都优先落到共享规则与可测试的 helper 上，避免再引入补丁式分叉逻辑。

**Tech Stack:** TypeScript, Astro, Express, Vitest, Playwright MCP, shared display/automation modules

---

### Task 1: 建立回归证据与失败测试清单

**Files:**
- Modify: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\display.test.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\site-content.test.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\owner-ui.test.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\automation.test.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\owner-review-utils.test.ts`

**Step 1: 为每日推荐展示顺序和字段裁剪补失败测试**

增加断言：
- 曲目标题优先显示在版本信息之前
- 每日推荐卡片仅显示曲目、作曲家、时间地点
- 不再重复输出指挥、独奏、乐团条目块

**Step 2: 为 owner 搜索结果卡片尺寸和角色选项补失败测试**

增加断言：
- 搜索结果项不使用固定压缩高度
- 新建人物时仍显示 `composer` 角色选项
- 关联条目块位于“合并到主条目”之前

**Step 3: 为候选审查与自动检查筛选规则补失败测试**

增加断言：
- `merge` 或疑似重复提案不会被批量应用
- 存在重复候选时批量应用会被阻止并给出可见反馈
- 限制作曲家后检查乐团不会返回无关人/重复候选
- 作曲家自动检查不会把短名回填到全名字段

**Step 4: 运行最小测试集合确认失败**

Run: `npm test -- tests/unit/display.test.ts tests/unit/site-content.test.ts tests/unit/owner-ui.test.ts tests/unit/automation.test.ts tests/unit/owner-review-utils.test.ts --runInBand`

Expected: 至少有与本轮回归点直接对应的失败断言。

### Task 2: 修复 site 每日推荐展示模型与组件

**Files:**
- Modify: `E:\Workspace\codex\Introduction to Classical Music\packages\shared\src\display.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\site\src\components\DailyRecommendations.astro`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\site\src\styles\global.css`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\display.test.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\site-content.test.ts`

**Step 1: 收紧 `buildRecordingDisplayModel` 的 daily 输出职责**

仅保留：
- `workPrimary`
- `workSecondary`
- `principalPrimary` 改为作曲家
- `principalSecondary` 改为作曲家外文名
- `datePlacePrimary`
- `datePlaceSecondary`

去掉 daily 卡片对指挥、独奏、乐团的重复展示依赖。

**Step 2: 调整 `DailyRecommendations.astro` 模板顺序**

渲染顺序改为：
1. 版本标题
2. 版本副标题
3. 曲目
4. 作曲家
5. 时间地点

并删除不再需要的 slot 渲染块。

**Step 3: 调整 daily card 样式**

为标题、副标题、曲目、作曲家、时间地点设置固定可视高度与溢出隐藏，避免不同卡片高度扰动。

**Step 4: 运行相关测试确认通过**

Run: `npm test -- tests/unit/display.test.ts tests/unit/site-content.test.ts --runInBand`

Expected: PASS

### Task 3: 修复 owner 搜索结果、角色栏与关联条目区块

**Files:**
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\app.js`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\index.html`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\styles.css`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\server\owner-app.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\owner-ui.test.ts`

**Step 1: 修复新建人物缺失 `composer` 角色**

统一 `fillComposerForm` 与 `fillPersonForm` 的角色默认逻辑，并确保“人物”tab 在新建态也显示作曲家勾选框。

**Step 2: 调整搜索结果卡片布局**

移除导致结果卡片被极度压缩的固定高度或滚动容器约束，让结果列表按内容高度增长，同时保留外层滚动。

**Step 3: 调整关联条目区块顺序**

让“关联条目”插入到“合并到主条目”之前。

**Step 4: 让关联条目下拉支持分组**

按实体类型输出不可选组标题：
- 作曲家
- 人物
- 团体
- 作品
- 版本

若当前实体是作曲家，作品分组标签中追加体裁分类信息。

**Step 5: 运行 owner UI 测试确认通过**

Run: `npm test -- tests/unit/owner-ui.test.ts --runInBand`

Expected: PASS

### Task 4: 修复候选审查应用逻辑与顶层固定布局

**Files:**
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\app.js`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\review-utils.js`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\web\styles.css`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\server\owner-app.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\packages\automation\src\automation.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\owner-review-utils.test.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\owner-ui.test.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\automation.test.ts`

**Step 1: 明确“不可直接应用”的提案集合**

将 `merge`、重复候选、缺失必要确认字段的提案统一视为 review-only。

**Step 2: 修复顶层“应用当前页/全部已确认候选”**

在前端预先过滤不可应用提案；若确认列表中存在不可应用项目，则阻止提交并提示用户先处理冲突。

**Step 3: 修复顶层 UI 固定与内容顶部对齐**

让：
- 顶层 tabs 固定在主卡片顶部
- 次级内容区使用 `align-content: start`
- 稀疏内容不再把 tabs 向下挤

**Step 4: 运行相关测试确认通过**

Run: `npm test -- tests/unit/owner-review-utils.test.ts tests/unit/owner-ui.test.ts tests/unit/automation.test.ts --runInBand`

Expected: PASS

### Task 5: 修复自动检查筛选、去重与低质量候选

**Files:**
- Modify: `E:\Workspace\codex\Introduction to Classical Music\packages\automation\src\automation-checks.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\packages\automation\src\automation-jobs.ts`
- Modify: `E:\Workspace\codex\Introduction to Classical Music\apps\owner\server\owner-app.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\automation.test.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\automation-job.test.ts`
- Test: `E:\Workspace\codex\Introduction to Classical Music\tests\unit\automation-quality-review.test.ts`

**Step 1: 收紧人物筛选**

当请求带有 `composerIds`、`workIds`、`conductorIds`、`orchestraIds` 等约束时，只允许返回与过滤条件直接关联的实体，禁止把全库 merge pool 混入当前结果。

**Step 2: 修复 merge 提案构建范围**

`buildMergeProposals` 仅针对本次筛选出的相关实体池构建，不再对整个类别全集构建。

**Step 3: 加强全名/短名回填规则**

对于作曲家、指挥、人物：
- `name` / `fullName` 必须优先选择规范全名
- 短名只能进入 `displayName` 或 alias
- 若候选值过短或与类型不符，则降权或拒绝

**Step 4: 增强复核**

对高风险字段回填增加规则校验：
- 重名/短名误填
- 百度样板句
- 角色与实体类型不符
- 过滤条件不匹配

**Step 5: 运行自动检查相关测试确认通过**

Run: `npm test -- tests/unit/automation.test.ts tests/unit/automation-job.test.ts tests/unit/automation-quality-review.test.ts --runInBand`

Expected: PASS

### Task 6: 浏览器回归与完整验证

**Files:**
- Verify only

**Step 1: 启动 owner 与 site**

Run:
- `npm run owner`
- `npm run dev`

**Step 2: 用 Playwright 复现并截图**

检查：
- 每日推荐卡片
- owner 搜索结果列表
- 新建人物的角色栏
- 关联条目分组与跳转
- 候选审查空态与顶层 tabs 固定

**Step 3: 运行完整验证**

Run:
- `npm test -- tests/unit/display.test.ts tests/unit/site-content.test.ts tests/unit/owner-ui.test.ts tests/unit/owner-review-utils.test.ts tests/unit\automation.test.ts tests/unit/automation-job.test.ts tests/unit/automation-quality-review.test.ts --runInBand`
- `npm run runtime:build`
- `npm run build`

Expected: 全部通过

**Step 4: 如有需要整理提交**

Run:
- `git status --short`
- `git add ...`
- `git commit -m "fix: close post-normalization regressions"`

