import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BANNED_USER_FACING_TERMS, PREFERRED_TERMS, copy } from "../src/i18n/copy";
import { LESSONS } from "../src/content/lessons";

/**
 * 方案书 §2.2 把"不制造羞耻"写成了一组禁用词和一组应使用的词。
 * 口号会褪色，测试不会 —— 这里把它变成提交前必过的门。
 */

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

const userFacing = [...collectStrings(copy), ...collectStrings(LESSONS)];

/**
 * 补一个早前漏掉的口子：domain/ 里有些字符串是**直接渲染给用户**的
 * （降档理由、宣言与行为的落差句），它们不在 copy.ts 里，因此原先扫不到。
 * 这里生成真实样本一起扫。
 */
import { proposeStepDown } from "../src/domain/supervision";
import { declarationGap, summarizeEvidence } from "../src/domain/evidence";
import type { Change, Rep } from "../src/domain/types";

const mkRep = (date: string, minutes: number): Rep =>
  ({ id: date, date, outcome: "done", actualMinutes: minutes, evidenceNote: "", loggedAt: date }) as Rep;

const sampleChange = {
  id: "c", title: "t", stage: 4, status: "active", createdAt: "", updatedAt: "",
  audit: null, decision: null, lessons: [], interruptions: [], supervision: "high",
  supervisionHistory: [], graduation: null,
  plan: { sessionsPerWeek: 3 },
  reps: Array.from({ length: 10 }, (_, i) => mkRep(`2026-09-${String(i * 2 + 1).padStart(2, "0")}`, 25)),
} as unknown as Change;

const domainStrings = [
  proposeStepDown(sampleChange, summarizeEvidence(sampleChange.reps), sampleChange.plan)?.reason ?? "",
  declarationGap({ sessionsPerWeek: 7 } as never, summarizeEvidence(sampleChange.reps)) ?? "",
].filter(Boolean);

describe("§2.2 领域层产出的用户可见句同样受约束", () => {
  it("确实生成了样本（空样本不算通过）", () => {
    expect(domainStrings.length).toBeGreaterThan(0);
  });
  for (const term of BANNED_USER_FACING_TERMS) {
    it(`不出现「${term}」`, () => {
      const hits = domainStrings.filter((s) => s.includes(term));
      expect(hits, `命中「${term}」：${hits.join(" | ")}`).toEqual([]);
    });
  }
});

describe("§2.2 禁用词扫描", () => {
  it("文案集合非空（空集合不算通过）", () => {
    expect(userFacing.length).toBeGreaterThan(50);
  });
  for (const term of BANNED_USER_FACING_TERMS) {
    it(`不出现「${term}」`, () => {
      const hits = userFacing.filter((s) => s.includes(term));
      expect(hits, `命中「${term}」：${hits.join(" | ")}`).toEqual([]);
    });
  }
});

describe("§2.2 应使用的词确实被使用", () => {
  for (const term of PREFERRED_TERMS) {
    it(`包含「${term}」`, () => {
      expect(userFacing.some((s) => s.includes(term))).toBe(true);
    });
  }
});

describe("§2.4 记录里没有道德判断", () => {
  it("RepOutcome 三值里没有 failed", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/types.ts"), "utf8");
    const line = src.split("\n").find((l) => l.includes("export type RepOutcome"));
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/failed/);
    expect(line).toMatch(/missed/);
  });
});

describe("§2.5 不做参与度指标", () => {
  const srcDir = join(process.cwd(), "src");
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = walk(srcDir).filter((f) => /\.(ts|tsx)$/.test(f));

  for (const forbidden of ["streak", "DAU", "retention", "engagement", "score"]) {
    it(`源码里没有「${forbidden}」`, () => {
      const hits = files.filter((f) => readFileSync(f, "utf8").toLowerCase().includes(forbidden.toLowerCase()));
      expect(hits.map((h) => h.replace(process.cwd() + "/", "")), `发现 ${forbidden}`).toEqual([]);
    });
  }
});
