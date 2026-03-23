# 版本显示规则

本文档定义 `recording`（版本）在项目内的统一显示规则，作为站点网页端、owner 维护工具、批量导入模板与自动检查的共同参考。

## 1. 字段分层

- `recording.title`：版本的 canonical title（规范标题），是保存后的派生结果。
- `recording.workTypeHint`：输入层体裁提示。当前规范值包括：
  - `orchestral`
  - `concerto`
  - `opera_vocal`
  - `chamber_solo`
  - `unknown`
- `presentation family`（展示家族）：展示层归一化结果，不直接写回数据，用于决定标题、副标题、搜索文本与推荐卡片布局。当前包括：
  - `orchestral`
  - `concerto`
  - `opera`
  - `solo`
  - `chamber`
  - `unknown`

## 2. 标题与副标题生成来源

- 所有标题与副标题统一从 `credits[]`、`performanceDateText`、`venueText` 与所属作品体裁派生。
- 历史 `recording.title` 只作为回退值，不作为优先事实来源。
- 多参与者场景下必须保留顺序，不允许把多位参与者压成单一虚假团体。

## 3. 各展示家族规则

### `orchestral`

- 主标题：`指挥中文短名 - 乐团 / 团体中文全名 - 时间`
- 若存在多个团体，例如乐团 + 合唱，则按顺序串联进入标题。
- 副标题：对应拉丁名 / 英文名串联。

### `concerto`

- 主标题：`指挥中文短名 - 独奏中文短名串联 - 乐团 / 团体中文全名 - 时间`
- 独奏者可为一人或多人，按 `credits[]` 顺序进入标题。
- 副标题：对应拉丁名 / 英文名串联。

### `opera`

- 主标题：`指挥中文短名 - 重要歌手 / 卡司 - 乐团 / 合唱 / 团体 - 时间`
- 若同时存在乐团与合唱，则都进入标题。
- 副标题：对应原文或英文串联。

### `solo`

- 主标题：`独奏者中文全名 / 短名 - 地点 - 时间`
- 副标题：`soloist short latin - place - time`

### `chamber`

- 主标题：`组合名或多位主奏者串联 - 地点 / 协作者 - 时间`
- 当没有正式组合条目时，允许多个 `soloist` 直接进入标题。
- 副标题：对应原文或英文串联。

## 4. 搜索与详情页

- 搜索结果标题始终使用 `recording.title`。
- 搜索副文本使用 `recording.subtitle` 或 `secondaryText`。
- 详情页 `H1` 始终使用 `recording.title`。
- 若 `subtitle !== title`，详情页显示副标题。

## 5. 首页 Daily / Recommendation（每日推荐 / 推荐版本）

首页推荐卡统一输出如下槽位：

- `workPrimary`
- `workSecondary`
- `composerPrimary`
- `composerSecondary`
- `title`
- `subtitle`
- `datePlacePrimary`

当前站点推荐卡规则：

- 第 1 行：作品中文名，加粗并放大一级字号。
- 第 2 行：作品原名 / 英文名，包含作品号。
- 第 3 行：作曲家中文全名。
- 第 4 行：作曲家英文 / 原文全名。
- 第 5 行：版本标题中文版，加粗。
- 第 6 行：版本标题英文 / 原文版。
- 第 7 行：时间地点。

布局规则：

- 所有文本行为单行。
- 超出内容不换行，不使用 `...` 文本，而使用渐隐遮罩。
- 鼠标悬浮时通过提示显示完整内容。
- 即使某些字段为空，也保留占位行，保证所有卡片尺寸一致。

## 6. 保守回退策略

- `unknown` 不主动推断为 `concerto` 或 `opera`。
- credit 冲突或体裁信息不足时，优先回退到 `orchestral` 家族或使用原始 `recording.title`。
- 指挥与独奏撞人时，展示层去重，避免同一人同时出现在多条人物线。
- 若结构化 credit 完整而历史标题明显不一致，优先信任结构化 credit，并将问题归类为数据清洗。

## 7. 变更原则

- 先更新本规则，再更新共享模块：
  - `packages/shared/src/recording-rules.ts`
  - `packages/shared/src/display.ts`
- 批量导入模板、owner 表单、网页端显示必须共用同一套体裁归一与标题生成逻辑。
- 若需求属于“规则改变”，优先修改共享模块；若属于“个别条目异常”，优先作为数据清洗问题处理。
