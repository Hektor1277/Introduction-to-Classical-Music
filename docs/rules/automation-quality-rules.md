# 自动检查质量规则

本文档描述 automation pipeline（自动检查链路）在当前项目中的质量门槛、去重规则、LLM proposal review（大模型候选复核）边界，以及 owner 应用安全闸。

## 1. 总体原则

- 自动检查只生成 `proposal`（候选），不直接写正式库。
- 原始库清洗与自动检查候选生成必须解耦。
- 自动检查只消费清洗后的标准库。
- 任意候选若无法安全直接应用，必须进入人工复核。

## 2. 候选生成前置 gate（门槛）

进入候选生成前，至少执行以下过滤：

- `entity type filter`：只扫描请求指定的实体类型。
- `issue whitelist`：只处理当前类别允许的字段与问题类型。
- `canonical field completeness check`：若现有规范字段已完整且质量高，低质量来源不得覆盖。
- `duplicate proposal suppression`：同一实体、同一问题、同一字段修改，只保留一条候选。

## 3. 候选去重

系统当前采用两层去重：

- `proposal.id` 级去重：避免同一 run（运行记录）重复写入完全相同的候选。
- semantic signature（语义签名）去重：对“同实体、同字段修改、同 merge 候选、同图片来源”等语义等价候选做合并。

目标是避免：

- 同一页面出现重复候选。
- 历史 run 脏数据在 owner 中被重复放大。
- 顶层批量应用时出现“看似点了但什么都没发生”的假成功。

## 4. LLM proposal review（大模型候选复核）

LLM 只允许做三类事：

- 拒绝：`verdict = reject`
- 降级 / 标记注意：`verdict = needs-attention`
- 提供标准化建议：`normalizedValue`

LLM 不允许：

- 直接写正式数据。
- 绕过规则门槛强行提升候选可信度。
- 覆盖已经存在的高质量 canonical value（规范值）。

结构化输出至少包含：

- `verdict`
- `confidence`
- `issues`
- `reasons`
- `rejectBecause`
- `normalizedValue`

## 5. 风险分级

- `low`：字段来源稳定、语义清晰、无冲突。
- `medium`：来源不够强或需要人工确认，但仍可保留为候选。
- `high`：存在明显冲突、缺乏交叉验证，或必须依赖人工判断。

`high` 风险候选不能直接应用。

## 6. 直接应用阻断规则

以下候选必须被阻断直接应用：

- `merge proposal`（合并候选）
- `review-only proposal`（仅供复核候选）
- `risk = high` 的候选
- 被 LLM 标记为 `needs-attention`
- 与当前库产生实体或字段冲突的候选

阻断逻辑必须同时存在于：

- 自动检查后端应用逻辑
- owner 顶层批量应用
- owner 单条直接应用入口
- owner 候选卡片显式提示

## 7. owner 端行为约束

- “应用当前页 / 应用全部”遇到被阻断候选时必须失败，并提示原因。
- 不允许静默跳过被阻断候选后继续执行。
- 被阻断候选必须显示“阻断应用”说明。
- 若当前 run 内存在重复或高风险候选，用户必须逐条处理。

## 8. 后续扩展原则

- 先补失败测试，再改规则。
- 新增来源或新增类别前，先定义质量门槛和降级策略。
- 若来源仅为 LLM，则默认进入更严格风险等级，不得进入自动应用通道。
