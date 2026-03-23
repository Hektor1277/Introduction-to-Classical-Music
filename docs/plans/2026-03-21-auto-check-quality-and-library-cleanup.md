# Auto-Check Quality And Library Cleanup Implementation Plan

> 执行要求：按阶段落地；每完成一个阶段，都必须先做全量回归验证，再单独提交并推送。

**目标**

在不损伤当前站点（site，网站）与 owner（维护工具）现有功能的前提下，系统性提升自动检查（auto-check，自动检查）质量，并完成原始条目库的第一轮历史脏数据清洗。

**架构原则**

- 原始库清洗与自动检查候选生成彻底解耦。
- 原始库清洗优先直接基于 archive（原始档案）与共享规则回填结构化字段。
- 自动检查只消费清洗后的标准库，不直接修复原始脏数据。
- 所有版本体裁、显示规则、关联关系与候选质量门槛统一收束到共享规则模块，避免再次出现多阶段补丁分叉。

**技术栈**

- TypeScript
- Node.js
- Vitest
- Astro
- Express
- shared recording rules（共享版本规则）
- legacy parser（旧档案解析器）
- owner automation pipeline（维护工具自动检查链路）

---

## Task 1: 固化当前修复基线

**涉及文件**

- `data/library/recordings.json`
- `data/library/people.json`
- `packages/data-core/src/recording-repair.ts`
- `scripts/repair-library-recordings.ts`
- `tests/unit/recording-repair.test.ts`

**步骤**

1. 补一条快照测试，锁定关键修复结果：
   - `recordings.json` 中不再存在 `workTypeHint: "unknown"`
   - `recordings` 中不再引用 `person-item`
2. 运行：
   - `npm test -- tests/unit/recording-repair.test.ts --runInBand`
3. 运行：
   - `node output/runtime/scripts/repair-library-recordings.js`
4. 预期统计：
   - `remainingUnknownWorkTypeHints: 0`
   - `remainingPlaceholderCredits: 0`
5. 阶段提交：
   - `fix: backfill recording work types and repair placeholder credits`

## Task 1A: 版本复数 credit（署名）支持与兼容显示

**目标**

在不大改既有 `recording.credits[]` 存储结构的前提下，正式把多人物 / 多团体署名纳入共享显示规则与 owner 版本维护表单。

**涉及文件**

- `packages/shared/src/recording-rules.ts`
- `packages/shared/src/display.ts`
- `apps/owner/web/index.html`
- `apps/owner/web/app.js`
- `apps/owner/web/styles.css`
- `apps/owner/server/owner-app.ts`
- `tests/unit/display.test.ts`
- `tests/unit/owner-ui.test.ts`

**步骤**

1. 先补失败测试，覆盖：
   - 合唱 / 管弦混合版本：`orchestra + chorus`
   - 室内乐临时组合：多个 `soloist`
   - owner 表单中的结构化 `credit row`（署名行）编辑入口
2. 实现共享规则：
   - `credits[]` 保持为唯一底层署名结构
   - `conductorPersonId` / `orchestraPersonId` 仅作为 owner 快捷入口
   - 标题 / 副标题改为从 `credits[]` 按体裁提取参与者
3. 实现 owner 版本表单的多 `credit row` 编辑。
4. 运行：
   - `npm test -- tests/unit/display.test.ts tests/unit/owner-ui.test.ts --runInBand`
5. 做阶段验证与提交。

## Task 2: 建立原始库清洗审计层

**涉及文件**

- `packages/data-core/src/library-audit.ts`
- `scripts/audit-library-cleanup.ts`
- `tests/unit/library-audit.test.ts`

**步骤**

1. 先补失败测试，定义第一批审计规则：
   - 占位实体：`-`、`unknown`、`未知`、`person-item`
   - 版本 credit 缺关键角色
   - work / recording 体裁与分组冲突
   - 标题与 credit 相互矛盾
2. 审计输出结构统一为：
   - `code`
   - `severity`
   - `entityType`
   - `entityId`
   - `message`
   - `source`
   - `suggestedFix`
3. 运行：
   - `npm test -- tests/unit/library-audit.test.ts --runInBand`
4. 增加 CLI（命令行）审计脚本。
5. 运行：
   - `npm run runtime:build`
   - `node output/runtime/scripts/audit-library-cleanup.js`

## Task 3: 版本结构第一轮规范化清洗

**涉及文件**

- `packages/data-core/src/recording-repair.ts`
- `scripts/repair-library-recordings.ts`
- `tests/unit/recording-cleanup-normalization.test.ts`

