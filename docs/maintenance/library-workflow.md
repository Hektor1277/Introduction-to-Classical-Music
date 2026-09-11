# 资料库工作流

## 角色

- `<workspace-root>\Salon_library` 是私有官方源资料库。
- 安装版只操作 `buquanshu` AppData 中的 `official-working` 工作副本。
- 本仓库的 `data/library` 永远是空发行种子，不得写入真实条目。

## 源资料库结构

官方仓库只提交：

```text
library.manifest.json
content/library/
content/site/
assets/legacy/
assets/managed/
```

`build/`、`runtime/` 和 `exports/` 是可重建产物，不作为官方源资料提交。

## 更新顺序

1. 从 `Salon_library` 导入或更新安装版工作副本。
2. 在安装版维护工具中编辑、审查并构建本地站点。
3. 导出完整工作 bundle 到外部暂存目录。
4. 执行 `node scripts/audit-library-bundle.mjs --root <export> --mode working`。
5. 执行 `node scripts/sync-library-source.mjs --source <export> --target <Salon_library>` 做只读差异预览。
6. 人工确认后加 `--apply`，再在 `Salon_library` 中提交和推送。

同步脚本只复制 manifest、content 和 assets，并在目标目录外创建时间戳备份；它不会替用户提交或推送。

## 默认库

默认库由本仓库空 JSON 重新生成。发布快照应放在仓库外的版本目录，并通过 manifest 记录软件版本、构建时间和摘要；默认库快照不可手工编辑。
