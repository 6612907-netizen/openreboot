# OpenReboot

> **Our goal is not to maximize engagement.**
> **Our goal is to make OpenReboot progressively unnecessary.**

开源、本地优先的**个人改变训练系统**。界面目前只有中文文案层，英文待补。

它不是 Todo List，不是习惯打卡软件，不是 AI 聊天机器人，也不是心理诊断工具。

它处理的是一个更靠前的问题：**很多人知道自己应该改变，也看过大量方法，但"知道"没有转化成长期行动。**
所以 OpenReboot 第一步不假定你要改变，而是帮你判断这件事到底值不值得改。

---

## 它做什么

八个阶段，一次只处理**一个** Active Change：

| | Stage | 在解决的问题 |
|---|---|---|
| 00 | AWARE | 我真的存在值得改变的问题吗？（Life Friction Scan + Friction Areas） |
| 01 | UNDERSTAND | 为什么"知道"不等于"做到"（四段微型课程，每段要写一句话） |
| 02 | DECIDE | 改变 / 现在不是时候 / 保持现状 —— **三个出口都合法** |
| 03 | REBOOT | 把方向设计成一个可执行的最小实验，而不是宏愿 |
| 04 | TRAIN | 记录实际发生了什么（行为），不是声明了什么 |
| 05 | ADAPT | 中断 → 看原因 → 调整 → 恢复 → 记下学到什么 |
| 06 | INTERNALIZE | 逐步降低监督：高 → 中 → 轻 → 无 |
| 07 | GRADUATE | 写下"没有这个软件时你怎么继续"，然后离开 |

---

## 价值观是测试，不是宣言

产品规范里有四条硬价值观。口号会褪色，所以每一条都绑了一枚会在 CI 里失败的测试：

| 规范条款 | 可执行判据 |
|---|---|
| §2.2 不制造羞耻 | `tests/shame-free-language.test.ts` 递归扫描**所有面向用户的文案**，命中"失败 / 自律 / 断签 / 打卡 / 必须 / 诊断…"即失败；同时断言"中断 / 阻碍 / 恢复 / 调整 / 实验 / 证据"这些应使用的词确实在用 |
| §2.4 没做 ≠ 不行 | 数据模型里 `RepOutcome` 只有 `done / partial / missed`，**没有 `failed`**，并有测试钉住 |
| §2.5 不做参与度指标 | 源码里出现 `streak / DAU / retention / engagement / score` 直接测试失败 |
| §9 不做人格判断 | 本地"矛盾检查"只输出**问句**，测试断言每条输出必须以问号结尾且不含人格词 |
| Local-first | `tests/local-first.test.ts` 断言 `src/` 里没有任何 `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket`，运行时依赖只有 `react` + `react-dom`，`index.html` 不引外部脚本，Service Worker 不代理跨站请求、无后台同步与推送 |

**没有账号，没有服务器，没有遥测。** 数据只存在浏览器的 IndexedDB 里，可以一键导出 JSON、导入、彻底清空。

---

## 快速开始

```bash
npm install
npm run dev        # 本地开发
npm run gate       # 类型 + 测试 + 构建，退出码 0 才算过
npm run build      # 产物在 dist/，纯静态
```

### 自托管

`dist/` 是纯静态文件，任何静态服务器都能跑：

```bash
npm run build
npx serve dist                 # 本机预览
# 或直接把 dist/ 丢进 nginx / Caddy / GitHub Pages / Cloudflare Pages
```

构建使用相对路径 base，放在子目录（例如 `https://user.github.io/OpenReboot/`）无需改代码。

### 装成 App

打开站点后，浏览器地址栏右侧会出现安装按钮（Chrome / Edge），或 Safari 分享菜单里选"添加到主屏幕"。
离线后仍可使用 —— Service Worker 会把已访问过的资源留在本机。

### 怎么在真浏览器里验一遍

门禁（`npm run gate`）跑的是 jsdom，它能证明逻辑对，证不了「构建产物在真实浏览器里能不能点、
数据能不能落进真实 IndexedDB、断网能不能打开」。这三条是上面的硬承诺，所以另有一枚手动脚本：

```bash
npm run build && npx vite preview --port 4173 &
python3 tools/browser-smoke.py     # 需要 playwright；逐步打点，任一步红即退出码 1
```

它跑过 15 项：欢迎页无目标入口、七题→领域→主领域→建 Change、领域上限 3、
刷新后仍在原阶段、IndexedDB 已建、Service Worker 已激活、断网可开、请求全同源、控制台零报错。
不进 CI —— 门禁不该依赖一台有浏览器的机器。

---

## 数据在哪，谁能看到

只在你这台设备上。存储位置是 IndexedDB 数据库 `openreboot`，单键快照模型。

- **导出**：设置 → 导出 JSON（含 schema 版本号，便于将来迁移）
- **导入**：版本不匹配时**拒绝静默迁移**并明确报错，不会偷偷改你的数据
- **删除**：设置 → 清空本机全部数据，不可撤销

---

## 边界（重要）

OpenReboot **不是**医疗、心理健康或诊断工具，不提供治疗、用药、危机干预建议。
它只做结构化提问与记录。

如果你正在经历危机，或这种痛苦已经影响到基本生活，请联系专业机构或身边的人。
本软件不会替你做判断，也不假装能。

---

## 当前状态与已知缺口

逐条对照方案书的证据表见 [docs/SPEC-COVERAGE.md](docs/SPEC-COVERAGE.md)：每一节写了落在哪个文件、
由哪条测试或哪次实测证明、以及状态是「成立 / 部分 / 未证」。

v0.1 MVP。诚实列出没做到的：

- **规范来源被截断**：本仓库依据的方案书在第 11 节（Lesson 01）中途结束。
  Stage 01 的 Lesson 01 为原文照抄；Lesson 02–04 按 §2.3 / §2.4 / §2.5 自行起草，
  源码里以 `source: "drafted"` 标注，等完整段落到位后应逐段替换。
- **§9 提到的 AI 辅助**目前是**纯本地确定性检查**（不联网、不调模型）。
  接真模型属于可选适配器，默认关闭 —— 一旦引入就会破坏上面的 Local-first 测试，需要单独讨论。
- 多语言：目前只有中文文案层，英文待补。
- 移动端排版已按 PWA 处理，但未做真机全面回归。

## 参与

先跑 `npm run gate`，全绿再提 PR。不要放宽任何测试阈值 ——
上面那些测试就是产品的边界本身，把它们改绿等于把产品改成别的东西。
细则见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题请按 [SECURITY.md](SECURITY.md) 里的私密渠道报。

版本改动记在 [CHANGELOG.md](CHANGELOG.md)。

## 许可

MIT。见 [LICENSE](LICENSE)。
