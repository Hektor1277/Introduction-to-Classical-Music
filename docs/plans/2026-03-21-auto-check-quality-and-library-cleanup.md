# Auto-Check Quality And Library Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不损伤现有站点与 owner（维护工具）功能的前提下，系统性提升自动检查质量，并完成原始条目库的第一轮历史脏数据清洗。

**Architecture:** 先将“原始数据清洗”和“自动检查生成候选”彻底解耦。原始库清洗优先直接基于 archive（原始档案）与共享规则回填结构化字段；自动检查只消费清洗后的标准库，并在候选生成阶段增加类型化规则、去重与 LLM 复核。所有录音体裁、显示规则、关联关系与候选质量门槛统一收束到共享规则模块，避免再次出现多阶段补丁分叉。

**Tech Stack:** TypeScript、Node.js、Vitest、Astro、Express、shared recording rules（共享录音规则）、legacy parser（旧档案解析器）、owner automation pipeline（维护工具自动检查链路）

---

### Task 1: 固化当前修复基线

**Files:**
- Verify: `data/library/recordings.json`
- Verify: `data/library/people.json`
- Verify: `packages/data-core/src/recording-repair.ts`
- Verify: `scripts/repair-library-recordings.ts`
- Test: `tests/unit/recording-repair.test.ts`

**Step 1: 写一条快照测试，锁定关键修复结果**

目标：
- `recordings.json` 不再存在 `workTypeHint: "unknown"`
- `recordings` 不再引用 `person-item`

**Step 2: 运行单测确认当前基线有效**

Run: `npm test -- tests/unit/recording-repair.test.ts --runInBand`
Expected: PASS

**Step 3: 记录当前库修复统计**

Run: `node output/runtime/scripts/repair-library-recordings.js`
Expected: `remainingUnknownWorkTypeHints: 0` 且 `remainingPlaceholderCredits: 0`

**Step 4: 提交一个“数据修复基线”提交**

```bash
git add data/library/recordings.json data/library/people.json packages/data-core/src/recording-repair.ts scripts/repair-library-recordings.ts tests/unit/recording-repair.test.ts
git commit -m "fix: backfill recording work types and repair placeholder credits"
```

### Task 2: 建立原始库清洗审计层

**Files:**
- Create: `packages/data-core/src/library-audit.ts`
- Create: `scripts/audit-library-cleanup.ts`
- Test: `tests/unit/library-audit.test.ts`

**Step 1: 写失败测试，定义第一批审计规则**

至少覆盖：
- 占位实体（`-`、`未知`、`person-item`）
- 录音 credit（署名信息）缺关键角色
- work / recording 体裁与分组冲突
- 标题和 credit（署名信息）互相矛盾

**Step 2: 实现最小审计输出结构**

建议输出：
- `code`
- `severity`
- `entityType`
- `entityId`
- `message`
- `source`
- `suggestedFix`

**Step 3: 跑测试确认通过**

Run: `npm test -- tests/unit/library-audit.test.ts --runInBand`
Expected: PASS

**Step 4: 增加 CLI（命令行）审计脚本**

Run: `npm run runtime:build && node output/runtime/scripts/audit-library-cleanup.js`
Expected: 输出按问题类型聚合的统计摘要

### Task 3: 录音结构第一轮规范化清洗

**Files:**
- Modify: `packages/data-core/src/recording-repair.ts`
- Modify: `scripts/repair-library-recordings.ts`
- Create: `tests/unit/recording-cleanup-normalization.test.ts`

**Step 1: 写失败测试，锁定录音结构清洗规则**

至少覆盖：
- `title` 与 `credits` 不一致时，优先保留结构化 credit，再重建显示标题
- `performanceDateText` / `venueText` 的拆分规则
- orchestra / ensemble / chorus 的角色归一
- `workTypeHint` 与 `presentation family`（展示家族）一致性

**Step 2: 实现最小清洗函数**

建议拆成纯函数：
- `normalizeRecordingCredits`
- `normalizeRecordingMetadata`
- `rebuildRecordingDerivedFields`

**Step 3: 用抽样 dry-run（试运行）模式验证**

Run: `node output/runtime/scripts/repair-library-recordings.js --dry-run`
Expected: 只输出拟修改统计，不写盘

**Step 4: 在非 dry-run 下执行并复建 generated artifacts（生成产物）**

Run: `node output/runtime/scripts/repair-library-recordings.js`
Expected: 数据写盘且 `npm run build` 仍然通过

### Task 4: 人物 / 团体脏数据拆分与去重

**Files:**
- Modify: `packages/data-core/src/recording-repair.ts`
- Create: `packages/data-core/src/person-cleanup.ts`
- Create: `tests/unit/person-cleanup.test.ts`

**Step 1: 写失败测试，覆盖“占位条目吞 alias（别名）”场景**

目标：
- `person-item` 不能作为真实实体保留
- 被污染的 alias 必须拆回真实条目或保留为待审计问题

**Step 2: 实现最小拆分规则**

优先策略：
- 已有实体可匹配时，迁移引用
- 不可匹配但属于团体时，新建最小团体条目
- 无法安全判断时，输出 audit（审计）问题，不自动合并

**Step 3: 跑测试**

Run: `npm test -- tests/unit/person-cleanup.test.ts --runInBand`
Expected: PASS

### Task 5: 自动检查前置过滤与去重重构

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `packages/automation/src/automation.ts`
- Modify: `packages/automation/src/automation-store.ts`
- Test: `tests/unit/automation-quality-review.test.ts`
- Test: `tests/unit/automation.test.ts`

**Step 1: 写失败测试，锁定自动检查输入规则**

