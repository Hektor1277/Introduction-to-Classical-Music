# Introduction to Classical Music

这是一个“公开静态站点（public static site，公开静态网站） + 本地 owner 维护工具（maintenance tool，维护后台） + 本地结构化数据（structured local data，结构化本地数据）”组成的项目。

公开站点只面向读者发布静态内容；owner 只在维护者本机运行，负责录入、审查、批量导入、自动检查与专栏管理。项目的正式数据真源始终是仓库中的结构化数据文件，而不是构建产物或外部服务。

## 仓库结构
```text
.
├─ apps/
│  ├─ site/                         # Astro 公开站点源码与静态资源
│  └─ owner/
│     ├─ server/                   # owner 本地服务入口与 API 组装层
│     └─ web/                      # owner 前端页面、脚本、样式
├─ packages/
│  ├─ shared/                      # 共用 schema、slug、显示格式化等基础能力
│  ├─ data-core/                   # 数据读写、索引、站点内容、目录逻辑
│  └─ automation/                  # 自动检查、批量导入、任务编排、外部检索客户端
├─ data/
│  ├─ library/                     # 核心实体数据
│  ├─ site/                        # 站点配置与专栏源数据
│  └─ automation/                  # owner 运行态元数据与本地设置
├─ materials/
│  ├─ archive/                     # 历史原始资料归档，如 rar/chm
│  ├─ fixtures/                    # 模板、样例、测试素材
│  └─ references/                  # 非运行时参考材料
├─ tools/
│  └─ recording-retrieval-service/ # 外部版本自动检索工具接口与背景文档
├─ docs/                           # 架构、运维、计划与交接文档
├─ scripts/                        # 仓库级脚本
├─ tests/
│  ├─ unit/                        # 单元测试
│  ├─ integration/                 # 集成测试
│  └─ e2e/                         # 端到端测试
└─ output/                         # 本地构建产物，不入库
```

上面的树形是“核心业务结构（core repository structure，核心仓库结构）”，不是把所有本地缓存、包管理器清单和仓库配置文件都省掉后的物理文件列表。一个可运行的 TypeScript（类型脚本）/ Astro 仓库仍然需要保留根级配置文件，例如 `package.json`、`package-lock.json`、`tsconfig*.json`、`vitest.config.ts`、`.gitignore`、`.gitattributes`、`.editorconfig`。

## 前台与后台职责
- `apps/site`：公开站点源码。只生成静态内容，可部署到任意静态托管平台。
- `apps/owner`：本地维护工具。不对公网开放，只供维护人员在本机使用。
- `packages/*`：前后台共享的领域逻辑，避免站点与 owner 出现双份实现。
- `data/*`：项目运行时的结构化真源数据。
- `materials/*`：与项目相关但非核心运行时的归档资料、模板、样例和参考文本。

## 数据与构建产物
- `data/library/*.json`：作曲家（composer）、人物（person）、作品（work）、版本（recording）等核心实体。
- `data/site/config.json` 与 `data/site/articles.json`：站点配置与专栏数据。
- `data/automation/`：owner 自动检查与批量导入的本地运行状态。
- `output/site`：公开站点构建结果。
- `output/runtime`：TypeScript 运行时代码的编译结果。

构建产物默认不入 Git（Git 版本控制），发布时由本地或 CI（continuous integration，持续集成）重新生成。

## 常用命令
```bash
npm ci
npm run runtime:build
npm run owner
npm run build:indexes
npm run build
npm test -- --runInBand
```

## 快捷启动入口
为了便于本地联调，仓库提供了两个 Windows（视窗）快捷脚本：

- [`start-site.cmd`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/start-site.cmd)：启动公开站点开发服务并自动打开 `http://127.0.0.1:4321`
- [`start-owner.cmd`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/scripts/start-owner.cmd)：启动 owner 维护工具并自动打开 `http://127.0.0.1:4322`

如果本地没有安装依赖，先执行一次 `npm ci`。

## 外部版本自动检索工具
`recording`（版本）自动检查已经从 owner 内部剥离，统一通过 [`tools/recording-retrieval-service`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service) 目录约定的本地 HTTP 服务完成。

首次接入或新线程开发时，建议按这个顺序阅读：
- [`PROJECT_CONTEXT.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROJECT_CONTEXT.md)
- [`README.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/README.md)
- [`PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)
- [`GIT_AND_WORKSPACE.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/GIT_AND_WORKSPACE.md)

## 编码与开发约定
- 所有源码、配置、文档统一使用 `UTF-8` 编码，默认不使用 BOM（Byte Order Mark，字节顺序标记）。
- 代码中的标识符、协议字段名、文件名、目录名优先使用英文 ASCII（American Standard Code for Information Interchange，美国信息交换标准代码）字符。
- 面向用户展示的内容可以使用中文；必要时允许在注释中使用简洁中文说明，但代码键名、API 字段和脚本名不要混入中文。
- 新增文件时，优先采用“英文命名 + 中文注释”的方式，减少跨平台编码和终端显示问题。
- 不要使用来源不明的批量转码工具直接覆盖项目文件；若需要脚本读写文本，请显式指定 `utf8`。
- 在 PowerShell（命令行）里处理含中文文件时，优先使用项目脚本或受控编辑，避免因为默认代码页导致乱码。
- 构建产物、运行日志、临时目录、下载缓存不入库。
- 对外发布的公开站点与本地 owner 工具必须继续隔离，owner 永不直接发布到公网。
- 仓库根部的 [`.editorconfig`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/.editorconfig) 与 [`.gitattributes`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/.gitattributes) 是编码与换行的基础约束，新增文件前应遵守它们。

## 团队协作要求
- 根目录只保留高层目录和仓库级配置，避免把临时文件、日志、资料散落在根部。
- 历史资料、原始文档、样例与参考材料统一放入 `materials/`。
- 外部服务只提供建议和结构化补全结果，不得直接改写项目数据。
- 合并前至少执行一次运行时构建与测试，确保结构重构没有破坏现有命令入口。

## 根目录中仍会出现的隐藏目录
- `.git`：Git 本地版本库元数据。只有在你决定彻底重建 Git 历史时才删除它。
- `.github`：GitHub 仓库配置目录，例如 Actions（自动工作流）配置。它不是 Git 历史，不应该随 `.git` 一起删除。
- `.codex`：Codex 本地环境配置目录，属于本地工具痕迹，不属于业务源码。
- `.codex-handoff`：线程交接包目录，属于本地运维辅助材料，不属于公开发布内容。

像 `.astro`、`.playwright-cli`、`node_modules`、`output` 这类目录属于本地缓存、依赖或构建产物，已经不再是仓库正式结构的一部分，可以随时删除并重新生成。

## 相关文档
- 仓库结构说明：[`docs/architecture/repo-structure.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/docs/architecture/repo-structure.md)
- 清理与迁移审计：[`docs/operations/repo-cleanup-audit.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/docs/operations/repo-cleanup-audit.md)
- 外部工具背景：[`tools/recording-retrieval-service/PROJECT_CONTEXT.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROJECT_CONTEXT.md)
- 外部工具协议：[`tools/recording-retrieval-service/PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)
