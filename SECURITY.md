# 安全策略

## 报告方式

请**不要**开公开 issue。用 GitHub 的
[Private vulnerability reporting](https://github.com/6612907-netizen/openreboot/security/advisories/new)
（仓库 → Security → Report a vulnerability）。非敏感的普通问题照常开 issue。

这个项目由个人维护，没有 SLA。但我会在能响应时尽快回复，并优先处理任何
「本机数据外泄」或「导入能破坏用户数据」类的问题。

## 这个项目的威胁模型跟一般 Web 应用不一样

它**故意**把用户的敏感自述文本存在用户自己的设备上，没有任何服务端。
所以真正需要防的是这几件事：

1. **数据不出本机。** 没有账号、没有后端、没有遥测、没有第三方脚本。
   Service worker 的运行时缓存只收**同源 GET**，跨站请求直接放行不代理。
   这条不是靠承诺：`tests/local-first.test.ts` 逐个文件扫 `src/`，出现
   `fetch(`／`XMLHttpRequest`／`sendBeacon`／`new WebSocket`／`EventSource`／`navigator.connection`
   即红；另钉住「`index.html` 不引外部脚本」「运行时依赖只有 react」「无后台同步与推送」
   「无硬编码后端地址」「构建产物用相对路径（可放子目录自托管）」。
   真浏览器那一格由 `tools/browser-smoke.py` 复验：断网可开、请求全同源、控制台零报错。
2. **导入不能静默破坏数据。** `importJson` 校验 `schemaVersion`，不匹配就报错退出，
   不做任何自动迁移；导出文件是明文 JSON，用户随时可以自己备份和审。
3. **不自称医疗工具。** 不做诊断、不建议用药、不做危机干预，也不生成任何可能被当作
   临床记录的东西。边界写在 README 和界面里。

## 已知风险，请按自己的情况评估

- **导出的 JSON 是明文。** 里面是你自己写下的内容，谁拿到文件谁就能读。
  请别把它放到共享网盘的公开链接里。加密不在本项目范围内 —— 用你系统自带的全盘加密。
- **浏览器不提供「仅对本应用可见」的保证。** 同一台机器上能读你浏览器配置的人，
  就能读这些 IndexedDB 数据；无痕窗口关掉即没了。共享电脑请用自己的登录账户隔离。
- **自托管等于把边界交给托管方。** `dist/` 随便丢到哪都有人能看到访问日志。
  这个项目最合理的用法是本地或自己控制的设备；把它公开托管给陌生人，
  就把「没有服务器」这条承诺换成了「有服务器但你不了解它」。
- **HTTPS 是硬性前提。** Service worker 与 IndexedDB 在非安全上下文（除
  `localhost` 外的 http）不会工作。自托管请上 TLS。
- **供应链面很小但非零。** 运行时依赖只有 `react` 与 `react-dom`。
  更新任何依赖前请 `npm ci` + `npm run gate`，并审 diff。

## 不在范围内

- 端到端加密、多设备同步、账号体系 —— 与「不制造依赖」的目标冲突，v0.1 不做。
- 对第三方托管实例的合规背书。
