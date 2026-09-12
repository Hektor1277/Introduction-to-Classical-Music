# 本机隔离与多人资料库人工复测

## 目的

验证软件开发、安装版维护、官方 library 更新和站点发布彼此隔离，并验证多人 library 的比较、冲突选择与合并流程。

## 前置条件

- 使用公开软件仓库 `dev` 构建安装包；公开 `data/library` 必须为空。
- 官方源库为本机工作区中的 `Salon_library`，安装版工作库为应用数据目录下的 `buquanshu/libraries/official-working`。
- 先备份工作库和站点 staging；测试产生的临时目录不得提交到 Git。

## 软件开发模式

1. 在仓库内启动开发版，确认开发 AppData 位于 `output/desktop-dev-appdata`，开发库位于 `output/desktop-dev-library`。
2. 新建一个合成作曲家和作品，保存后重启，确认数据仍在开发库。
3. 检查 `data/library` 仍为空，官方 `Salon_library` 内容未改变。

## 安装版模式

1. 卸载旧安装并安装公开 release 安装包。
2. 首次启动确认默认库无真实条目，仅有默认结构和使用手册。
3. 导入 `Salon_library` 到 `official-working`，确认实体数量与 manifest 一致。
4. 编辑一条测试记录并重启，确认安装版数据持久化；开发版数据不变。

## 多人 library 比较与合并

1. 从安装版导出本地库 A，再复制为库 B；在 B 中新增条目，并修改 A 中一条记录的一个字段。
2. 在维护工具点击“检查/合并库”，选择 B，确认报告显示：对方新增、本地独有、完全相同和字段冲突数量。
3. 取消合并，确认本地无变化。
4. 再次比较并确认合并；默认冲突保留本地值，新条目加入本地。
5. 对需要覆盖的冲突选择对方字段，应用后确认字段值、关系和索引正确。
6. 检查 `merge-backups` 下生成时间戳快照；必要时用快照恢复并重新构建。

## 官方 library 更新

1. 仅在安装版 `official-working` 编辑真实资料。
2. 导出到 staging，运行 `npm run library:audit -- --root <staging> --mode working`。
3. 对 `Salon_library` 执行同步 dry-run，人工核对差异后再显式 `--apply`。
4. 在 `Salon_library` 提交并推送；确认本地与远端提交一致，源库不含 `build/runtime/exports`。

## 站点发布

1. 使用安装版从官方工作库构建根路径站点，导出到独立 staging。
2. 在站点仓库运行 `stage-site.ps1 -SourceSiteDir <staging>`，确认只生成 `site/vX` 和 `site/current`。
3. 运行 `publish-pages.ps1` dry-run，检查子路径链接、404、图片和 CSS；确认无本机路径、密钥或测试链接。
4. 人工确认后使用 `-Publish` 推送 `pages`，根路径 `main` 发布按同一 library commit 记录 manifest。

## 互不影响验收

- 修改开发版代码不会改变安装版工作库、官方源库或站点 staging。
- 修改安装版工作库不会改变开发版代码、`data/library` 或开发 AppData。
- 重新生成默认库快照后，默认库仍为空；不得从官方 library 反向复制。
- 任一步骤失败时停止删除，保留归档和快照，依据 `docs/plans/2026-09-11-repository-library-installation-isolation.md` 回滚。
