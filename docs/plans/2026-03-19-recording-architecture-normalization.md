# Recording Architecture Normalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一版本（recording，版本）相关的类型、模板、展示规则和文档入口，减少 `schema`、`display`、`owner`、`automation` 之间的重复实现与阶段性补丁痕迹。

**Architecture:** 先把分散的版本规则收束到共享模块，再让 `schema`、站点展示、owner 维护工具、批量导入与外部检索协议依赖同一套规范。文档层增加独立规则目录，明确网页端展示、字段语义、体裁模板和关联行为，后续变更先改规范再改实现。

**Tech Stack:** TypeScript, Astro, Node.js, Zod, Vitest

---

### Task 1: 建立共享版本规则模块

**Files:**
- Create: `packages/shared/src/recording-rules.ts`
- Modify: `packages/shared/src/schema.ts`
- Modify: `packages/shared/src/display.ts`
- Test: `tests/unit/display.test.ts`
- Test: `tests/unit/indexes.test.ts`

**Step 1: 写失败测试，覆盖共享规则导出与版本家族解析**

覆盖：
- `recordingWorkTypeHintValues` 统一来源
- `normalizeRecordingWorkTypeHintValue()` 能兜底非法输入
- `deriveRecordingPresentationFamily()` 能区分 orchestral / concerto / opera / chamber / solo

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/unit/display.test.ts tests/unit/indexes.test.ts --runInBand`

Expected:
- 新增断言失败

**Step 3: 实现共享规则模块**

实现：
- 版本类型常量
- 版本展示家族（presentation family，展示家族）
- 模板字段数量、标题拼装、credit 模板构建
- 统一 work type 归一化函数

**Step 4: 让 `schema` 与 `display` 改为依赖共享模块**

要求：
- 删除本地重复常量
- 保持现有导出兼容
- 不破坏旧数据读取

**Step 5: 运行测试确认通过**

Run: `npm test -- tests/unit/display.test.ts tests/unit/indexes.test.ts --runInBand`

Expected:
- 全绿

**Step 6: Commit**

```bash
git add packages/shared/src/recording-rules.ts packages/shared/src/schema.ts packages/shared/src/display.ts tests/unit/display.test.ts tests/unit/indexes.test.ts
git commit -m "refactor: centralize recording rules"
```

### Task 2: 统一批量导入与 owner 的版本模板

**Files:**
- Modify: `packages/automation/src/batch-import.ts`
- Modify: `apps/owner/server/owner-app.ts`
- Modify: `packages/automation/src/recording-retrieval.ts`
- Test: `tests/unit/owner-ui.test.ts`
- Test: `tests/unit/automation.test.ts`

**Step 1: 写失败测试，覆盖模板与 workType 归一化来源统一**

覆盖：
- owner 保存 recording 时使用共享 work type 归一化
- batch import 模板规则来自共享模块
- retrieval 类型定义与共享常量一致

**Step 2: 运行测试确认失败**

Run: `npm test -- tests/unit/owner-ui.test.ts tests/unit/automation.test.ts --runInBand`

Expected:
- 新增断言失败

**Step 3: 替换重复实现**

要求：
- 去掉 owner 本地 `Set([...])`
- 去掉 batch import 本地 `strictBatchWorkTypes`
- 去掉 retrieval 本地重复 union 定义

**Step 4: 运行测试确认通过**

Run: `npm test -- tests/unit/owner-ui.test.ts tests/unit/automation.test.ts --runInBand`

Expected:
- 全绿

**Step 5: Commit**

```bash
git add packages/automation/src/batch-import.ts packages/automation/src/recording-retrieval.ts apps/owner/server/owner-app.ts tests/unit/owner-ui.test.ts tests/unit/automation.test.ts
git commit -m "refactor: share recording templates across owner and automation"
```

### Task 3: 建立项目规则文档目录

**Files:**
- Create: `docs/rules/recording-display-rules.md`
- Create: `docs/rules/library-model.md`
- Modify: `docs/plans/2026-03-19-recording-architecture-normalization.md`

**Step 1: 整理版本显示规则**

文档内容：
- 各体裁标题规则
- 副标题规则
- daily / recommendation / search / detail 的展示槽位
- 标题与 canonical title 的关系

**Step 2: 整理数据模型规则**

文档内容：
- composer / person / work / recording 字段职责
- recording credit 角色语义
- workTypeHint 与展示家族的区别
- slug / sortKey 的统一管理原则

**Step 3: 校对文档与代码一致**

Run: `rg -n "workTypeHint|presentation family|slug|sortKey" packages docs apps`

Expected:
- 文档术语与代码术语一致

**Step 4: Commit**

```bash
git add docs/rules/recording-display-rules.md docs/rules/library-model.md docs/plans/2026-03-19-recording-architecture-normalization.md
git commit -m "docs: document recording rules and library model"
```

### Task 4: 全量验证与剩余风险盘点

**Files:**
- Modify: `docs/rules/library-model.md`

**Step 1: 跑完整验证**

Run:

```bash
npm test -- tests/unit/display.test.ts tests/unit/site-content.test.ts tests/unit/owner-ui.test.ts tests/unit/indexes.test.ts tests/unit/search-panel.test.ts tests/unit/automation.test.ts --runInBand
npm run runtime:build
npm run build
```

Expected:
- 全部通过

**Step 2: 盘点剩余结构风险**

重点：
- 旧数据字段兼容层
- mojibake / 编码污染文件
- data JSON 中的历史脏数据
- 版本体裁细分仍不足的条目

**Step 3: 更新文档中的后续清理清单**

要求：
- 明确哪些属于代码规范问题
- 明确哪些属于数据清洗问题

**Step 4: Commit**

```bash
git add docs/rules/library-model.md
git commit -m "chore: verify normalized recording architecture"
```
