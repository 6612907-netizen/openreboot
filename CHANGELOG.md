# 更新日志

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

## [v0.1.1] — 2026-10-07

规范定稿 + 在线体验版上线。**没有加任何新功能面**：不做云端 AI、账号、同步、社交、排行榜、
连续打卡、积分、付费（见 docs/BASELINE.md §5）。

### 变更

- **规范真源**：`docs/BASELINE.md`（v0.1 Baseline Spec）。不再等截断的旧方案原文；
  Lesson 02–04 与 Stage 02–07 的细节从"待验证草稿"改标为**产品决定**（`source: "product"`）。
- **DECIDE 三个出口定型**为 `change / observe / keep`。`observe` 与 `keep` 不再自动归档：
  用户可回来重选，结束要自己按「归档」，归档才让出唯一的 Active Change 名额。
  旧导出文件里的 `commit / notNow / stayAsIs` 在导入层显式翻译；认不出的值整份拒绝。

### 修复（都是真浏览器/CI 照出来的，不是代码读出来的）

- DECIDE 被阶段判据拒绝时界面静默无反应；原因码→文案映射一直失效（会把 `gate.audit` 这种内部码甩给用户）。
- 设置页「清空本机全部数据」后库已清空、界面仍挂着上一条 Change。
- UNDERSTAND 每写完一段不刷新（四段课实际上走不完）；DECIDE 存完审计同样不刷新。
- 测试里把 `exportedAt` 时间戳比进了"逐字节等价"，成为一条时快时慢的断言。

### 新增

- **GitHub Pages 在线体验版**与独立部署流水线：`gate` 不绿不部署；持 Pages 写权限的作业不跑 npm。
- 子路径正确性判据（`tests/pwa-paths.test.ts` 7 条 + 门禁检查产物里的绝对路径）。
- 线上验收工装扩到 27 格并支持 `--base`；结果记 `docs/ACCEPTANCE-PAGES.md`。
- 隐私表述改为可核对的版本：应用本身无账号/后端/遥测，训练数据默认只在本机；
  **Pages 的访问日志不等于 OpenReboot 收集训练数据**。

用例 111 → 140 条，门禁新增覆盖面判据（报告缺文件即红）。

## [v0.1.0] — 2026-10-07

第一个可用版本。八个 Stage 全流程可跑通，数据只落本机。

### 新增

- **Stage 00 AWARE**：欢迎 → Life Friction Scan（七题，§6 原文）→ 摩擦领域（最多 3 个，§7）
  → 主领域。**没走完检查不允许建 Change**。
- **Change Audit + Change Equation**（§8/§9）：八栏拆解、四象限结构化展示，
  不算任何「改变指数」。矛盾检查是纯本地的确定性规则，只提问、不下判断。
- **Stage 01 UNDERSTAND**：四段微型互动课（每段一句话才放行），Lesson 01 为方案书原文。
- **Stage 02 DECIDE**：commit / 现在不做 / 保持现状 三个出口，后两者是合法终态（§2.1）。
- **Stage 03 REBOOT / 04 TRAIN**：实验设计（声明意图 vs 证据支持的目标分两栏记）、
  逐次记录 done / partial / missed。
- **Stage 05 ADAPT**：missed 自动开一条「中断」，走 Diagnose → Intervention → Recovery → Learn
  （§2.4）。没有「失败」这个状态，也没有断签计数。
- **Stage 06 INTERNALIZE / 07 GRADUATE**：监督等级由高到低自动提议降级；
  毕业条件由用户自己确认，系统不代签（§2.5）。
- **Local-first**：数据在 IndexedDB；导出 / 导入 JSON（`schemaVersion` 不匹配就拒绝，不静默迁移）；
  一键清空本机数据。无账号、无服务器、无遥测。
- **PWA**：manifest + 手写 service worker，离线可开；运行时缓存只收同源 GET。
- 门禁 `npm run gate`：typecheck + 全测 + 构建 + 产物存在性，任一为空即红（不接受「什么都没跑也算过」）。

### 已知缺口

- 原方案书在 §11 中途截断；2026-10-07 起以 `docs/BASELINE.md` 为规范真源，
  Lesson 02–04 与 Stage 02–07 的细节属 v0.1 产品决定（源码标 `source: "product"`）。
- §9 设想的 AI 辅助目前是本地确定性检查；接模型需要单独讨论，默认不做。
- 只有中文文案层。
- 未做真机（iOS / Android）全面回归；桌面 Chrome 与移动端视口已过。

版本对比：<https://github.com/6612907-netizen/openreboot/compare/v0.1.0...HEAD>
