# 2026-03-24 人工确认清单

本清单用于记录需要人工判定或补证的数据项。请直接在对应条目下填写，保留字段名不改，后续我会按这里的结果继续清洗。

填写约定：
- `状态`：填写 `待确认`、`已确认`、`暂缓`
- `是否同一实体`：填写 `是`、`否`、`待定`
- `处理结论`：填写 `合并`、`保留并更名`、`新增条目`、`仅补别名`、`暂缓`
- `依据`：尽量写可复查来源、唱片封套、视频标题、页面链接或你的判断说明

## A. 缺失署名的录音回填

### A1. 舒曼《a小调钢琴协奏曲》 / 福斯特 / 1953
- 状态：待确认
- recordingId：`recording-a小调钢琴协奏曲-福斯特-1953`
- 当前标题：`福斯特 - 1953*`
- 当前已知结构化署名：
  - `soloist`：西德尼·福斯特 / Sidney Foster
- 缺失角色：`orchestra_or_ensemble`
- sourcePath：`作曲家/罗伯特·舒曼/钢琴协奏曲/a小调钢琴协奏曲/福斯特_1953.htm`
- 现有线索：
  - YouTube 标题：`SCHUMANN: Piano Concerto in A Min.-COMPLETE-Lydia Porro & Sidney Foster, Pianists-1953`
- 用户确认：
  - 乐团或合奏正式中文名：
  - 乐团或合奏正式原文名：
  - 是否复用现有条目：
  - 现有条目 ID（若复用）：
  - 需要补充的别名 / 缩写：
  - 依据：
  - 备注：

### A2. 舒曼《a小调钢琴协奏曲》 / 维尔萨拉泽 / 鲁丁
- 状态：待确认
- recordingId：`recording-a小调钢琴协奏曲-维尔萨拉泽-and-鲁丁`
- 当前标题：`亚历山大·鲁丁 - 维尔萨拉泽 - 莫斯科音乐学院大音乐厅`
- 当前已知结构化署名：
  - `conductor`：亚历山大·鲁丁 / Александр Израилевич Рудин
  - `soloist`：埃莉索·维尔萨拉泽 / Eliso Virsaladze
- 缺失角色：`orchestra_or_ensemble`
- sourcePath：`作曲家/罗伯特·舒曼/钢琴协奏曲/a小调钢琴协奏曲/维尔萨拉泽&鲁丁.htm`
- 现有线索：
  - YouTube 标题：`Schumann - Piano Concerto, op.54 Eliso Virsaladze`
  - `venueText` 已写入：`莫斯科音乐学院大音乐厅`
- 用户确认：
  - 乐团或合奏正式中文名：
  - 乐团或合奏正式原文名：
  - 是否复用现有条目：
  - 现有条目 ID（若复用）：
  - 需要补充的别名 / 缩写：
  - 依据：
  - 备注：

## B. 重复或冲突实体判定

### B1. `Orchestre National de France` 重复组
- 状态：待确认
- 候选条目 1：
  - ID：`person-orchestre-national-de-france`
  - 当前中文名：法国国家管弦乐团
  - 当前原文名：`Orchestre National de France`
  - 当前 slug：`orchestre-national-de-france`
- 候选条目 2：
  - ID：`person-orchestre-national-de-paris`
  - 当前中文名：巴黎国家交响乐团
  - 当前原文名：`Orchestre National de France`
  - 当前 slug：`orchestre-national-de-paris`
- 当前引用：
  - `person-orchestre-national-de-france`：2 条录音
  - `person-orchestre-national-de-paris`：1 条录音
- 用户确认：
  - 是否同一实体：
  - 保留规范中文名：
  - 保留规范原文名：
  - 保留条目 ID：
  - 保留 slug：
  - 处理结论：
  - 依据：
  - 备注：

