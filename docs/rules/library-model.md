# 项目存储模型

本文件从第三方开发者视角描述当前项目的核心存储结构，以及后续清洗与重构时应遵守的统一原则。

## 1. 顶层实体

### composer

- 负责作曲家 canonical identity（规范身份）
- `name` 应为中文全名
- `displayName` 用于中文短名
- `displayFullName` 用于中文全名显式覆盖
- `displayLatinName` 用于网页端短拉丁名显示

### person

- 负责非作曲家人物与各类团体
- 当前已将 `composer` 纳入 `roles` 体系，避免“作曲家”与“人物”重复建模
- `roles` 可同时包含多个角色，例如：
  - `composer`
  - `conductor`
  - `soloist`
  - `orchestra`

### work

- 负责作品 canonical identity
- `title` 为中文主标题
- `titleLatin` 为原文或英文标题
- `catalogue` 为作品号
- 网页端 work 标题应由 `title / titleLatin / catalogue` 统一拼装

### recording

- 负责“某一具体版本/演出/录音”
- `title` 为规范标题
- `credits` 为一组结构化参与者
- `workTypeHint` 为输入层体裁提示
- `performanceDateText` 与 `venueText` 为展示层常用元数据

## 2. recording 的核心问题与当前规范化方向

当前项目的补丁痕迹主要集中在以下四个点：

1. `workTypeHint` 常量在多个模块重复维护
2. 批量导入模板规则与网页端显示规则未共享来源
3. owner 保存逻辑与网站显示逻辑都有各自的“标题生成”心智模型
4. 某些旧数据仍混用标题字符串与结构化 credit，导致 UI 退回原始 title 时表现不一致

当前清理方向：

- work type 常量统一到 `packages/shared/src/recording-rules.ts`
- batch import / owner / display / retrieval 共用归一化函数
- `recording.title` 由共享显示规则回填
- “显示异常但结构完整”的问题优先改代码
- “credit 缺失或污染”的问题归类为数据清洗

## 3. slug 与 sortKey

- `slug` 与 `sortKey` 属于项目内部派生字段，不属于外部客观事实
- owner 工具应负责统一生成和覆盖
- 用户输入仅作为临时参考，不应视为权威来源

## 4. 关联关系

一级直接关联原则：

- `composer -> work`
- `work -> composer / recording`
- `person -> recording`
- `recording -> work / credited people`

owner 工具的“关联条目跳转”只展示一级直接关联，避免把链路展开成难以维护的图遍历。

## 5. 代码与数据边界

以下问题属于代码规范问题：

- 相同规则在多个文件重复实现
- 标题/副标题拼装规则不统一
- 体裁推断与展示逻辑散落
- owner 与 site 的字段语义不一致

以下问题属于数据清洗问题：

- 版本缺失关键 credit
- 乐团条目仍保留 alias 作为 canonical name
- 旧 title 已写死错误信息
- 人物/团体历史脏 alias 影响自动检查结果

## 6. 后续清理清单

- 清理 `display.ts` 内残留的旧文本拼装辅助函数，继续向 `recording-rules.ts` 收束
- 清理 `schema.ts`、`display.ts`、`automation-checks.ts` 等文件中的编码污染
- 为 `recording` 增加更细的 presentation family 文档与更多真实样本测试
- 逐步把数据层脏标题迁移为结构化 credit + 自动生成 title
