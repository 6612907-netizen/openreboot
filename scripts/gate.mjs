// scripts/gate.mjs — 本项目的门禁。退出码 0 才允许提交/发布。
//
// 为什么不用 `npm test && npm run build` 一行搞定：
// 2026-10-05 我们在另一套工装上坐实过一个 fail-open —— "按计数判绿"的闸门，
// 一旦目标解析为空集（用例名写错、目录改名、被过滤光），循环不执行、无 finding、
// 仍然退 0。所以这里显式断言"真的跑到了东西"，三处都不许静默通过：
//   1) 测试文件数 > 0        2) 实际执行的用例数 > 0        3) 构建产物非空
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const say = (m) => process.stdout.write(m + "\n");
const fail = (m) => {
  say(`FAIL  ${m}`);
  process.exit(1);
};
const run = (cmd, args) => {
  say(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (r.error) fail(`${cmd} 无法执行：${r.error.message}`);
  return r.status ?? 1;
};

/**
 * 抓输出的跑法：成功时和 run() 一样安静，失败时把原始回显倒出来。
 * 2026-10-07 CI 上就是这么踩空的：`--reporter=json` 把 vitest 的回显吞了，
 * 门禁只留下一句"测试未通过"，看不出是哪一枚文件、为什么红 —— 我被迫去翻 JSON 报告
 * 才反推出"有一整个测试文件根本没被收进报告"。闸门必须自己会说话。
 */
const runCapture = (cmd, args) => {
  say(`\n$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, shell: false, encoding: "utf8" });
  if (r.error) fail(`${cmd} 无法执行：${r.error.message}`);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { rc: r.status ?? 1, out };
};

// ---- 0) 测试文件必须存在（空目录不算"没有需要测的东西"）----
const testDir = join(ROOT, "tests");
if (!existsSync(testDir)) fail("tests/ 不存在 —— 无测试不等于通过");
const testFiles = readdirSync(testDir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"));
if (testFiles.length === 0) fail(`tests/ 里没有任何 *.test.ts —— 无测试不等于通过（发现 ${testFiles.length} 个）`);
say(`测试文件：${testFiles.length} 个`);
const testBases = testFiles.map((f) => f.split("/").pop());

// 磁盘上的测试文件数必须和配置里 include 的模式对得上：
// 若 include 只写 *.test.ts，界面测试会被静默排除，"全绿"就成了假话。
const cfg = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
const includeLine = cfg.match(/include:\s*\[([^\]]*)\]/)?.[1] ?? "";
const coversTsx = includeLine.includes("tsx") || includeLine.includes("test.{ts,tsx}");
const hasTsxFiles = testFiles.some((f) => f.endsWith(".tsx"));
if (hasTsxFiles && !coversTsx) fail("存在 .tsx 界面测试，但 vitest include 不收它们 —— 会静默漏测");

// ---- 1) 类型门 ----
if (run("npx", ["tsc", "--noEmit"]) !== 0) fail("typecheck 未通过");

// ---- 2) 测试门（取 JSON 读数，不靠终端回显）----
const reportPath = join(ROOT, ".gate", "vitest.json");
mkdirSync(join(ROOT, ".gate"), { recursive: true });
// 先删陈旧报告：类型门失败时测试根本没跑，留着上一轮的 JSON 会被误读成"本轮全绿"
rmSync(reportPath, { force: true });
// verbose 与 json 同时挂：json 给读数，verbose 让"哪一条、为什么"进日志。
// 只挂 json 时 vitest 的回显几乎为空，红的时候门禁自己说不出原因。
const vitest = runCapture("npx", [
  "vitest", "run", "--reporter=verbose", "--reporter=json", "--outputFile=.gate/vitest.json",
]);
if (vitest.rc !== 0) {
  say("\n--- vitest 原始回显（末尾 60 行）---");
  say(vitest.out.split("\n").slice(-60).join("\n"));
  say("--- 回显结束 ---");
}
const rc = vitest.rc;

if (!existsSync(reportPath)) fail("vitest 未产出 JSON 报告 —— 无法证明跑过测试");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
if (rc !== 0) fail(`测试未通过（vitest 退出码 ${rc}）—— 上面的原始回显是原因`);
const total = report.numTotalTests ?? 0;
const failed = report.numFailedTests ?? 0;
const passed = report.numPassedTests ?? 0;
if (total === 0) fail("执行了 0 条用例 —— 空断言集不构成绿灯");
if (failed > 0) fail(`${failed} 条用例失败`);

// 报告必须覆盖磁盘上每一枚测试文件。漏掉的那个不会留下任何红痕迹：
// vitest 遇到"整个文件收集失败"时退出码非 0，但 JSON 里只写它成功收下的那些文件，
// 于是 numFailedTests=0、success=true —— 光看计数就是假的"全绿"。
const reported = (report.testResults ?? []).map((f) => (f.name ?? "").split("/").pop());
const missing = testBases.filter((f) => !reported.includes(f));
if (missing.length > 0)
  fail(`报告里没有 ${missing.length} 个测试文件：${missing.join(", ")} —— 它们没被执行，不能算过`);

say(`用例：${total} 条（通过 ${passed} / 失败 ${failed}）/ 报告覆盖 ${reported.length} 个文件`);

// ---- 3) 构建门 ----
if (run("npx", ["vite", "build"]) !== 0) fail("构建失败");
const distIndex = join(ROOT, "dist", "index.html");
if (!existsSync(distIndex)) fail("dist/index.html 不存在 —— 构建产物为空");
const assets = existsSync(join(ROOT, "dist", "assets")) ? readdirSync(join(ROOT, "dist", "assets")) : [];
if (assets.length === 0) fail("dist/assets 为空 —— 构建产物不完整");

say(`\nPASS  门禁通过：${testFiles.length} 个测试文件 / ${total} 条用例 / ${assets.length} 个构建产物`);
say("GATE_EXIT=0");
