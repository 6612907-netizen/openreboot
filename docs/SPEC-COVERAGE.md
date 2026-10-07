# 方案书逐节对照表

这份表的用途是**可核查**：每一行写清方案书那条落在哪儿、由什么证明、以及有没有证据。
状态只用三种词，不写「基本完成」这种没法判真伪的话。

- **成立** —— 有当轮可复跑的测试或实测读数支撑
- **部分** —— 做了，但覆盖不到方案书那句话的全部范围（缺哪块写明）
- **未证** —— 手上没有能判真伪的证据
- **产品决定** —— 没有外部原文可比照，判据就是 Baseline 本身；改动它要走 v0.2 的产品决策，而不是等谁补一份旧方案

> **规范真源现在是 [BASELINE.md](BASELINE.md)（主理人 2026-10-07 定稿的 v0.1 Baseline Spec）。**
> 原方案书在第 11 节中途截断，后续原文不再等待、也不追补：已经实现并经确认的结构就是 v0.1 的规范。
> 因此下表里 Stage 02-07 与 Lesson 02-04 的性质是「产品决定」，不再是「等待旧原文验证」。
> 历史留在 git 里即可。

| 方案书 | 要求 | 落在哪 | 由什么证明 | 状态 |
| --- | --- | --- | --- | --- |
| §1 / §4 | 八阶段 AWARE→GRADUATE 顺序推进 | `domain/types.ts` 的 `STAGE_CODES`、`domain/stages.ts` 的 `canEnter` | `tests/domain.test.ts` 逐阶段判据；`tests/ui-smoke.test.tsx` 真点击走完 00→建 Change | 成立 |
| §2.1 | 用户选「不改变」是合法结果 | `DecisionKind = "commit"/"notNow"/"stayAsIs"`；`ClosedOutcome` | `domain.test.ts`：非 commit 不进入 03；`ui-smoke` 不含任何强制路径 | 成立 |
| §2.2 | 禁用词清单＋统一用词 | `i18n/copy.ts` 的 `BANNED_USER_FACING_TERMS`、`PREFERRED_TERMS` | `tests/shame-free-language.test.ts`（52 条）递归扫 `copy.ts` 与 `content/lessons.ts` 每一条字符串，含 domain 生成的句子 | 成立 |
| §2.3 | 行为比宣言重要 | `Plan.declaredIntent` 与 `evidenceBasedTarget` 分两栏；`domain/evidence.ts` | `domain.test.ts`：样本不足 5 次时 `declarationGap` 保持沉默、不编造差距 | 成立 |
| §2.4 | Missed ≠ Failed，走 Diagnose→Intervention→Recovery→Learn | `RepOutcome` 无 `failed`；`Interruption` 结构 | `repository.test.ts`：记一次 missed 自动开一条中断、再记 missed 合并进同一条、恢复后回填并回到 04 | 成立 |
| §2.5 | 产品主动减少对用户的依赖；README 带那句宣言 | `domain/supervision.ts` 的 `proposeStepDown`／`graduationReady` | `domain.test.ts`：降级提议用保守阈值；毕业必须用户自己确认；README 首屏含原文宣言 | 成立 |
| §3 | 一次只能一个 Active Change；不做医疗／心理诊断 | `repository.createChange` 的 `GateError` | `repository.test.ts`：已有 Active Change 时第二次创建被拒且零副作用 | 成立 |
| §5 | 第一次打开不许直接建 Goal，必须先完成 Change Readiness | `canEnter` 的 `gate.readiness`；`App` 路由 | `ui-smoke`：未走完检查时界面上没有目标输入框；`local-first`＋真浏览器各复验一次 | 成立 |
| §5.1 | Welcome 文案逐字 | `copy.welcome.lines` | `ui-smoke` 断言该段只出现一次；真浏览器核 h1 命中数＝1 | 成立 |
| §6 | 七题＋四档频率，题干逐字 | `copy.scan.questions`／`options` | `shame-free-language.test.ts` 会扫题干；`ui-smoke` 答满七题才进领域层 | 成立 |
| §7 | 九个领域、最多选 3、主领域单选 | `copy.areas`、`MAX_FRICTION_AREAS` | `ui-smoke`：点第 4 个不进去且选项仍在原地；未定主领域时「继续」不可点；真浏览器同判据复验 | 成立 |
| §8 | `ChangeAudit` 八个字段名逐字 | `domain/types.ts` 的 `ChangeAudit` | `repository.test.ts` 读写该结构；字段名与方案书代码块一一对应 | 成立 |
| §9 | 四象限结构化展示；不算「改变指数」；AI 不做人格诊断 | `copy.equation.quadrants`、`evidence.reviewAudit` | 象限标题与方案书图内四格文字逐字一致；`domain.test.ts`：审计结论只产出**问句**，不产出评分或判断 | 成立 |
| §10 | 微型交互课程，每段 2–5 分钟，不是长文章 | `content/lessons.ts`、`ui/Understand.tsx` | `domain.test.ts`：四段各写一句话才放行（`gate.lessons`） | 部分 —— 「2–5 分钟」是内容体量目标，只有字数间接约束，没有计时实测 |
| §11 | Lesson 01 原文（知道≠行动≠重复≠自动化 与那条链条） | `content/lessons.ts` 中 `source: "spec"` 的那条 | `shame-free-language.test.ts` 覆盖其文案 | 部分 —— 方案书在链条中途断句，断点之后的内容未收到，只做到截断处 |
| Baseline §1 | 新用户未经 AWARE→UNDERSTAND→DECIDE，不许被推进到「我要改变」 | `stages.canEnter` 与服务层 `createChange` 的 `GateError`；`App` 路由 | `repository.test.ts` 没做检查就不许建 Change；`ui-smoke.test.tsx` 首屏无目标入口；缺决定时 `canEnter(…, 3)` 给 `gate.commit` | 成立 |
| Baseline §3 | 三个合法出口 change / observe / keep；后两者不自动归档、可回来重选 | `DecisionKind`、`repository.setDecision` / `archiveChange`、`Decide` 的 held 卡片 | `repository.test.ts` 三条：选 keep 后仍 active 且未被推进；必须由用户自己按归档才让出名额；已决定改变的那条不许归档 | 成立 |
| Baseline §3 | 旧导出文件里的 commit / notNow / stayAsIs 要读得进来；认不出的值整份拒绝 | `repository.normalizeDecisions` | `repository.test.ts`：三个旧值逐个翻译到位；未知 kind 导入被拒且现有数据逐字节未变 | 成立 |
| 原 §11 之后 | Lesson 02–04 与 Stage 02–07 的内容细节 | `content/lessons.ts`（`source: "product"`）与各阶段界面 | 判据测试覆盖阶段推进与不变量；内容本身是产品决定 | 产品决定 |
| 项目性质 | 开源、Local-first、自托管友好 | `LICENSE`、相对 base 构建、手写 SW | `local-first.test.ts`（27 条）＋真浏览器 15 项：断网可开、请求全同源、IndexedDB 落库、刷新不丢、控制台零报错 | 成立 |
| §9 设想的 AI 辅助 | 矛盾／未明确／可继续探索的提示 | `evidence.reviewAudit` 为**本地确定性规则** | 见上；未接任何模型、未联网 | 部分 —— 与方案书字面「允许 AI」不同形，这是刻意的取舍，已在 README 记录 |

## 这轮之外仍没做到的

- 多语言（现在只有中文文案层）。
- 真机回归：只验了桌面 Chrome 与 420×880 视口，没验 iOS／Android 实设备。
- 键盘可达性与读屏实测：`Choice` 用原生 `input`＋`label`，语义上可访问，但没跑过
  VoiceOver／键盘全流程，这条不写成「已满足无障碍」。
- GitHub Pages 在线版与「线上那一格」的真机验收读数：见本表末尾，跑完再记。
