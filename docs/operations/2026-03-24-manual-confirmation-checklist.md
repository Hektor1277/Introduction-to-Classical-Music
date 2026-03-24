# 2026-03-24 人工确认清单

本清单用于记录需要人工判定或补证的数据项。请直接在对应条目下填写，保留字段名不改，后续我会按这里的结果继续清洗。

填写约定：

- `状态`：填写 `待确认`、`已确认`、`暂缓`
- `是否同一实体`：填写 `是`、`否`、`待定`
- `处理结论`：填写 `合并`、`保留并更名`、`新增条目`、`仅补别名`、`暂缓`
- `依据`：尽量写可复查来源、唱片封套、视频标题、页面链接或你的判断说明

## A. 缺失署名的录音回填

### A1. 舒曼《a小调钢琴协奏曲》 / 福斯特 / 1953

- 状态：已确认
- recordingId：`recording-a小调钢琴协奏曲-福斯特-1953`
- 当前标题：`福斯特 - 1953*`
- 当前已知结构化署名：
  - `soloist`：西德尼·福斯特 / Sidney Foster
- 缺失角色：`orchestra_or_ensemble`
- sourcePath：`作曲家/罗伯特·舒曼/钢琴协奏曲/a小调钢琴协奏曲/福斯特_1953.htm`
- 现有线索：
  - YouTube 标题：`SCHUMANN: Piano Concerto in A Min.-COMPLETE-Lydia Porro & Sidney Foster, Pianists-1953`
- 用户确认：
  - 乐团或合奏正式中文名：无（无法确认）
  - 乐团或合奏正式原文名：无（无法确认）
  - 是否复用现有条目：是
  - 现有条目 ID（若复用）：使用原条目即可
  - 需要补充的别名 / 缩写：无
  - 依据：无
  - 备注：将本条目乐团信息标记为未知即可

### A2. 舒曼《a小调钢琴协奏曲》 / 维尔萨拉泽 / 鲁丁

- 状态：已确认
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
  - 乐团或合奏正式中文名：无（无法确认）
  - 乐团或合奏正式原文名：无（无法确认）
  - 是否复用现有条目：是
  - 现有条目 ID（若复用）：使用原条目即可
  - 需要补充的别名 / 缩写：无
  - 依据：无
  - 备注：将本条目乐团信息标记为未知即可

## B. 重复或冲突实体判定

### B1. `Orchestre National de France` 重复组

- 状态：已确认
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
  - 是否同一实体：是
  - 保留规范中文名：法国国家管弦乐团
  - 保留规范原文名：Orchestre National de France
  - 保留条目 ID：
  - 保留 slug：
  - 处理结论：合并
  - 依据：
  - 备注：

### B2. `Kölner Rundfunk-Sinfonie-Orchester` 重复组

- 状态：已确认
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
  - 是否同一实体：是
  - 保留规范中文名：科隆西德广播交响乐团
  - 保留规范原文名：Kölner Rundfunk-Sinfonie-Orchester
  - 保留条目 ID：
  - 保留 slug：
  - 处理结论：合并
  - 依据：
  - 备注：

## C. 待映射的中文或临时团体名

### C1. 柏林自由音乐会联合乐团

- 状态：已确认
- 当前条目 ID：`person-ensemble-柏林自由音乐会联合乐团`
- 当前角色：`ensemble`
- 当前引用：1 条录音
- recordingId：`recording-第九交响曲合唱-伯恩斯坦1989`
- 当前标题：`伯恩斯坦 - 柏林自由音乐会联合乐团 - 柏林自由音乐会联合合唱团`
- sourcePath：`作曲家/贝多芬/交响曲/第九交响曲“合唱”/伯恩斯坦1989.htm`
- 外部线索补充：
  - `Bernstein in Berlin` 的公开曲目/注释常将该场演出列为联合编制，而不是单一正式乐团。
  - 当前可复核到的乐团名单包括：`Bavarian Radio Symphony Orchestra`、`Staatskapelle Dresden`、`Orchestra of the Kirov Theatre`、`London Symphony Orchestra`、`New York Philharmonic`、`Orchestre de Paris`。
  - 因此本临时条目更像“聚合占位名”，不是单一正式实体。
- 用户确认：
  - 是否保留为独立条目：否
  - 若不保留，对应正式实体：将你查询到的上述乐团添加即可
  - 正式中文名：
  - 正式原文名：
  - 缩写 / 别名：
  - 依据：
  - 备注：备注说明“柏林自由音乐会联合乐团”的具体情况。

### C2. 柏林自由音乐会联合合唱团

- 状态：已确认
- 当前条目 ID：`person-chorus-柏林自由音乐会联合合唱团`
- 当前角色：`chorus`
- 当前引用：1 条录音
- recordingId：`recording-第九交响曲合唱-伯恩斯坦1989`
- 当前标题：`伯恩斯坦 - 柏林自由音乐会联合乐团 - 柏林自由音乐会联合合唱团`
- sourcePath：`作曲家/贝多芬/交响曲/第九交响曲“合唱”/伯恩斯坦1989.htm`
- 外部线索补充：
  - 同场公开署名可复核到的合唱编制包括：`Bavarian Radio Chorus`、`Chorus of Radio Berlin`、`Dresden Philharmonic Children's Chorus`。
  - 当前临时条目同样更像“聚合占位名”，不太像单一正式合唱团。
