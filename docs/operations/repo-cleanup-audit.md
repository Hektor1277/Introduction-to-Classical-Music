# 仓库清理与工程化重构审计

## 1. 目标
本次清理与重构的目标是把仓库从“源码、运行产物、维护工具、归档资料混放”的状态，整理为适合多人协作的双应用单仓结构：

- `apps/site`：公开静态站点（public static site，公开静态网站）
- `apps/owner`：本地维护工具（owner maintenance tool，维护后台）
- `packages/*`：共享领域逻辑
- `data/*`：结构化真源数据
- `materials/*`：归档、模板、参考材料
- `tools/*`：外挂工具与协议目录
- `docs/*`：架构、运维、计划与交接文档

## 2. 主要迁移映射
### 公开站点
- `src/*` -> `apps/site/src/*`
- `public/*` -> `apps/site/public/*`
- `astro.config.mjs` -> `apps/site/astro.config.mjs`

### owner 维护工具
- `owner/app.js` -> `apps/owner/web/app.js`
- `owner/review-utils.js` -> `apps/owner/web/review-utils.js`
- `owner/styles.css` -> `apps/owner/web/styles.css`
- `owner/index.html` -> `apps/owner/web/index.html`
- `scripts/owner-app.ts` -> `apps/owner/server/owner-app.ts`

### 共享与后端逻辑
- `src/lib/schema.ts` -> `packages/shared/src/schema.ts`
- `src/lib/slug.ts` -> `packages/shared/src/slug.ts`
- `src/lib/display.ts` -> `packages/shared/src/display.ts`
- `src/lib/library-store.ts` -> `packages/data-core/src/library-store.ts`
- `src/lib/indexes.ts` -> `packages/data-core/src/indexes.ts`
- `src/lib/resource-links.ts` -> `packages/data-core/src/resource-links.ts`
- `src/lib/site-content.ts` -> `packages/data-core/src/site-content.ts`
- `src/lib/automation*.ts` -> `packages/automation/src/*`
- `src/lib/batch-import*.ts` -> `packages/automation/src/*`
- `src/lib/recording-retrieval.ts` -> `packages/automation/src/recording-retrieval.ts`

### 数据与资料
- `data/site.json` -> `data/site/config.json`
- `data/articles.json` -> `data/site/articles.json`
- `archive/*` -> `materials/archive/*`
- `template/*` -> `materials/fixtures/templates/*`
- `resources/*` -> `materials/references/*`
- `thread-handoff/*` -> `docs/operations/thread-handoff/*`

## 3. 已清理或改为非入库内容
以下内容已转为本地生成物或运行时产物，不再作为仓库常驻内容：

- `output/site`
- `output/runtime`
- `.astro/*`
- `.playwright-cli/*`
- `node_modules/*`
- `target/*`
- `dist/*`
- `.tmp-owner/*`
- owner 本地日志
- 自动检查运行快照与批量导入临时运行文件

这些内容通过 `.gitignore` 管理，不进入长期版本控制。

## 4. 编码与乱码治理
本轮对仓库执行了统一编码收口，约束如下：

- 源码、配置、文档统一为 `UTF-8`
- 默认不使用 BOM（Byte Order Mark，字节顺序标记）
- 仓库文本文件默认使用 `LF`
- `PowerShell` 与 `cmd` 脚本允许使用 `CRLF`

为避免后续再次出现乱码，仓库新增：

- [`.editorconfig`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/.editorconfig)
- [`.gitattributes`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/.gitattributes)

开发约束：

- 面向用户的页面内容允许中文
- 代码标识符、协议字段、目录名、脚本名统一优先英文 ASCII
- 注释可使用简洁中文，但避免把中文直接塞进关键代码键名
- 读写文件时显式声明 `utf8`

## 5. 外部工具目录
外挂版本检索工具目录固定为：

- [`tools/recording-retrieval-service`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service)

该目录目前已具备三件套文档：

- [`PROJECT_CONTEXT.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROJECT_CONTEXT.md)
- [`README.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/README.md)
- [`PROTOCOL.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tools/recording-retrieval-service/PROTOCOL.md)

这三份文件分别覆盖：

- 背景与边界
- 安装位置与接入要求
- HTTP 协议与结构化数据合同

## 6. Git 重建前的建议流程
如果后续要删除本地 `.git` 并重建远端仓库，建议按以下顺序进行：

1. 先完成当前结构重构与验证
2. 做一次本地备份提交，保留“清洗后的干净基线”
3. 确认 `output/`、日志、临时文件均不在版本控制内
4. 删除 `.git`
5. 在 GitHub 删除旧仓库
6. 重新 `git init`
7. 重新添加远端并推送

这样做不会影响项目本体文件，因为本次重构已经把 Git 元信息与项目结构解耦。

## 7. 当前仍保留在仓库中的特殊目录
- `.github/`：GitHub 仓库配置，不是 Git 历史，也不是垃圾目录
- `.codex/`：Codex 本地环境目录，属于本地工具辅助信息
- `.codex-handoff/`：线程交接包，属于项目运维辅助材料，不参与公开发布
- `materials/archive/`：原始历史资料，不参与运行，但仍有保存价值
- `data/automation/`：本地 owner 运行元数据，仅保留必要结构和最小状态

## 8. 目标树形与物理根目录的差异
本次重构里定义的目标树形，是“需要长期维护和协作的业务目录树”，并不等于“根目录只能有 README 和文件夹”。

对一个可运行的 JavaScript（脚本）/ TypeScript（类型脚本）仓库来说，以下根级文件是正常且必要的：

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.runtime.json`
- `vitest.config.ts`
- `.gitignore`
- `.gitattributes`
- `.editorconfig`

其中：
- `.git` 只有在重建 Git 历史时才删除
- `.github` 不应删除，它是仓库配置
- `.astro`、`node_modules`、`output`、`.playwright-cli` 可以删除并重新生成

## 9. 后续建议
- 在新开发者加入前，优先阅读根 [`README.md`](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/README.md)
- 外部工具开发线程优先阅读 `tools/recording-retrieval-service` 三件套
- 任何后续目录调整都应先更新本文件与根 README，避免仓库语义再次漂移
