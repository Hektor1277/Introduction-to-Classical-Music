# 项目存储模型

本文档从第三方开发者视角描述当前项目的核心存储结构，以及后续清洗与重构时应遵守的统一原则。

## 1. 顶层实体

### `composer`

- 负责作曲家 canonical identity（规范身份）。
- `name` 必须是中文全名。
- `displayName` 用于中文短名。
- `displayFullName` 用于覆盖网页端与 owner 端的中文全名显示。
- `displayLatinName` 用于网页端与索引中的拉丁名 / 英文名显示。

### `person`

- 负责非作曲家人物与各类团体。
- 当前 `roles` 已支持多角色，并允许 `composer` 角色并入，避免“作曲家”和“人物”重复建模。
- 常见角色包括：
  - `composer`
  - `conductor`
  - `soloist`
  - `singer`
  - `ensemble`
  - `orchestra`
  - `chorus`
  - `instrumentalist`

### `work`

- 负责作品 canonical identity（规范身份）。
- `title` 为中文主标题。
- `titleLatin` 为原文或英文标题。
- `catalogue` 为作品号。
- 网页端与 owner 端都应从 `title / titleLatin / catalogue` 统一拼装作品展示文本。

### `recording`

- 负责某一个具体版本 / 演出 / 录音。
- `title` 是规范版本标题，但属于 derived field（派生字段），不是权威原始事实。
- `credits[]` 是唯一底层署名结构，所有参与者都应落到这里。
- `workTypeHint` 是输入层体裁提示，用于驱动共享显示规则。
- `performanceDateText` 与 `venueText` 为展示层常用元数据。

## 2. `recording` 的底层约束

### 唯一权威字段

- `credits[]` 是唯一权威署名来源。
- `conductorPersonId` / `orchestraPersonId` 仅作为 owner 快捷入口，保存时必须同步回 `credits[]`。
- 网页端标题、副标题、搜索文本、推荐卡片都必须从 `credits[]` 与 `workTypeHint` 派生。

### `credits[]` 结构

每条 credit 至少包含：

- `role`
- `personId`
- `displayName`

其中：

- `personId` 可为空，表示当前仍需人工确认或保留原始文本。
- `displayName` 用于保底显示与回写，不能完全依赖 `personId` 临时生成。
- 允许同一版本出现多个 `soloist`、多个 `singer`、多个 `ensemble`、多个 `chorus`，用于歌剧、芭蕾舞剧、清唱剧、合唱交响曲、室内乐临时组合等场景。

### 复数参与者兼容策略

- 不新增第二套复合结构，继续使用现有 `credits[]`。
- 多人物 / 多团体版本通过多条 credit 表达，不通过硬编码字符串拼接。
- owner 版本表单允许新增 / 删除任意数量的 `credit row`（署名行）。

## 3. `slug` 与 `sortKey`

- `slug` 与 `sortKey` 属于项目内部派生字段，不属于外部客观事实。
- owner 工具统一生成和覆盖。
- 用户输入仅作临时参考，不应视为权威来源。

## 4. 一级直接关联

owner 跳转控件只展示一级直接关联，避免维护工具退化为图遍历器：

- `composer -> work`
- `work -> composer / recording`
- `person -> recording`
- `recording -> work / credited people`

## 5. 代码问题与数据问题的边界

以下属于代码规范问题：

- 相同规则在多个文件重复实现。
- 标题 / 副标题拼装规则不统一。
- `workTypeHint` 常量与展示家族推断散落在多个模块。
- owner 与 site 对同一字段语义不一致。

以下属于数据清洗问题：

- 版本缺少关键 credit。
- 乐团条目仍把 alias 保留为 canonical name。
- 历史 `title` 写入错误信息。
- 人物 / 团体 alias 污染自动检查结果。
- 占位实体如 `person-item`、`-`、`未知` 仍被正式条目引用。

## 6. 后续清理原则

- 规则变更优先修改共享模块，再修改 owner / site。
- 个别条目异常优先按数据清洗处理，不在展示层打补丁。
- 新增版本体裁或新增显示规则时，先更新规则文档，再更新共享模块与测试。
