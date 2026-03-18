# Owner Search Type And Button Closure Plan

## Goal

闭环修复站点搜索分类、owner 条目类型展示、自动检查详情区冗余、候选按钮失效、批量导入确认创建失效、合并条目下拉可搜索与限高等问题，并通过单元测试、构建和 Playwright 真实交互回归验证。

## Constraints

- 不能只修 UI 表象，必须修复真实写回链路。
- 不能回滚用户已有工作树改动。
- 修改前先补失败测试，采用 test-driven development（测试驱动开发）。
- 结束前必须做真实浏览器交互验证，重点覆盖历史上持续失效的按钮。

## Workstreams

### 1. 搜索分类与类型模型兼容层

- 修正站点搜索页把 `workGroup`（作品组/体裁）当作顶层分类的问题。
- 梳理搜索索引与 owner 搜索结果的类型展示，避免乐团显示为“人物”。
- 在不破坏现有 schema（模式）的前提下，为 owner 展示层增加“角色标签/团体标签”兼容层。

### 2. 自动检查详情区重构

- 删除 inline auto-check（行内自动检查）中的重复原条目信息展示。
- 去掉顶部“手动微调”块。
- 去掉候选区外额外的“当前条目信息”块。
- 单条自动检查只保留候选卡片内的对比与四个操作按钮。

### 3. 候选按钮真实写回修复

- 追踪 `confirm/apply/discard/viewed` 的前端事件、草稿持久化、后端 apply/ignore/review-state 链路。
- 修复数值字段在 proposal draft（候选草稿）保存时被错误写成字符串的问题。
- 成功应用或放弃后，立即从当前界面移除候选并刷新条目详情。

### 4. 批量导入粗条目创建链路修复

- 修正 `confirm-create`（确认创建）与 `apply`（确认应用）的行为不匹配问题。
- 让用户在“确认创建”后就能得到可搜索的粗条目，或调整流程使 UI 明确并立即落库。
- 保持分析、确认、自动检查、应用的状态流可理解且可验证。

### 5. 合并条目下拉优化

- 将合并主条目选择从原生 `select` 升级为可搜索、可限高、不会溢出的控件。
- 保持现有合并 API 与数据迁移逻辑不回退。

## Tests First

- `tests/unit/search-panel.test.ts`
- `tests/unit/owner-ui.test.ts`
- `tests/unit/owner-review-utils.test.ts`
- `tests/unit/owner-tools.test.ts`
- `tests/unit/batch-import.test.ts`

新增失败断言至少覆盖：

- 搜索查询时不再输出 `workGroup` 顶层分组，而是在作品条目副标题中显示体裁。
- owner 搜索结果能正确展示角色/类型标签。
- inline auto-check 不再渲染冗余的原条目信息块和批量按钮。
- proposal apply/confirm 在含 `lifeRange`（生卒年区间）编辑后仍能成功写回数值字段。
- proposal discard/apply 成功后会从当前界面移除。
- batch `confirm-create` 后可在搜索中找到新粗条目，或 session 明确进入已落库状态。
- merge target（合并主条目）控件支持搜索并受尺寸约束。

## Verification

### Automated

- `npm test -- tests/unit/search-panel.test.ts tests/unit/owner-ui.test.ts tests/unit/owner-review-utils.test.ts tests/unit/owner-tools.test.ts tests/unit/batch-import.test.ts --runInBand`
- `npm run runtime:build`

### Playwright

- 搜索页验证 `workGroup` 不再单独顶层重复。
- owner 单条自动检查验证：
  - `确认采用`
  - `直接应用`
  - `放弃`
- owner 批量自动检查验证：
  - `应用当前页已确认候选`
  - `应用全部已确认候选`
- 批量导入验证：
  - `开始分析`
  - `确认创建`
  - 搜索新条目
- 合并条目验证：
  - 搜索主条目
  - 选择主条目
  - 合并成功后搜索结果只剩主条目
