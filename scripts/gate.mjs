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

// ---- 0) 测试文件必须存在（空目录不算"没有需要测的东西"）----
const testDir = join(ROOT, "tests");
if (!existsSync(testDir)) fail("tests/ 不存在 —— 无测试不等于通过");
const testFiles = readdirSync(testDir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"));
if (testFiles.length === 0) fail(`tests/ 里没有任何 *.test.ts —— 无测试不等于通过（发现 ${testFiles.length} 个）`);
say(`测试文件：${testFiles.length} 个`);

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
if (run("npx", ["vitest", "run", "--reporter=json", "--outputFile=.gate/vitest.json"]) !== 0)
  fail("测试未通过");

if (!existsSync(reportPath)) fail("vitest 未产出 JSON 报告 —— 无法证明跑过测试");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const total = report.numTotalTests ?? 0;
const failed = report.numFailedTests ?? 0;
const passed = report.numPassedTests ?? 0;
if (total === 0) fail("执行了 0 条用例 —— 空断言集不构成绿灯");
if (failed > 0) fail(`${failed} 条用例失败`);
say(`用例：${total} 条（通过 ${passed} / 失败 ${failed}）`);

// ---- 3) 构建门 ----
if (run("npx", ["vite", "build"]) !== 0) fail("构建失败");
const distIndex = join(ROOT, "dist", "index.html");
if (!existsSync(distIndex)) fail("dist/index.html 不存在 —— 构建产物为空");
const assets = existsSync(join(ROOT, "dist", "assets")) ? readdirSync(join(ROOT, "dist", "assets")) : [];
if (assets.length === 0) fail("dist/assets 为空 —— 构建产物不完整");

say(`\nPASS  门禁通过：${testFiles.length} 个测试文件 / ${total} 条用例 / ${assets.length} 个构建产物`);
say("GATE_EXIT=0");
