# 本机仓库、安装与资料库隔离整理计划 v1

## 一页结论

- **公开软件仓库**作为唯一软件开发来源，建立公开 `dev` 分支，`main` 只接受经过验证的发行合并。
- **`Salon_library`**作为唯一官方资料库来源，改为只保存源资料、结构化数据和资源，不再把 `build/`、`runtime/`、`exports/` 当作真源。
- 安装版只操作独立的持久工作副本；完成编辑后导出到暂存目录，经审计后再同步到 `Salon_library`。
- **根域名站点**作为正式站点产物，GitHub Pages（GitHub 静态站点托管）`pages` 分支作为镜像发布面。
- 旧私有软件仓库及本地归档暂时保留为只读历史，不立即删除；旧 AppData（Application Data，应用数据目录）资料库在完成验证后清理。
- 公开仓库的 `data/library` 始终为空，默认库只能由公开仓库重新生成，禁止从官方 library 反向复制。

## 已确认事实

- 当前根目录已是公开仓库 `main=8479ddc`，工作树干净，见公开软件仓库根目录。
- 私有开发仓库与公开仓库没有共同提交祖先，且存在大量私有专属数据、历史资料和旧工具，不能整体合并。
- 旧私有工作区已保存于 `<private-archive-root>`；Git 历史另存为 `private-repository-all-refs.bundle`。
- 远端 [私有开发仓库](https://github.com/Hektor1277/Introduction-to-Classical-Music-dev) 已设置为 Archived。
- 远端 `Salon_library` 比本地完整副本更干净：本地多出测试专栏、7 个测试图片和旧构建文件。
- 现有公开软件的默认库构建脚本和公开边界测试已经提供空库保护。
- 站点仓库当前仍使用 `main` 归档和 `pages` 发布，流程见 `<site-deploy-root>/docs/release-workflow.md`。

## 阶段一：整理软件仓库

### 保留与迁移规则

- 公开仓库中继续保留并作为当前事实源：
  - `docs/rules/*`
  - `docs/data-rules.md`
  - `materials/references/*`
  - `materials/fixtures/templates/*`
  - 版本检索服务的 `README.md`、`PROJECT_CONTEXT.md`、`PROTOCOL.md`
  - 当前公开发布、许可和安全文档
- 旧私有仓库中的 `docs/plans/*`、`docs/operations/*`、旧交接文档整体留在历史归档，不批量复制。
- 原始 `rar/chm/txt` 资料、旧 `OwnerLauncher`、旧路径脚本和旧构建文件只作为历史材料保存。
- 本地 library 中的测试专栏和测试图片不进入官方 library；确有测试价值的内容才转换为匿名 fixture（测试夹具）。

### 公开开发分支

- 从当前公开 `main` 创建公开 `dev` 分支。
- 功能分支从 `dev` 创建，经过 CI（Continuous Integration，持续集成）后合并到 `dev`。
- `main` 只接受经过完整检查的发布合并，不直接承载实验资料。
- `dev` 允许合成数据、模拟 JSON 和测试图片，但禁止真实 library、私人图片、运行日志、绝对路径和密钥。
- 为 `main` 配置 GitHub ruleset（仓库规则集）；若当前组织权限不支持分支保护，至少由 CI 和发布清单强制执行同样的门禁。

### 软件与开发运行态隔离

修改桌面启动逻辑，使：

- 打包版使用 Electron（桌面应用框架）默认的 `buquanshu` 用户数据目录；
- 非打包开发版使用仓库内独立的 `output/desktop-dev-appdata`；
- 开发版默认库使用 `output/desktop-dev-library`；
- 开发版和安装版不共享 Cookie、日志、库状态或缓存。

为此调整：

- `apps/desktop/main.ts`
- `packages/data-core/src/app-paths.ts`
- 对应桌面启动和路径单元测试

## 阶段二：整理官方 `Salon_library`

### 官方基线

以远端 [Salon_library `main`](https://github.com/introduction-to-classical-music/Salon_library) 为唯一基线，在本机建立：

`<workspace-root>\Salon_library`

不把本地旧副本直接覆盖远端，也不把本地测试内容自动合并进去。

### 源资料库结构

官方仓库只跟踪：

```text
library.manifest.json
content/library/*.json
content/site/*.json
assets/legacy/**
assets/managed/**
```

以下内容移出 Git 跟踪并放入本地隔离归档：

```text
build/
runtime/
exports/
```

原因是这些目录可由源资料重建，当前远端和 Pages 产物已经证明它们容易发生漂移。

### 新增校验能力

在公开软件仓库增加 library 运维脚本：

```text
scripts/audit-library-bundle.mjs
scripts/sync-library-source.mjs
scripts/export-site-release.mjs
```

接口约定：

```text
audit-library-bundle.mjs
  --root <library-root>
  --mode source|working

sync-library-source.mjs
  --source <exported-working-copy>
  --target <Salon_library>
  [--apply]

export-site-release.mjs
  --source <working-copy>
  --out <staging-dir>
  --base /
```

默认行为必须是只读审计和差异报告；只有显式传入 `--apply` 才允许覆盖目标目录。同步前必须：

- 检查目标 Git 工作树干净；
- 校验 manifest、JSON schema、资源路径和禁止内容；
- 生成时间戳备份；
- 输出实体数量、文件摘要和差异清单；
- 不自动执行 `git commit` 或 `git push`。

保留现有通用 bundle 导入/导出能力，同时新增 source-only 导出接口，避免把 `build/runtime/exports` 导回官方源库。

## 阶段三：清理本地 library

### 只保留两个运行角色

1. **官方源库**：`<workspace-root>\Salon_library`
2. **干净默认库快照**：由公开仓库构建生成，存放在仓库外的版本化暂存目录，例如：

   `<workspace-root>\release-default-library\v0.1.1`

默认库快照带有独立 `release-manifest.json`，记录：

- 软件版本；
- 构建时间；
- 默认库 schema 版本；
- 文件摘要。

默认库快照不可手工编辑；发布前总是从公开仓库空 JSON 重建。

### 安装版持久工作副本

安装版使用自己的 `buquanshu` AppData，在其中只保留一个明确命名的工作库，例如：

```text
%APPDATA%\buquanshu\libraries\official-working
```

流程为：

1. 从 `Salon_library` 导入源资料；
2. 安装版只编辑该 AppData 工作副本；
3. 编辑和构建完成后，从安装版导出到外部 staging（暂存目录）；
4. 运行 `audit-library-bundle.mjs`；
5. 运行 `sync-library-source.mjs` 的 dry-run；
6. 人工确认差异后使用 `--apply`；
7. 在 `Salon_library` 提交并推送。

### 删除冗余副本

先把以下旧目录移动到带 manifest 和摘要清单的隔离归档：

- `不全书-个人资料库-开发工作区`
- `我的资料库-3`
- `默认资料库`
- `默认资料库-2`
- `我的资料库`
- `我的资料库-2`
- 旧 `default-library`

完成一次完整导入、导出、构建和网站发布后，删除这些隔离副本，只保留：

- `Salon_library`；
- 安装版 `official-working`；
- 干净默认库快照。

旧 `introduction-to-classical-music` AppData 整体运行态、旧 `buquanshu` 缓存和 updater（更新器）残留也在同一轮验收后清理。删除前保留清单和压缩备份。

## 阶段四：站点部署管理

### 正式产物

采用“根域名主站 + Pages 镜像”：

- 安装版构建根路径 `/` 的站点；
- 站点部署仓库 `main` 保存根路径版本归档：
  - `site/v0.1.1`
  - `site/current`
- Pages 使用同一资料库生成的子路径版本：
  - `/introduction-to-classical-music-sites/`

两种构建必须有独立输出目录，不能把同一份 HTML 同时当作根域名版和 Pages 版。

### 站点仓库脚本

改造现有 `stage-site.ps1`：

- 接受明确的 `-SourceSiteDir`；
- 不再依赖固定本机路径；
- 复制前执行源目录审计；
- 先复制到临时目录，再原子替换 `site/vX` 和 `site/current`；
- 自动写入站点发布 manifest。

新增 `publish-pages.ps1`：

- 从已审计 staging 目录创建临时 `pages` 工作树；
- 同步 `.nojekyll`、HTML、CSS、图片和 404 页面；
- 检查根路径与子路径链接；
- 默认只生成差异；
- 只有显式 `-Publish` 才提交并推送 `pages`；
- 发布提交信息包含 library commit、软件版本和构建摘要。

GitHub Actions 不直接访问私有 `Salon_library`，避免跨仓库凭据和私有资料泄漏。

### 站点发布 manifest

每个站点版本记录：

```json
{
  "libraryId": "...",
  "libraryCommit": "...",
  "appVersion": "...",
  "builtAt": "...",
  "siteBase": "/",
  "sourceDigest": "...",
  "siteDigest": "..."
}
```

## 阶段五：验证与回滚

### 必须通过的测试

- 公开 `main` 和 `dev` 的所有 library JSON 仍为空；
- 开发版与安装版 AppData 路径不同；
- 安装版导入/导出 Unicode 路径成功；
- source-only library 缺少 `build/runtime` 时仍可正常导入并重新构建；
- 官方 library 同步前后实体数量、资源摘要和 manifest 一致；
- 根路径站点与 Pages 子路径站点都能访问首页、搜索、目录、录音页、图片和 404；
- 站点审计不出现本地路径、测试链接、私有目录或密钥；
- 从公开 `main` 打包得到的安装包不包含官方 library 条目；
- 修改安装版工作副本后，开发版 `data/library` 和开发版 AppData 均不发生变化；
- 修改开发版代码后，安装版工作副本和 `Salon_library` 均不发生变化。

### 回滚条件

出现以下任一情况时停止删除：

- `Salon_library` 与本地克隆摘要不一致；
- 导入/导出丢失实体或资源；
- 安装版仍写入开发目录；
- Pages 站点与根域名站点内容不一致；
- 默认库出现非空实体；
- 站点审计失败。

回滚来源为：

- `private-repository-all-refs.bundle`；
- 旧 library 隔离归档；
- `archive/*` Git 标签；
- 站点仓库的历史版本目录；
- GitHub 远端 Archived 私有仓库。

## 执行顺序

1. 创建公开 `dev` 分支并加入空库边界检查。
2. 修复开发版与安装版 AppData 隔离。
3. 克隆并校验 `Salon_library`。
4. 将 `Salon_library` 整理为 source-only 结构。
5. 建立安装版持久工作副本和 source-only 导出流程。
6. 归档并清理旧 AppData library。
7. 增加根域名站点导出和 Pages 发布脚本。
8. 完成一次完整回归发布。
9. 验证成功后再删除旧本地冗余副本；旧私有远程继续 Archived，除非另行提出删除请求。

以上计划不把公开软件、官方 library、安装运行态和站点产物混入同一个 Git 工作树，后续每一类内容都有独立的源、构建输出、审计和回滚边界。
