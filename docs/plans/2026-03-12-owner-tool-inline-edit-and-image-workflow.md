# Owner Tool Inline Edit And Image Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为维护工具补齐详情页图片预览与上传、单条自动检查内联手动修改、批量候选审查手动微调与图片上传，并修复相关布局与真实交互问题。

**Architecture:** 继续沿用现有 `owner` 前端与 `Express` 后端接口，不新增独立页面，而是在现有详情区、单条自动检查区和候选审查区内补齐可编辑表单、图片预览与上传入口。样式修复采用末尾覆盖规则，避免继续被旧样式反向覆盖。

**Tech Stack:** Astro, TypeScript, Express, vanilla JavaScript, Playwright CLI, Vitest

---

### Task 1: 梳理现有详情页与候选审查数据流

**Files:**
- Modify: `owner/app.js`
- Modify: `owner/index.html`
- Modify: `scripts/owner-app.ts`

**Step 1: 核对详情页现有图片预览与上传骨架**

确认 `composer/person` 详情表单已有 `data-image-preview` 与 `data-image-upload`，并检查 `recording` 是否缺少对应骨架。

**Step 2: 核对单条自动检查与候选审查的编辑能力**

确认以下现有函数的可复用边界：
- `renderInlineCheckJob`
- `buildProposalCardsHtml`
- `uploadEntityImage`
- `uploadProposalImage`
- `/api/save/:entityType`
- `/api/assets/upload`

**Step 3: 明确本轮新增交互的最小补口**

记录需要新增的 UI 与事件入口：
- 详情页图片区与手动上传
- 单条自动检查内联编辑器
- 候选审查手动字段修改与图片上传

### Task 2: 详情页图片预览与手动上传

**Files:**
- Modify: `owner/index.html`
- Modify: `owner/app.js`
- Modify: `owner/styles.css`

**Step 1: 调整 composer/person 详情字段布局**

将中文名、中文全名、规范显示名压缩为两列布局，交换规范显示名与拉丁/英文名位置，为右侧图片区让出空间。

**Step 2: 为 recording 详情补图片预览与上传入口**

在录音详情中加入图片预览区和上传按钮，保持与人物/作曲家一致的交互。

**Step 3: 确保详情页载入实体时同步图片字段**

使用 `syncEntityImageFields` 与 `renderFormImagePreview`，验证 entity 载入后图片、预览和上传都更新。

### Task 3: 单条自动检查内联编辑与图片上传

**Files:**
- Modify: `owner/app.js`
- Modify: `owner/styles.css`

**Step 1: 为无候选场景新增内联编辑器**

在 `renderInlineCheckJob` 中，当 `proposals.length === 0` 时，渲染当前实体可编辑表单，而不是只显示结论。

**Step 2: 合并生卒年显示并上移别名**

在单条自动检查编辑器里用单个“生卒年”展示 `birthYear-deathYear`，释放出的栅格位给别名与图片区。

**Step 3: 为单条自动检查编辑器接入保存与图片上传**

保存调用 `/api/save/:entityType`，图片上传调用 `/api/assets/upload`，并在界面内即时刷新预览。

### Task 4: 批量候选审查手动微调与图片上传

**Files:**
- Modify: `owner/app.js`
- Modify: `owner/styles.css`

**Step 1: 精简候选卡片信息密度**

简介只展示 excerpt，完整内容通过现有“查看完整内容”弹窗查看，减少候选卡片高度。

**Step 2: 为候选卡片增加手工字段修改**

复用 `buildProposalFieldEditorHtml` 与 `editProposal`，确保用户无需放弃整条即可手工调整候选字段。

**Step 3: 为候选卡片增加图片上传与更清晰的预览**

在候选图片区中支持：
- 默认“请选择”项显示全部候选
- 选中单项只显示单图预览
- 上传自定义图片后立即成为已选图片

### Task 5: 布局修复与最终覆盖规则

**Files:**
- Modify: `owner/styles.css`
- Modify: `owner/index.html`

**Step 1: 解除搜索区与详情区的旧样式裁切**

在样式文件末尾追加最终覆盖规则，修正：
- 搜索结果卡片裁切
- 详情区溢出
- tab panel 滚动异常
- proposal 卡片内容被边框遮挡

**Step 2: 修正 inline check 与候选审查区滚动**

保证长内容可以在卡片内部滚动，不会撑爆整体容器。

**Step 3: bump 资源版本**

更新 `owner/index.html` 中 `styles.css` 和 `app.js` 的版本号，避免缓存。

### Task 6: 真实浏览器联调与验证

**Files:**
- Modify: `owner-test.log`（运行产物，可忽略）

**Step 1: 真实启动 owner 服务**

Run: `npm run owner`

**Step 2: 用真实 Chrome 跑完整流程**

使用 Playwright CLI 验证：
- 搜索作曲家
- 载入详情
- 详情图片区显示与上传
- 单条自动检查
- 单条内联编辑与图片上传
- 候选审查字段编辑与图片上传

**Step 3: 运行完整验证**

Run: `npm test`
Expected: 全部通过

Run: `npm run runtime:build`
Expected: 通过

Run: `npm run build`
Expected: 通过