- 用户确认：
  - 是否保留为独立条目：否
  - 若不保留，对应正式实体：处理同上
  - 正式中文名：
  - 正式原文名：
  - 缩写 / 别名：
  - 依据：
  - 备注：备注说明“柏林自由音乐会联合乐团”的具体情况。

### C3. 巴塞罗那交响乐团

- 状态：已确认
- 当前条目 ID：`person-orchestra-巴塞罗那交响乐团`
- 当前角色：`orchestra`
- 当前引用：1 条录音
- recordingId：`recording-d大调小提琴协奏曲-马宁-and-杰拉伯特1916`
- 当前标题：`康科迪・杰拉伯特 - 马宁 - 杰拉伯特1916 - 巴塞罗那交响乐团 - 1916`
- sourcePath：`作曲家/贝多芬/小提琴协奏曲/D大调小提琴协奏曲/马宁&杰拉伯特1916.htm`
- 现有线索补充：
  - 本地 `manual-recording-backfills.json` 当前备注写的是“根据现存巴塞罗那音乐会资料，这场 1916 年录音所用乐团可安全回填为巴塞罗那交响乐团”。
  - 但最新补查到的外部线索出现了 `Orquesta de His Master's Voice en Barcelona dirigida por Concordi Gelabert` 这一说法，与“巴塞罗那交响乐团 / Orquesta Sinfónica de Barcelona”并不完全一致。
  - 这说明本条当前还不能自动定案，需你人工确认究竟是正式实体、历史编制名，还是应继续保留临时条目。
- 用户确认：
  - 对应正式实体：巴塞罗那交响乐团
  - 正式中文名：巴塞罗那交响乐团
  - 正式原文名：Orquesta Sinfónica de Barcelona
  - 是否复用现有条目：是
  - 现有条目 ID（若复用）：
  - 缩写 / 别名：
  - 依据：
  - 备注：

### C4. 芬兰广播乐团

- 状态：已确认
- 当前条目 ID：`person-orchestra-芬兰广播乐团`
- 当前角色：`orchestra`
- 当前引用：1 条录音
- recordingId：`recording-d小调小提琴协奏曲-伊格内修斯-and-施内沃伊特1945`
- 当前标题：`施内沃伊特 - 伊格内修斯 - 赫尔辛基爱乐乐团 - 芬兰广播乐团 - 1945.12.8`
- sourcePath：`作曲家/让·西贝柳斯/小提琴协奏曲/d小调小提琴协奏曲/伊格内修斯&施内沃伊特1945.htm`
- 现有线索补充：
  - Yle（芬兰广播公司）档案说明写明该场为两支乐团联合演出，其中另一支是 `Radio-orkesteri`。
  - 若映射到现代更常见英文，可对应 `Finnish Radio Symphony Orchestra`；但 1945 年历史语境下更原始的署名是 `Radio-orkesteri`。
  - 因此这里需要你确认：是保留历史原名，还是统一并入现代规范实体。
- 用户确认：保留历史原名，但纳入别名
  - 对应正式实体：
  - 正式中文名：芬兰广播乐团
  - 正式原文名：Radio-orkesteri
  - 是否复用现有条目：是
  - 现有条目 ID（若复用）：
  - 缩写 / 别名：
  - 依据：
  - 备注：在本条目使用历史原名，但在乐团条目中使用现代规范名作为规范原文名，添加历史原名作为别名。

## D. 对照表待补强的中文译名

以下项目当前已在对照表中出现原文或脏写法，但中文规范译名仍建议人工复核后再固化：

### D1. `Göteborgs Symfoniker`

- 状态：已确认
- 建议候选中文名：哥德堡交响乐团
- 用户确认中文名：哥德堡交响乐团
- 依据：
- 备注：

### D2. `Orquesta Sinfónica de Chile`

- 状态：已确认
- 建议候选中文名：智利交响乐团
- 用户确认中文名：智利交响乐团
- 依据：
- 备注：

### D3. `Orchestre de la Société des Concerts du Conservatoire`

- 状态：已确认
- 建议候选中文名：巴黎音乐学院音乐会协会乐团
- 用户确认中文名：巴黎音乐学院音乐会协会乐团
- 依据：
- 备注：

### D4. `Orchestra della Radiotelevisione Francese`

- 状态：已确认
- 建议候选中文名：法国广播电视管弦乐团
- 用户确认中文名：法国广播电视管弦乐团
- 依据：
- 备注：

### D5. `Sächsische Staatskapelle Dresden`

- 状态：已确认
- 建议候选中文名：德累斯顿交响乐团
- 用户确认中文名：德累斯顿交响乐团
- 依据：
- 备注：
