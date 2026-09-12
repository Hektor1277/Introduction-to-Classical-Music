# 本机隔离、库协作与发布人工复测

## 目的

验证软件开发、安装版维护、官方 library 更新和站点发布彼此隔离，并验证多人 library 的比较、冲突选择与合并流程。

## 固定路径

- 软件仓库：`F:\personal\Sunhaoran\Introduction to Classical Music\repositories\software\Introduction to Classical Music`
- 官方 library：`F:\personal\Sunhaoran\Introduction to Classical Music\repositories\library\Salon_library`
- 站点仓库：`F:\personal\Sunhaoran\Introduction to Classical Music\repositories\site-deploy\introduction-to-classical-music-site-deploy`
- 安装程序：`F:\personal\Sunhaoran\Introduction to Classical Music\local-install\buquanshu`
- 安装版 AppData：`%APPDATA%\buquanshu`
- 迁移前运行态备份：`C:\Users\HIT-IVAFFR\AppData\Roaming\buquanshu-preinstall-20260912`

安装目录只保存程序文件；用户库保存于 AppData，避免升级、卸载、权限和多用户场景破坏资料。

## 安装与首次启动

1. 关闭旧版不全书和维护工具。
2. 打开安装程序 `F:\personal\Sunhaoran\Introduction to Classical Music\downloads\dev-743204b-34670064107\不全书 Setup 0.1.0.exe`。
3. 将安装位置设为 `F:\personal\Sunhaoran\Introduction to Classical Music\local-install\buquanshu`。
4. 启动不全书，打开“站点维护控制台”。
5. 点击“打开库目录”，确认显示的是 `%APPDATA%\buquanshu\libraries\...`，不是安装目录。
6. 确认默认库为零条真实条目；安装目录下不得出现用户 library。

## 软件开发模式

1. 在 PowerShell 进入软件仓库路径，运行 `npm run desktop:dev`。
2. 确认开发 AppData 位于仓库内 `output/desktop-dev-appdata`，开发库位于 `output/desktop-dev-library`。
3. 新建一个合成作曲家和作品，保存后重启，确认数据仍在开发库。
4. 检查软件仓库 `data/library` 仍为空，官方 library 内容未改变。

## 库导入、改名和导出

1. 在维护工具点击“导入库”，选择 `F:\personal\Sunhaoran\Introduction to Classical Music\repositories\library\Salon_library`。
2. 确认导入后库位于 `%APPDATA%\buquanshu\libraries\...`，这是预期行为。
3. 点击“修改库名称”，改为 `官方资料库-复测`，刷新页面确认名称写入 manifest。
4. 点击“导出库”，选择 `1`，再选择 `F:\personal\Sunhaoran\Introduction to Classical Music\staging`，确认生成单文件 `.icmlibrary` 压缩包并能重新导入。
5. 再次点击“导出库”，选择 `2`，确认生成可审计目录包；目录只包含 `library.manifest.json`、`content` 和 `assets`。
6. 点击“导出库”并直接选择已有 `Salon_library`，确认工具自动识别 Git 仓库、保留 `.git`，并生成带时间戳的 `.backup-*` 目录。
7. 分别导入单文件压缩包和目录包，确认内容、实体数量和 library ID 一致。
8. 编辑一条测试记录、重启安装版，确认安装版数据持久化；开发版数据不变。

## 多人 library 比较与合并

1. 使用维护工具将当前库导出为库 A。
2. 复制库 A 为库 B，并使用预置复测 fixture（若版本提供）替换 B 的内容；fixture 应包含一条同 ID 不同字段记录、一条 B 独有记录和一条完全相同记录。
3. 在维护工具点击“检查/合并库”，选择库 B。
4. 确认报告显示“对方新增、本地独有、完全相同、字段冲突”。
5. 取消合并，刷新并确认本地无变化。
6. 再次比较并确认合并；默认冲突保留本地值，新条目加入本地。
7. 对需要覆盖的冲突选择对方字段，应用后确认字段值、关系和索引正确。
8. 检查当前库旁的 `merge-backups` 时间戳快照；必要时关闭程序，用快照恢复后重新打开。

预置压缩库位于软件仓库的 `docs/manual-fixtures/library-a.icmlibrary` 和 `docs/manual-fixtures/library-b.icmlibrary`；对应目录包为 `library-a-directory.icmlibrary` 和 `library-b-directory.icmlibrary`。直接在“导入库”中选择文件或目录即可。A 与 B 共用作曲家、作品和一个版本；B 额外包含一条作品，并修改共享版本标题。

`.icmlibrary` 是统一的 library 载体：既可以是便于分享的 ZIP 压缩单文件，也可以是便于 Git 审查的目录包。二者内部结构完全一致，维护工具自动识别。

## 官方 library 更新（维护者无命令行流程）

1. 仅在安装版当前工作库编辑真实资料。
2. 点击“导出库”，直接选择 `F:\personal\Sunhaoran\Introduction to Classical Music\repositories\library\Salon_library`；所选格式不会改变官方仓库处理方式。
3. 工具先校验 manifest、JSON、资源路径，并在目标目录旁生成备份；失败时不替换目标。
4. 打开 `Salon_library` 检查差异，确认只出现源资料变更。
5. 使用 GitHub Desktop 或网页提交并推送 `Salon_library`，不需要运行脚本。
6. 确认 `Salon_library` 不包含 `build`、`runtime`、`exports`。

## 站点发布（维护工具流程）

1. 在维护工具点击“导出网站”。
2. 选择站点仓库的目标目录，例如 `F:\personal\Sunhaoran\Introduction to Classical Music\repositories\site-deploy\introduction-to-classical-music-site-deploy\staging\current`。
3. 工具在独立临时目录构建，完成后原子替换目标目录，避免半成品覆盖站点。
4. 检查首页、搜索、目录、录音页、图片、CSS 和 404 页面。
5. 使用 GitHub Desktop 或网页将 staging 内容整理到站点仓库的 `main` 或 `pages`，再提交推送。

## 互不影响验收

- 修改开发版代码不会改变安装版工作库、官方源库或站点 staging。
- 修改安装版工作库不会改变开发版代码、`data/library` 或开发 AppData。
- 重新生成默认库快照后，默认库仍为空；不得从官方 library 反向复制。
- 任一步骤失败时停止删除，保留归档和快照，依据 `docs/plans/2026-09-11-repository-library-installation-isolation.md` 回滚。
