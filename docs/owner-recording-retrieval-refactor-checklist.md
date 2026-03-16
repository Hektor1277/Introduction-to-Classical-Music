# 维护工具版本自动检查外置化改造清单

## 目标
- 将 `recording（版本）` 自动检查从 owner 内部规则实现中剥离。
- owner 仅负责版本种子数据生成、外部服务调用、状态暴露、候选审查与最终应用。
- 外部工具统一命名为 `Recording Retrieval Service`，中文名“版本自动检索工具”，句柄 `recording-retrieval-service`。

## 已落地改造
- 新增协议与 HTTP client：[`src/lib/recording-retrieval.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/src/lib/recording-retrieval.ts)
- `runAutomationChecks()` 新增 provider（提供者）抽象，`recording` 检查必须显式提供 provider。
- owner 后端新增本地 provider 配置读取：[`src/lib/automation-store.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/src/lib/automation-store.ts)
- owner API 在以下入口统一接入 provider：
  - [`scripts/owner-app.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/owner-app.ts) `/api/automation/jobs`
  - [`scripts/owner-app.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/owner-app.ts) `/api/automation/check`
  - [`scripts/owner-app.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/owner-app.ts) `/api/automation/entity-check/:entityType/:id`
  - [`scripts/owner-app.ts`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/owner-app.ts) `/api/batch-import/:sessionId/check`
- `AutomationRun` 新增可选 `provider` 状态，便于前端与日志暴露外部阶段。
- 批量导入已收窄为 `recording-only`：
  - 必须先选择 `composerId`
  - 必须先选择 `workId`
  - 必须指定 `workTypeHint`
  - 不再在 batch 中创建 `composer/person/work` 草稿
- owner 批量导入 UI 已新增：
  - 批量作曲家下拉
  - 批量作品下拉
  - 版本模板下拉
- 模板文件已重写为严格 `|` 分隔格式。

## 当前 owner 内部边界
- owner 负责：
  - 文本模板校验
  - 粗版本条目生成
  - `RecordingRetrievalRequest` 构造
  - provider 健康检查与任务轮询
  - 结构化结果翻译为 `AutomationProposal`
  - 候选审查与应用
- owner 不再负责：
  - 版本链接抓取
  - 版本元数据聚合
  - 版本候选图片发现
  - 版本级 LLM 字段仲裁

## 批量导入新合同
- 输入前置条件：
  - 用户先在 owner 中手工建立并确认作曲家、作品
  - 在 batch 面板顶部先选择作曲家与作品
- 支持模板：
  - `orchestral`: `指挥 | 乐团 | 年份 | 链接列表`
  - `concerto`: `独奏者 | 指挥 | 乐团 | 年份 | 链接列表`
  - `opera_vocal`: `指挥 | 主演/卡司 | 乐团/合唱 | 年份 | 链接列表`
  - `chamber_solo`: `主奏/组合 | 协作者 | 年份 | 链接列表`
- 约束：
  - 每行一个版本
  - 缺失值必须写 `-`
  - 链接列表使用英文逗号分隔
  - owner 不再推断父实体

## owner 与外部工具交互要点
- owner 构造 `requestId`
- owner 按 `recordingId -> itemId` 一一映射
- owner 只接受协议 `v1`
- owner 对以下结果整批拒收：
  - 缺失 `itemId`
  - 重复 `itemId`
  - 协议版本不匹配
  - 非法字段类型
- owner 不会在 provider 不可用时回退到旧本地 recording auto-check

## 后续待做
- 在 owner UI 中增加 provider 配置面板与健康状态显示
- 在任务看板中可视化 `providerPhase/providerStatus/providerLogs`
- 为 batch review 区补充 source line 与 provider warning 摘要
- 当外部工具上线后，补 owner 真实浏览器联调：
  - 单版本自动检查
  - 批量版本检查
  - provider 不可用/超时/partial 三类异常路径
