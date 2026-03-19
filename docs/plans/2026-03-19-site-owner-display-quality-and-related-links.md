# Site / Owner Display, Quality, and Related Links Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复站点端不同体裁版本展示、owner 维护工具布局与关联跳转，并提升自动检查候选质量，完成本轮闭环测试。

**Architecture:** 以 `packages/shared/src/display.ts` 为单一展示规则中心，向站点首页、详情页和 owner 搜索结果输出统一的结构化展示模型。owner 端新增一级关联条目查询与跳转能力，自动检查链路增加字段级质量门禁与 LLM/规则复查，避免低质量候选覆盖正式值。

**Tech Stack:** TypeScript, Astro, Node.js, Vitest/Jest-style unit tests, owner local web UI, Playwright CLI

---

### Task 1: 写入体裁化版本展示测试

**Files:**
- Modify: `tests/unit/display.test.ts`
- Reference: `packages/shared/src/display.ts`

**Step 1: Write the failing test**

补充用例覆盖：
- 交响乐标题/副标题：`指挥中文全名 - 乐团中文名 - 时间`
- 协奏曲标题/副标题：`指挥短名 - 独奏短名 - 乐团中文名 - 时间`
- 独奏标题/副标题：`独奏者中文全名 - 地点 - 时间`
- 室内乐标题/副标题：`组合名或并列独奏短名 - 地点 - 时间`
- 歌剧/芭蕾舞剧标题规则
- 每日推荐所需的结构化行数据

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/display.test.ts --runInBand`

Expected: FAIL，提示缺少新的体裁展示字段或标题顺序不符合预期

**Step 3: Write minimal implementation**

在 `packages/shared/src/display.ts` 中扩展统一展示模型，新增每日推荐/列表/详情共用的主标题、副标题、人物行、团体行、时间地点行生成逻辑。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/display.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/display.test.ts packages/shared/src/display.ts
git commit -m "feat: refine recording display rules by work type"
```

### Task 2: 写入站点页面回归测试

**Files:**
- Modify: `tests/unit/site-content.test.ts`
- Modify: `tests/unit/indexes.test.ts`
- Reference: `apps/site/src/pages/index.astro`
- Reference: `apps/site/src/components/DailyRecommendations.astro`
- Reference: `apps/site/src/pages/recordings/[id].astro`

**Step 1: Write the failing test**

补充首页每日推荐与推荐版本的渲染断言：
- 主副标题存在
- 协奏曲包含独奏者信息而非把指挥误当独奏
- 固定行位数据存在

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/site-content.test.ts tests/unit/indexes.test.ts --runInBand`

Expected: FAIL，页面输出与新展示模型不一致

**Step 3: Write minimal implementation**

修改站点首页和详情页，将 `display.ts` 的结构化输出接入 `DailyRecommendations`、推荐版本列表和详情页元信息。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/site-content.test.ts tests/unit/indexes.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/site-content.test.ts tests/unit/indexes.test.ts apps/site/src/pages/index.astro apps/site/src/components/DailyRecommendations.astro apps/site/src/pages/recordings/[id].astro
git commit -m "feat: wire structured recording display into site pages"
```

### Task 3: 写入 owner UI 布局与搜索卡片测试

**Files:**
- Modify: `tests/unit/owner-ui.test.ts`
- Reference: `apps/owner/web/index.html`
- Reference: `apps/owner/web/styles.css`
- Reference: `apps/owner/web/app.js`

**Step 1: Write the failing test**

补充断言：
- 人物角色区五个选项同一行
- 搜索结果卡片允许内容增高，按钮不被遮挡
- 顶层 tab 区和次级卡片均顶部对齐
- 版本详情存在关联条目跳转控件

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/owner-ui.test.ts --runInBand`

Expected: FAIL，缺少新样式或控件

**Step 3: Write minimal implementation**

调整 owner HTML/CSS/前端脚本，修复角色布局、搜索结果卡片尺寸、顶层布局与关联条目下拉/跳转。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/owner-ui.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/owner-ui.test.ts apps/owner/web/index.html apps/owner/web/styles.css apps/owner/web/app.js
git commit -m "feat: improve owner layout and related record navigation"
```

### Task 4: 写入自动检查质量门禁测试

**Files:**
- Modify: `tests/unit/automation.test.ts`
- Reference: `packages/automation/src/automation-checks.ts`
- Reference: `apps/owner/server/owner-app.ts`

**Step 1: Write the failing test**

新增用例覆盖：
- 明显垃圾中文名不进入候选
- 低质量候选不得覆盖已有高质量正式值
- 乐团/人物/版本按类型应用不同字段规则
- 存在 LLM 复查结论时错误候选被降权或剔除

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/automation.test.ts --runInBand`

Expected: FAIL，当前候选筛选过宽

**Step 3: Write minimal implementation**

在自动检查链路中加入字段级校验、来源质量评分、类型化候选门禁与 LLM 复查结果融合。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/automation.test.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add tests/unit/automation.test.ts packages/automation/src/automation-checks.ts apps/owner/server/owner-app.ts
git commit -m "feat: harden automation candidate quality gates"
```

### Task 5: 做完整验证与浏览器回归

**Files:**
- Reference: `apps/site/src/components/DailyRecommendations.astro`
- Reference: `apps/owner/web/styles.css`
- Reference: `packages/automation/src/automation-checks.ts`

**Step 1: Run targeted unit suites**

Run: `npm test -- tests/unit/display.test.ts tests/unit/site-content.test.ts tests/unit/indexes.test.ts tests/unit/owner-ui.test.ts tests/unit/automation.test.ts --runInBand`

Expected: PASS

**Step 2: Run build verification**

Run: `npm run runtime:build`

Expected: PASS

Run: `npm run build`

Expected: PASS

**Step 3: Run browser verification**

Run owner/site，使用 Playwright CLI 检查：
- 首页每日推荐与推荐版本的标题、副标题、固定行高
- 协奏曲详情独奏/指挥字段归类
- owner 顶部按钮与候选审查卡片顶部贴齐
- 搜索结果卡片按钮无遮挡
- 关联条目可跳转

**Step 4: Record residual issues**

若仍有数据脏值而非代码问题，记录具体条目与原因，不在展示层继续硬修。

**Step 5: Commit**

```bash
git add .
git commit -m "fix: refine site recording display and owner review workflows"
```
