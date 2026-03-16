# Recording Retrieval Service 本地开发与 Git 隔离建议

## 1. 当前推荐结构
当前父项目只跟踪以下内容：

- 接口协议
- 项目背景说明
- 与 owner 的集成约束

这些文件位于：

- [`README.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/README.md)
- [`PROJECT_CONTEXT.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROJECT_CONTEXT.md)
- [`PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)

为了让 `Recording Retrieval Service`（版本自动检索工具）可以在父仓库子目录中独立开发，当前建议把实际实现代码放在：

- `tools/recording-retrieval-service/app/`

这个 `app/` 目录应作为**独立项目**管理，而不是继续并入父仓库主线。

## 2. 为什么不建议继续直接并入父仓库
如果把外部工具实现直接混在父仓库里，会带来这些问题：

- 版本演进被父项目提交历史绑死
- 独立发布和单独运行不方便
- 外部工具的缓存、依赖、日志容易污染父项目
- 后续如果想把该工具单独开源或单独交付，会增加迁移成本

## 3. 当前推荐方案
当前阶段推荐采用“**父仓库跟踪文档，子目录独立 Git 仓库管理实现**”的方式：

1. 父仓库保留 `tools/recording-retrieval-service/` 下的协议和集成文档
2. 真实实现代码进入 `tools/recording-retrieval-service/app/`
3. `app/` 内部单独 `git init`
4. `app/` 使用自己的远端仓库、自己的 `.gitignore`、自己的发布节奏
5. 父仓库通过本地路径和 HTTP 协议与它协作，而不是通过源码直接耦合

## 4. 父仓库如何处理这个子项目
父仓库应忽略以下目录：

- `tools/recording-retrieval-service/app/`
- `tools/recording-retrieval-service/cache/`
- `tools/recording-retrieval-service/logs/`
- `tools/recording-retrieval-service/downloads/`
- `tools/recording-retrieval-service/node_modules/`
- `tools/recording-retrieval-service/dist/`
- `tools/recording-retrieval-service/output/`

这样父仓库只保留“接口和说明”，不接管“外部工具实现本体”。

## 5. 子项目初始化建议
在 `tools/recording-retrieval-service/app/` 中执行：

```bash
git init -b main
git add .
git commit -m "chore: initialize recording retrieval service"
git remote add origin <你的外部工具仓库地址>
git push -u origin main
```

这样它就会变成一个嵌套在父项目目录里的独立 Git 仓库。

## 6. 后续是否要改为 submodule（子模块）
长期来看，如果你希望父项目固定依赖某个外部工具版本，最规范的做法是把 `app/` 进一步升级为 Git submodule（子模块）。

但当前阶段并不强制。因为你还在快速开发外部工具，先用“独立仓库 + 父仓库忽略实现目录”会更灵活。

## 7. 结论
当前建议不是“把整个 `tools/recording-retrieval-service` 变成子仓库”，而是：

- 父仓库保留 `tools/recording-retrieval-service/` 作为集成与协议外壳
- 子项目实现落在 `tools/recording-retrieval-service/app/`
- `app/` 使用独立 Git 管理

这样既保留了父项目中的接口文档，也保证了外部工具的独立开发与独立运行。