至少覆盖：
- 仅扫描指定 entity type（实体类型）
- 同一实体同一问题只生成一条 proposal（候选）
- 已存在高质量规范值时，不允许低质量候选覆盖
- duplicate（重复）候选必须阻断自动应用

**Step 2: 在自动检查入口增加前置 gate（门槛）**

建议 gate：
- entity type filter
- issue whitelist
- canonical field completeness check
- duplicate proposal suppression

**Step 3: 跑测试确认通过**

Run: `npm test -- tests/unit/automation-quality-review.test.ts tests/unit/automation.test.ts --runInBand`
Expected: PASS

### Task 6: 引入 LLM 复核层，但不直接写库

**Files:**
- Modify: `packages/automation/src/automation-checks.ts`
- Modify: `packages/automation/src/llm.ts`
- Create: `packages/automation/src/proposal-review.ts`
- Test: `tests/unit/automation-quality-review.test.ts`

**Step 1: 写失败测试，定义 LLM 复核输出协议**

输出字段至少包括：
- `verdict`
- `confidence`
- `reasons`
- `rejectBecause`
- `normalizedValue`

**Step 2: 实现最小复核层**

规则：
- LLM 只能“拒绝、降级、标准化建议”，不能直接写正式数据
- 低置信度候选一律进入人工审查
- 与原始 archive 或已有 canonical field（规范字段）冲突时自动拒绝

**Step 3: 跑测试**

Run: `npm test -- tests/unit/automation-quality-review.test.ts --runInBand`
Expected: PASS

### Task 7: owner 端候选应用安全闸

**Files:**
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `apps/owner/web/app.js`
- Test: `tests/unit/owner-review-utils.test.ts`
- Test: `tests/unit/owner-ui.test.ts`

**Step 1: 写失败测试，锁定不可直接应用的情况**

包括：
- duplicate candidate（重复候选）
- 与当前库冲突的 proposal
- 低质量 / 低置信度候选

**Step 2: 实现最小阻断逻辑**

要求：
- 顶层“应用当前页 / 应用全部”按钮遇到阻断项时必须失败并提示原因
- UI（界面）要明确标出被阻断候选

**Step 3: 跑测试**

Run: `npm test -- tests/unit/owner-review-utils.test.ts tests/unit/owner-ui.test.ts --runInBand`
Expected: PASS

### Task 8: 全链路回归与文档收口

**Files:**
- Modify: `docs/rules/library-model.md`
- Modify: `docs/rules/recording-display-rules.md`
- Create: `docs/rules/automation-quality-rules.md`
- Create: `docs/rules/library-cleanup-rules.md`

**Step 1: 更新规则文档**

明确：
- 哪些字段来自原始 archive（原始档案）
- 哪些字段是 derived（派生）字段
- 哪些问题允许自动修
- 哪些问题必须人工确认

**Step 2: 跑全套回归**

Run: `npm test --runInBand`
Expected: PASS

Run: `npm run runtime:build`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 3: 提交规范化与清洗阶段性成果**

```bash
git add packages apps scripts tests docs data
git commit -m "refactor: normalize library cleanup and automation quality rules"
```

---

## Addendum: Phase 0 Before Task 2

### Task 1A: 录音复数 credit 支持与兼容显示

**Goal:** 在不大改 `recording.credits[]` 既有存储结构的前提下，正式把多人物 / 多团体署名纳入共享显示规则与 owner 录音维护表单。该阶段完成后，歌剧、芭蕾、清唱剧、合唱交响曲、室内乐临时组合等场景都能通过同一套 `credits[]` 结构准确维护和展示。

**Files:**
- Modify: `packages/shared/src/recording-rules.ts`
- Modify: `packages/shared/src/display.ts`
- Modify: `apps/owner/web/index.html`
- Modify: `apps/owner/web/app.js`
- Modify: `apps/owner/web/styles.css`
- Modify: `apps/owner/server/owner-app.ts`
- Test: `tests/unit/display.test.ts`
- Test: `tests/unit/owner-ui.test.ts`

**Step 1: 写失败测试，锁定多参与者录音行为**

至少覆盖：
- 合唱 / 管弦混合录音：`orchestra + chorus` 能同时进入版本标题与副标题
- 室内乐临时组合：多个 `soloist` 在无固定组合时按顺序进入标题
- owner 录音表单包含结构化 `credit` 编辑入口，且不再只依赖单个指挥 / 乐团字段

**Step 2: 实现最小共享规则支持**

要求：
- `credits[]` 继续作为唯一底层署名结构
- `conductorPersonId` / `orchestraPersonId` 仅保留为 owner 快捷选择入口，用于同步到 `credits[]`
- 标题 / 副标题生成改为从 `credits[]` 中按体裁提取多个参与者，而不是默认单指挥 / 单乐团

**Step 3: 实现 owner 录音表单的多 credit 编辑**

要求：
- 保留现有常用快捷字段
- 新增可增删的 `credit row`（署名行）编辑器：`role | personId | displayName`
- 保存前统一合成为结构化 `credits[]`

**Step 4: 做全量验证并提交阶段基线**

Run: `npm test -- tests/unit/display.test.ts tests/unit/owner-ui.test.ts --runInBand`
Expected: PASS

Run: `npm run runtime:build`
Expected: PASS

Run: `npm run build`
Expected: PASS

Commit:

```bash
git add packages/shared/src/recording-rules.ts packages/shared/src/display.ts apps/owner/web/index.html apps/owner/web/app.js apps/owner/web/styles.css apps/owner/server/owner-app.ts tests/unit/display.test.ts tests/unit/owner-ui.test.ts docs/plans/2026-03-21-auto-check-quality-and-library-cleanup.md
git commit -m "feat: support multi-credit recordings in owner and display rules"
```
