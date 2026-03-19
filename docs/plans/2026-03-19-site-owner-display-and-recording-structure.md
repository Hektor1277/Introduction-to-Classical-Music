# Site/Owner Display And Recording Structure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复站点与 owner 中的条目显示错误，统一版本标题生成策略，补齐人物/版本结构缺口，并修正顶部布局对齐问题。

**Architecture:** 先区分“可由代码统一生成的显示问题”和“必须数据清洗才能彻底解决的脏数据问题”。对前者统一收敛到共享显示函数与 owner 表单逻辑；对后者保留数据原值，但在展示层尽可能回退到结构化字段。人物与版本表单的缺口优先通过 schema、owner 表单和保存逻辑补齐，不做高风险重构。

**Tech Stack:** TypeScript, Astro, Express, vanilla JS, Vitest

---

### Task 1: 根因确认与行为基线

**Files:**
- Inspect: `packages/shared/src/display.ts`
- Inspect: `packages/data-core/src/indexes.ts`
- Inspect: `apps/site/src/pages/index.astro`
- Inspect: `apps/site/src/pages/recordings/[id].astro`
- Inspect: `apps/owner/server/owner-app.ts`
- Inspect: `apps/owner/web/app.js`
- Inspect: `apps/owner/web/index.html`
- Inspect: `data/library/people.json`
- Inspect: `data/library/recordings.json`

1. 确认网页端人物/团体搜索主标题是否被别名覆盖。
2. 确认版本页、首页推荐、搜索结果是否直接使用 `recording.title`。
3. 确认版本数据中 `credits / performanceDateText / venueText` 是否足以生成“指挥 - 乐团全名 - 时间”。
4. 确认 owner 的人物与版本表单缺少哪些字段与提示。

### Task 2: 先写失败测试覆盖当前错误

**Files:**
- Modify: `tests/unit/display.test.ts`
- Modify: `tests/unit/indexes.test.ts`
- Modify: `tests/unit/owner-ui.test.ts`
- Modify: `tests/unit/site-content.test.ts`

1. 为“柏林爱乐乐团不应被别名覆盖成柏林爱乐管弦乐团”写失败测试。
2. 为“版本显示应优先由 credits + 时间拼装，而不是直接使用旧 title”写失败测试。
3. 为“版本显示使用乐团全名而不是缩写”写失败测试。
4. 为“owner 人物表单出现作曲家角色选项，版本表单出现体裁/指挥/乐团字段以及 slug/sortKey 提示”写失败测试。

### Task 3: 修复共享显示逻辑与站点版本展示

**Files:**
- Modify: `packages/shared/src/display.ts`
- Modify: `packages/data-core/src/indexes.ts`
- Modify: `apps/site/src/pages/index.astro`
- Modify: `apps/site/src/pages/recordings/[id].astro`
- Modify: `apps/site/src/components/DailyRecommendations.astro`

1. 修正中文规范全名推导逻辑，优先使用 canonical name（规范主名）而不是更长别名。
2. 新增版本标题/副标题生成函数，区分：
   - 网站搜索与条目标题：指挥 / 乐团全名 / 时间
   - 缺字段时安全回退到已有结构化字段
3. 让首页推荐、版本详情页和关系索引统一走共享版本显示函数。
4. 保留原始数据不直接覆盖，先在展示层吸收旧标题污染。

### Task 4: 补齐 owner 的人物/版本表单结构

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Modify: `apps/owner/web/index.html`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `apps/owner/web/ui-helpers.js`

1. 在人物角色体系中加入 `composer`，并让 owner 可见。
2. 在版本表单中新增体裁、指挥、乐团字段，保存时写入结构化 credits。
3. 为 `slug` 与 `sortKey` 增加简短提示，并在保存时统一自动生成/覆盖。
4. 检查并补齐版本结构与接口 payload，确认 conductor/orchestra 能完整进出 owner API。

### Task 5: 顶层 UI 对齐修复

**Files:**
- Modify: `apps/owner/web/styles.css`

1. 修正候选审查与其他 detail panel 的垂直对齐，确保顶部按钮始终贴顶。
2. 去掉“空内容时把整块区域垂直居中”的布局行为。

### Task 6: 闭环验证

**Files:**
- Verify only

1. 运行新增的单测并确认先失败后通过。
2. 运行：
   - `npm test -- tests/unit/display.test.ts tests/unit/indexes.test.ts tests/unit/owner-ui.test.ts tests/unit/site-content.test.ts --runInBand`
   - `npm test -- tests/unit/search-panel.test.ts tests/unit/automation.test.ts --runInBand`
   - `npm run runtime:build`
3. 启动 `owner` 与 `site`，手动回归：
   - 站点 `berlin` 搜索结果主标题
   - 首页推荐版本标题
   - 版本详情页标题与元信息
   - owner 人物角色勾选
   - owner 版本表单字段
   - 候选审查空状态顶部对齐
