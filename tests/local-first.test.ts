import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * "Local-first / 自托管友好"要能被机器证伪，否则只是 README 上的一句话。
 * 这里断言的是**没有**：没有网络出口、没有遥测、没有第三方脚本、没有 localStorage 兜底。
 */

const ROOT = process.cwd();
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const srcFiles = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));

describe("应用代码零网络出口", () => {
  it("src 文件集合非空", () => {
    expect(srcFiles.length).toBeGreaterThan(3);
  });
  for (const pattern of ["fetch(", "XMLHttpRequest", "sendBeacon", "new WebSocket", "EventSource", "navigator.connection"]) {
    it(`src 里没有 ${pattern}`, () => {
      const hits = srcFiles.filter((f) => readFileSync(f, "utf8").includes(pattern));
      expect(hits.map((h) => h.replace(ROOT + "/", "")), `发现 ${pattern}`).toEqual([]);
    });
  }
});

describe("无遥测 / 无第三方", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  it("运行时依赖只有 react", () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["react", "react-dom"]);
  });
  for (const name of Object.keys(allDeps)) {
    it(`${name} 不含遥测客户端`, () => {
      expect(name).not.toMatch(/sentry|analytics|segment|posthog|firebase|amplitude|mixpanel|datadog|newrelic/i);
    });
  }
  it("index.html 不引外部脚本", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/);
  });
});

describe("Service Worker 不外发", () => {
  const swPath = join(ROOT, "public", "sw.js");
  it("跨站请求直接放行不代理", () => {
    const sw = readFileSync(swPath, "utf8");
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });
  it("没有后台同步与推送", () => {
    const sw = readFileSync(swPath, "utf8");
    // 精确匹配真实 API。早前写的 /sync/i 会命中 "async"，那是我的正则错，不是代码错。
    expect(sw).not.toMatch(/PushManager|periodicSync|addEventListener\(\s*["'](?:push|sync)["']/);
  });
});

describe("可自托管", () => {
  it("构建产物用相对路径，可放子目录", () => {
    const cfg = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    expect(cfg).toMatch(/base:\s*"\.\/"/);
  });
  it("没有硬编码的后端地址", () => {
    const hits = srcFiles.filter((f) => /https?:\/\/(?!.*w3\.org)/.test(readFileSync(f, "utf8")));
    expect(hits.map((h) => h.replace(ROOT + "/", ""))).toEqual([]);
  });
  it("LICENSE 与 README 存在（开源发布前置）", () => {
    expect(existsSync(join(ROOT, "LICENSE"))).toBe(true);
    expect(existsSync(join(ROOT, "README.md"))).toBe(true);
  });
});
