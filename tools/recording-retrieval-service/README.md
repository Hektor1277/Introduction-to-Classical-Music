# Recording Retrieval Service

本目录用于安装外部本地服务 `Recording Retrieval Service`，中文名统一为“版本自动检索工具”。

## 目录用途
- 存放外部工具自己的代码、依赖、缓存、日志和下载产物。
- 不得直接读写主项目的 `apps/`、`packages/`、`data/` 或 `apps/site/public/`。
- owner 与该工具的唯一正式集成面是本地 HTTP 协议，见 [`PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)。

## 阅读顺序
1. [`PROJECT_CONTEXT.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROJECT_CONTEXT.md)
2. [`PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)
3. 本文件

## owner 侧默认约定
- 句柄：`recording-retrieval-service`
- 运行形态：本地常驻 HTTP 服务
- 默认地址：`http://127.0.0.1:4780`
- 协议版本：`v1`

## 推荐目录结构
```text
tools/recording-retrieval-service/
  README.md
  PROJECT_CONTEXT.md
  PROTOCOL.md
  app/
  cache/
  logs/
  downloads/
```

## owner 调用前提
- 目录存在。
- 服务已启动。
- `GET /health` 可达。
- `protocolVersion === "v1"`。

## 非目标
- 不直接修改项目数据文件。
- 不直接写入 owner 的 `AutomationRun`。
- 不直接维护候选审查状态。
- 不直接解析批量导入模板文本。
