# 版本显示规则

本文件定义 `recording`（版本）在项目内的统一展示规则，作为站点网页端、owner 维护工具、批量导入模板与自动检查的共同参考。

## 1. 字段分层

- `recording.title`：版本的 canonical title（规范标题），用于详情页标题、搜索标题、索引标题、owner 保存时的回填标题。
- `recording.workTypeHint`：输入层的体裁提示（work type hint，体裁提示），当前规范值为：
  - `orchestral`
  - `concerto`
  - `opera_vocal`
  - `chamber_solo`
  - `unknown`
- `presentation family`（展示家族）：展示层使用的归一化家族，不直接写回数据，用于决定标题、副标题和 daily slots（每日推荐槽位）：
  - `orchestral`
  - `concerto`
  - `opera`
  - `solo`
  - `chamber`
  - `unknown`

## 2. 标题与副标题

### orchestral

- 主标题：`指挥中文短名 - 乐团中文全名 - 时间`
- 副标题：`conductor short latin - orchestra latin - time`

### concerto

- 主标题：`指挥中文短名 - 独奏中文短名 - 乐团中文全名 - 时间`
- 副标题：`conductor short latin - soloist short latin - orchestra latin - time`

### opera

- 主标题：`指挥中文短名 - 重要歌手/卡司 - 乐团/合唱 - 时间`
- 副标题：对应英文或原文短名串联

### solo

- 主标题：`独奏者中文全名/短名 - 地点 - 时间`
- 副标题：`soloist short latin - place - time`

### chamber

- 主标题：`组合名或主奏组合 - 协作者/地点 - 时间`
- 副标题：对应英文或原文短名串联

## 3. Daily / Recommendation 槽位

统一输出以下槽位：

- `title`
- `subtitle`
- `workPrimary`
- `workSecondary`
- `principalPrimary`
- `principalSecondary`
- `supportingPrimary`
- `supportingSecondary`
- `ensemblePrimary`
- `ensembleSecondary`
- `datePlacePrimary`
- `datePlaceSecondary`

UI 规则：

- 标题固定预留两行
- 副标题固定预留两行
- 人物、团体、时间地点采用固定槽位高度
- 超出隐藏，不允许挤压相邻卡片

## 4. 搜索与详情页

- 搜索结果标题始终使用 `recording.title`
- 搜索副文本使用 `recording.subtitle` / `secondaryText`
- 详情页 H1 始终使用 `recording.title`
- 若 `subtitle !== title`，详情页展示副标题

## 5. 保守策略

- `unknown` 不主动推断为 `concerto` 或 `opera`
- 当 credit 冲突或体裁信息不足时，优先回退到 `orchestral` 或原始 `recording.title`
- 指挥与独奏撞人时，展示层去重，避免同一人同时出现在两条人物线

## 6. 变更原则

- 先更新本规则，再更新共享模块 `packages/shared/src/recording-rules.ts`
- 批量导入模板、owner 表单、网页端显示必须共用同一套 work type 归一化
- 若需求是“规则改变”，优先改共享模块；若需求是“个别条目异常”，优先认定为数据清洗问题
