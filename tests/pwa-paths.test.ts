/**
 * PWA 在子路径下必须还能装起来 —— 这枚文件钉的是"路径写法"，
 * 因为 GitHub Pages 会把站点放在 /openreboot/ 下面，而任何以 "/" 开头的写法
 * 都会指到域名根，于是 manifest 404、Service Worker 注册失败、离线全废，
 * 而在 localhost 根目录下跑却一切正常 —— 典型的"本地绿、线上红"形状。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const abs = (s: string) => s.startsWith("/");

describe("PWA 资源全部走相对路径（可放子目录）", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
    start_url?: string;
    scope?: string;
    icons?: { src: string }[];
  };

  it("start_url 是相对的", () => {
    expect(manifest.start_url).toBe("./");
  });
  it("scope 是相对的", () => {
    expect(manifest.scope).toBe("./");
  });
  it("每个图标 src 都不以 / 开头", () => {
    expect((manifest.icons ?? []).length).toBeGreaterThan(0);
    for (const i of manifest.icons ?? []) expect(abs(i.src), i.src).toBe(false);
  });

  it("index.html 的 manifest / icon / 入口脚本都是相对路径", () => {
    const html = read("index.html");
    const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]!);
    // 下限按实物来：现在就是 manifest / icon / 入口脚本三枚。取"至少 3"而不是">3"，
    // 是为了这条判据在链接被清空时照样会红（空集不许判绿）。
    expect(hrefs.length, "一个链接都没有，等于没测").toBeGreaterThanOrEqual(3);
    for (const h of hrefs) expect(abs(h), h).toBe(false);
  });

  it("Service Worker 用相对 URL 注册（否则 scope 会跑到域名根）", () => {
    expect(read("src/main.tsx")).toMatch(/register\("\.\/sw\.js"\)/);
  });

  it("vite base 用相对路径，产物可放任意子目录", () => {
    expect(read("vite.config.ts")).toMatch(/base:\s*"\.\/"/);
  });

  it("sw.js 不硬编码站点根路径的预置清单", () => {
    const sw = read("public/sw.js");
    expect(sw).not.toMatch(/cache\.addAll\(\[\s*["']/);
    expect(sw).not.toMatch(/['"]\/(index\.html|assets|sw\.js)/);
  });
});