**步骤**

1. 先补失败测试，覆盖：
   - `title` 与 `credits` 不一致时，优先保留结构化 credit
   - `performanceDateText` / `venueText` 拆分
   - `orchestra` / `ensemble` / `chorus` 角色归一
   - `workTypeHint` 与 `presentation family`（展示家族）一致
2. 将逻辑拆成纯函数：
   - `normalizeRecordingCredits`
   - `normalizeRecordingMetadata`
   - `rebuildRecordingDerivedFields`
3. 运行 dry-run（试运行）：
   - `node output/runtime/scripts/repair-library-recordings.js --dry-run`
4. 再执行真实清洗并重建生成产物。

## Task 4: 人物 / 团体脏数据拆分与去重

**涉及文件**

- `packages/data-core/src/recording-repair.ts`
- `packages/data-core/src/person-cleanup.ts`
- `tests/unit/person-cleanup.test.ts`

**步骤**

1. 先补失败测试，覆盖“占位条目吞 alias（别名）”场景。
2. 实现最小拆分规则：
   - 已有实体可匹配时，迁移引用
   - 不可匹配但可安全判定为团体时，新建最小团体条目
   - 无法安全判断时，只输出 audit（审计）问题，不自动合并
3. 运行：
   - `npm test -- tests/unit/person-cleanup.test.ts --runInBand`

## Task 5: 自动检查前置过滤与去重重构

**涉及文件**

- `packages/automation/src/automation-checks.ts`
- `packages/automation/src/automation.ts`
- `packages/automation/src/automation-store.ts`
- `tests/unit/automation-quality-review.test.ts`
- `tests/unit/automation.test.ts`

**步骤**

1. 先补失败测试，锁定：
   - 只扫描指定 `entity type`（实体类型）
   - 同一实体同一问题只生成一条 `proposal`（候选）
   - 已存在高质量规范值时，不允许低质量候选覆盖
   - duplicate（重复）候选必须阻断自动应用
2. 在入口增加前置 gate（门槛）：
   - `entity type filter`
   - `issue whitelist`
   - `canonical field completeness check`
   - `duplicate proposal suppression`
3. 运行：
   - `npm test -- tests/unit/automation-quality-review.test.ts tests/unit/automation.test.ts --runInBand`

## Task 6: 引入 LLM proposal review（大模型候选复核）层，但不直接写库

**涉及文件**

- `packages/automation/src/automation-checks.ts`
- `packages/automation/src/llm.ts`
- `packages/automation/src/proposal-review.ts`
- `tests/unit/automation-quality-review.test.ts`

**步骤**

1. 先补失败测试，定义结构化输出协议：
   - `verdict`
   - `confidence`
   - `reasons`
   - `rejectBecause`
   - `normalizedValue`
2. 实现最小复核层：
   - LLM 只能拒绝、降级、给标准化建议
   - LLM 不能直接写正式数据
   - 低置信度候选一律进入人工审查
   - 与 archive 或现有 canonical field（规范字段）冲突时自动拒绝
3. 运行：
   - `npm test -- tests/unit/automation-quality-review.test.ts --runInBand`

## Task 7: owner 端候选应用安全闸

**涉及文件**

- `apps/owner/server/owner-app.ts`
- `apps/owner/web/app.js`
- `tests/unit/owner-review-utils.test.ts`
- `tests/unit/owner-ui.test.ts`

**步骤**

1. 先补失败测试，覆盖：
   - duplicate candidate（重复候选）
   - 与当前库冲突的 proposal
   - 低质量 / 低置信度候选
2. 实现最小阻断逻辑：
   - “应用当前页 / 应用全部”遇到阻断项必须失败并提示原因
   - UI（界面）明确标出被阻断候选
3. 运行：
   - `npm test -- tests/unit/owner-review-utils.test.ts tests/unit/owner-ui.test.ts --runInBand`

## Task 8: 全链路回归与文档收口

**涉及文件**

- `docs/rules/library-model.md`
- `docs/rules/recording-display-rules.md`
- `docs/rules/automation-quality-rules.md`
- `docs/rules/library-cleanup-rules.md`

**步骤**

1. 更新规则文档，明确：
   - 哪些字段来自 archive（原始档案）
   - 哪些字段是 derived（派生）字段
   - 哪些问题允许自动修
   - 哪些问题必须人工确认
2. 运行全套验证：
   - `npm test --runInBand`
   - `npm run runtime:build`
   - `npm run build`
3. 阶段提交：
   - `refactor: normalize library cleanup and automation quality rules`
