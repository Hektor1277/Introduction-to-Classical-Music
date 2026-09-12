# 本机目录布局

## 目录职责

- `repositories/software/Introduction to Classical Music`：公开软件仓库，开发分支为 `dev`。
- `repositories/library/Salon_library`：官方 source-only library，主分支为 `main`。
- `repositories/site-deploy/introduction-to-classical-music-site-deploy`：站点归档与 Pages 发布仓库。
- `runtime/official-working`：安装版维护工作库的迁移备份；正式安装后工作副本位于新的 `buquanshu` AppData。
- `release-default-library`：由公开软件仓库构建的空默认库快照。
- `archives/private`、`archives/public`、`archives/library-source-only`：只读历史归档。

## 安装前清理状态

旧运行态已从 `buquanshu` 改名为带日期的预安装备份目录，安装版不会读取该目录。完成人工复测并确认回滚窗口关闭后，再由人工删除该备份。

旧工作区因检索服务临时目录仍被进程占用，保留为迁移残留；关闭相关进程后可再次核对并清理。

## 日常边界

软件开发只在软件仓库进行；资料编辑只在安装版工作副本进行；站点只接收经过审计的 staging 输出。任何一个仓库都不应直接引用另一个仓库的运行态目录。
