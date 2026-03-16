# 项目启动前检查清单（Preflight Checklist）

最后更新：2026-03-13

## 1. 项目事实
- 项目名称：`Introduction to Classical Music`
- 项目类型：`Astro + TypeScript` 静态站点，附带本地维护工具 `owner tool`（`Express + 原生前端`）
- 项目根目录：`E:\Workspace\codex\Introduction to Classical Music`
- 推荐操作系统：`Windows native`（Windows 原生）
- 推荐终端：`PowerShell`
- 常用命令：
  - 站点开发：`npm run dev`
  - 维护工具：`npm run owner`
  - 运行时编译：`npm run runtime:build`
  - 测试：`npm test`

## 2. 当前机器已验证状态
- `node -v`：`v22.17.1`
- `npm -v`：`10.9.2`
- `python --version`：`Python 3.13.5`
- `npm run runtime:build`：已通过
- Chrome 路径 `C:\Program Files\Google\Chrome\Application\chrome.exe`：存在
- 项目目录读写：正常，本次已成功写入 `docs/` 与用户级环境变量
- `rg`（`ripgrep`）：
  - 已确认 Codex 内置 `rg.exe` 位于 WindowsApps 路径，直接执行会报 `Access is denied`
  - 已执行自愈，工作副本已写入 `C:\Users\HIT-IVAFFR\.codex\bin\rg.exe`
  - 已把 `C:\Users\HIT-IVAFFR\.codex\bin` 提前到用户级 `PATH` 最前面
  - 仍需要重启 Codex/终端，当前线程才能默认命中修复后的 `rg`
- `npm test`：当前不是全绿
  - 现状：`tests/owner-assets.test.ts` 有 1 个失败
  - 结论：这属于现有代码/断言问题，不是环境安装问题

## 3. 你现在需要做的事
1. 完全退出 Codex Desktop，再重新打开本项目。
2. 打开集成终端，确认当前 shell 为 `PowerShell`，当前目录为项目根目录。
3. 先执行 `rg` 专项检查：

```powershell
where.exe rg
rg --version
```

如果你的 PowerShell 提示符里出现了 `Microsoft.PowerShell.Core\FileSystem::\\?\...`，不要直接运行 `npm`。先在当前终端执行：

```powershell
$fixed = ((Get-Location).ProviderPath -replace '^\\\\\?\\','')
Set-Location -LiteralPath $fixed
```

4. 预期结果：
  - `rg --version` 成功输出版本
  - 重启后的首个 `rg` 路径应优先命中 `C:\Users\HIT-IVAFFR\.codex\bin\rg.exe`
5. 再执行基础运行时检查：

```powershell
git --version
node -v
npm -v
python --version
```

6. 如依赖需要重装或你刚切换机器，执行：

```powershell
npm ci
npm run runtime:build
```

7. 如果你要做真实浏览器联调，再执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\preflight-bootstrap.ps1 -CheckChrome
```

8. 如果你要进入维护工具开发，执行：

```powershell
npm run owner
```

9. 如果你要验证公开站点页面，另开一个终端执行：

```powershell
npm run dev
```

## 4. Codex 建议设置
- `Agent environment`：选择 `Windows` 或 `Windows native`
- `Integrated terminal shell`：选择 `PowerShell`
- `Workspace / Project directory`：固定为 `E:\Workspace\codex\Introduction to Classical Music`
- 若界面允许配置权限：
  - 文件系统：选择 `full access`（完整访问）
  - 网络：保持 `enabled`（启用）
  - 命令审批：选择尽量少打断开发流的模式
- 重新打开项目后，优先验证 `rg` 是否已恢复，再开始搜索与改代码
- `.codex/environments/environment.toml` 当前有动作名称乱码；它带有“自动生成，不建议手改”标记，建议后续在 Codex 界面里重新生成环境动作，而不是直接手工改该文件

## 5. `rg`（ripgrep，快速全文搜索）专项说明
- 本次根因不是“未安装”，而是 Codex 自带的 `rg.exe` 位于 WindowsApps 路径，当前系统策略禁止直接执行
- 已完成的修复：
  - 复制可用 `rg.exe` 到 `C:\Users\HIT-IVAFFR\.codex\bin\rg.exe`
  - 将 `C:\Users\HIT-IVAFFR\.codex\bin` 提前到用户级 `PATH`
- 你需要做的唯一人工动作：重启 Codex
- 如果重启后 `rg` 仍异常，按下面顺序排查：

```powershell
where.exe rg
Get-Command rg -All
& "$HOME\.codex\bin\rg.exe" --version
```

- 如果只有显式路径能运行，说明当前会话仍命中了错误路径；先在当前终端临时修正：

```powershell
$env:PATH = "$HOME\.codex\bin;$env:PATH"
rg --version
```

- 如果连 `"$HOME\.codex\bin\rg.exe"` 也无法运行，再考虑企业策略 `WDAC/AppLocker`（Windows Defender Application Control / AppLocker，应用白名单策略）拦截
- 在 `rg` 未恢复前，临时回退命令：

```powershell
Get-ChildItem -Recurse -File
Get-ChildItem -Recurse | Select-String -Pattern "关键词"
```

## 6. 开发门禁（Gate）
- 只有下面条件满足后，才建议进入功能开发：
  - `rg --version` 正常
  - `node / npm / python` 正常
  - `npm run runtime:build` 正常
  - `npm run owner` 能启动
  - Chrome 可打开
- `npm test` 当前已有 1 个存量失败，因此它现在更适合作为“已知问题提示”，而不是阻断环境启动的硬门禁

## 7. 当前已知非环境问题
- [tests/owner-assets.test.ts](/E:/Workspace/codex/Introduction%20to%20Classical%20Music/tests/owner-assets.test.ts) 当前有 1 个中文路径断言失败
- 仓库尚无 baseline commit（基线提交），不利于后续回滚与审计
- 交接包指定的 P0 仍然是：
  - 候选审查按钮失效
  - 候选审查 UI 裁切/溢出
  - 图片候选选择体验

## 8. 建议你回复我的确认格式
```text
[Preflight 完成确认]
- Codex 已重启：是 / 否
- rg 已恢复：是 / 否
- runtime build：通过 / 未通过
- owner tool：可启动 / 不可启动
- 是否进入开发：是 / 否
```
