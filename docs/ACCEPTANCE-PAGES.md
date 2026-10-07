# 线上那一格：GitHub Pages 验收记录

对最终 HTTPS 地址跑的真浏览器验收，不是 localhost、不是 jsdom。

- 地址：<https://6612907-netizen.github.io/openreboot/>
- 被验收的 commit：`42a7c30`（也就是 `v0.1.1` 指向的那一笔）。
  对最终 HTTPS 地址跑过两遍：首次部署在 `9522b97`（Pages run `37572142877`、CI run `37572143082`），
  README/CHANGELOG 那笔纯文档改动部署到 `42a7c30`（Pages run `37572608592`、CI run `37572608535`）后再跑一遍，
  **两遍读数一致：26 PASS / 0 红 / 1 量不到**。文档不进 dist，产物哈希未变。
- 部署链：`Pages` 工作流的 gate 作业跑 `npm run gate`；deploy 作业 `needs: gate`，
  不跑任何 npm 代码，只把 gate 放行的那份产物上传部署。
- 复跑方法：

```bash
npm run build && npx vite preview --port 4173 &
python3 tools/browser-smoke.py                                   # 本机
python3 tools/browser-smoke.py --base https://6612907-netizen.github.io/openreboot/
```

## 结果：27 格 —— 26 PASS / 0 红 / 1 量不到

| 格子 | 状态 | 读数 |
| --- | --- | --- |
| 线上首屏打开 | PASS | 200，h1 存在 |
| 首屏无目标输入框、无 DECIDE 出口 | PASS | `input[type=text]` = 0 |
| 领域上限 3（第 4 点点不进去） | PASS | 选中 3 个 |
| 未定主领域时「继续」不可点 | PASS | disabled |
| 建完 Change 落在 01 UNDERSTAND | PASS | 顶栏 UNDERSTAND |
| UNDERSTAND 看不到 DECIDE 三个出口 | PASS | 命中 0 |
| 四段微型课写完进入 02 DECIDE | PASS | 顶栏 DECIDE |
| 没存审计进不了 REBOOT（界面拦下） | PASS | 「先把上面那几栏填完。」 |
| 出口 OBSERVE 留在 DECIDE、不归档 | PASS | 顶栏仍 DECIDE |
| 出口 KEEP 可重选 | PASS | held 卡片 1 张 |
| 存过审计后 CHANGE 才放行 03 REBOOT | PASS | 顶栏 REBOOT |
| 有 Active Change 时不再给新建入口 | PASS | 无「表面目标」标题 |
| 刷新后仍在 03 REBOOT | PASS | 数据真落库 |
| IndexedDB 建立 | PASS | `indexedDB.databases().length >= 1` |
| Service Worker 注册并激活 | PASS | scope = `…/openreboot/` |
| PWA 安装判据无错误 | PASS | `Page.getInstallabilityErrors` = `[]` |
| `beforeinstallprompt` 触发 | **量不到** | 无头 Chromium 不发 bip；可安装性以那一行判据为准，**不折算成通过** |
| manifest 在子路径可取、字段相对 | PASS | 200，`start_url:"./"`、`scope:"./"`、icons 1 |
| 断网重开仍可用 | PASS | 重开后仍在 REBOOT |
| 导出 JSON 落成文件 | PASS | `openreboot-2026-10-07.json` |
| 导入 JSON 成功并有反馈 | PASS | 「已保存」 |
| 清空有二次确认，确认后回首屏 | PASS | 确认文案前缀匹配 |
| 清空是真清空 | PASS | 导出文件 `changes=0`、`readiness=None` |
| 零第三方域名请求 | PASS | 20 个请求全在同域 |
| 零遥测/分析端点 | PASS | 命中 0 |
| Console 零报错 | PASS | 0 条 |
| 390 宽无横向溢出且流程可点 | PASS | 溢出 0px |

## 这一轮验收换来的东西（不是走过场）

真浏览器跑线上把三个 jsdom 与判据单测都没抓到的缺陷照了出来，全部已修并各加用例：

1. DECIDE 里被阶段判据拒掉时**界面完全静默**（`advance` 抛的 GateError 没人接）。
2. 原因码→文案的映射一直是坏的（`"gate.audit"` 拿去查不带前缀的键），
   就算接住了也是把内部码甩给用户。现在码查不到直接抛，并有 12 条"每个码都有人话"的判据。
3. 设置页点「清空本机全部数据」后库真空了，但界面还挂着上一条 Change（只切视图不重读库）。

外加 CI 侧两条：导出比对里混进了 `exportedAt` 时间戳（时快时慢的断言）、
以及 Pages 未开启时 deploy 作业的 404。