### B2. `Kölner Rundfunk-Sinfonie-Orchester` 重复组
- 状态：待确认
- 候选条目 1：
  - ID：`person-ko-lner-rundfunk-sinfonie-orchester-wdr-sinfonieorchester-ko-ln`
  - 当前中文名：科隆西德广播交响乐团
  - 当前原文名：`Kölner Rundfunk-Sinfonie-Orchester`
  - 当前 slug：`ko-lner-rundfunk-sinfonie-orchester-wdr-sinfonieorchester-ko-ln`
  - 当前引用：2 条录音
- 候选条目 2：
  - ID：`person-ko-lner-rundfunk-sinfonie-orchester`
  - 当前中文名：科隆广播交响乐团
  - 当前原文名：`Kölner Rundfunk-Sinfonie-Orchester`
  - 当前 slug：`ko-lner-rundfunk-sinfonie-orchester`
  - 当前引用：0 条录音
- 用户确认：
  - 是否同一实体：
  - 保留规范中文名：
  - 保留规范原文名：
  - 保留条目 ID：
  - 保留 slug：
  - 处理结论：
  - 依据：
  - 备注：

## C. 待映射的中文或临时团体名

### C1. 柏林自由音乐会联合乐团
- 状态：待确认
- 当前条目 ID：`person-ensemble-柏林自由音乐会联合乐团`
- 当前角色：`ensemble`
- 当前引用：1 条录音
- 用户确认：
  - 是否保留为独立条目：
  - 若不保留，对应正式实体：
  - 正式中文名：
  - 正式原文名：
  - 缩写 / 别名：
  - 依据：
  - 备注：

### C2. 柏林自由音乐会联合合唱团
- 状态：待确认
- 当前条目 ID：`person-chorus-柏林自由音乐会联合合唱团`
- 当前角色：`chorus`
- 当前引用：1 条录音
- 用户确认：
  - 是否保留为独立条目：
  - 若不保留，对应正式实体：
  - 正式中文名：
  - 正式原文名：
  - 缩写 / 别名：
  - 依据：
  - 备注：

### C3. 巴塞罗那交响乐团
- 状态：待确认
- 当前条目 ID：`person-orchestra-巴塞罗那交响乐团`
- 当前角色：`orchestra`
- 当前引用：1 条录音
- 用户确认：
  - 对应正式实体：
  - 正式中文名：
  - 正式原文名：
  - 是否复用现有条目：
  - 现有条目 ID（若复用）：
  - 缩写 / 别名：
  - 依据：
  - 备注：

### C4. 芬兰广播乐团
- 状态：待确认
- 当前条目 ID：`person-orchestra-芬兰广播乐团`
- 当前角色：`orchestra`
- 当前引用：1 条录音
- 用户确认：
  - 对应正式实体：
  - 正式中文名：
  - 正式原文名：
  - 是否复用现有条目：
  - 现有条目 ID（若复用）：
  - 缩写 / 别名：
  - 依据：
  - 备注：

## D. 对照表待补强的中文译名

以下项目当前已在对照表中出现原文或脏写法，但中文规范译名仍建议人工复核后再固化：

### D1. `Göteborgs Symfoniker`
- 状态：待确认
- 建议候选中文名：哥德堡交响乐团
- 用户确认中文名：
- 依据：
- 备注：

### D2. `Orquesta Sinfónica de Chile`
- 状态：待确认
- 建议候选中文名：智利交响乐团
- 用户确认中文名：
- 依据：
- 备注：

### D3. `Orchestre de la Société des Concerts du Conservatoire`
- 状态：待确认
- 建议候选中文名：
- 用户确认中文名：
- 依据：
- 备注：

### D4. `Orchestra della Radiotelevisione Francese`
- 状态：待确认
- 建议候选中文名：
- 用户确认中文名：
- 依据：
- 备注：

### D5. `Sächsische Staatskapelle Dresden`
- 状态：待确认
- 建议候选中文名：
- 用户确认中文名：
- 依据：
- 备注：
