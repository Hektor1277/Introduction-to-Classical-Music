# 站点发布工作流

## 两种站点产物

- 根路径 `/`：安装版构建的正式站点，进入站点部署仓库 `site/v<version>` 和 `site/current`。
- `/introduction-to-classical-music-sites/`：由同一资料库在隔离输出目录重新构建的 GitHub Pages 镜像。

两种产物不能共用同一输出目录，因为 Astro 的基础路径不同。

## 本地流程

1. 使用 `scripts/export-site-release.mjs` 从已审计的工作副本生成根路径站点。
2. 使用站点仓库 `stage-site.ps1 -SourceSiteDir <site> -Version <version>` 归档版本并更新 `current`。
3. 运行 `audit-site.ps1`，检查本地地址、测试链接、绝对路径和资源引用。
4. 使用 `publish-pages.ps1` 生成 Pages 子路径产物；默认只显示差异。
5. 人工确认后加 `-Publish` 推送 `pages` 分支。

## 发布记录

每个版本必须保存 library ID、library 提交、软件版本、构建时间、site base 和源/站点摘要。站点仓库不保存桌面源码、安装包或资料库源 JSON。
