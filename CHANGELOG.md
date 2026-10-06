# 更新日志

遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与语义化版本。

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

- 方案书在 §11 中途截断，Lesson 02–04 是自行起草（源码里标 `source: "drafted"`）。
- §9 设想的 AI 辅助目前是本地确定性检查；接模型需要单独讨论，默认不做。
- 只有中文文案层。
- 未做真机（iOS / Android）全面回归；桌面 Chrome 与移动端视口已过。

版本对比：<https://github.com/6612907-netizen/openreboot/compare/v0.1.0...HEAD>
