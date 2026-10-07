import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gateMessage } from "../src/i18n/copy";
import { describe, expect, it } from "vitest";
import { canEnter, lessonsDone, readinessComplete, lessonsRequired } from "../src/domain/stages";
import { summarizeEvidence, declarationGap, reviewAudit, median } from "../src/domain/evidence";
import { completionRate, nextLower, proposeStepDown, graduationReady } from "../src/domain/supervision";
import type { Change, FrictionScan, Rep } from "../src/domain/types";

const scan = (n: number, primary = true): FrictionScan => ({
  answers: Object.fromEntries(Array.from({ length: n }, (_, i) => [`q${i + 1}`, "often"])),
  areas: ["learning", "timeUse"],
  primaryArea: primary ? "learning" : null,
  completedAt: "2026-10-01T00:00:00.000Z",
});

const rep = (date: string, outcome: Rep["outcome"], minutes: number): Rep => ({
  id: date + outcome,
  date,
  outcome,
  actualMinutes: minutes,
  evidenceNote: "x",
  loggedAt: date,
});

const baseChange = (over: Partial<Change> = {}): Change => ({
  id: "c1",
  title: "稳定写作",
  stage: 1,
  status: "active",
  createdAt: "",
  updatedAt: "",
  audit: null,
  decision: null,
  lessons: [],
  plan: null,
  reps: [],
  interruptions: [],
  supervision: "high",
  supervisionHistory: [],
  graduation: null,
  ...over,
});

describe("§5 AWARE 前置：没做完检查不许往下", () => {
  it("空 readiness 挡住进入 UNDERSTAND", () => {
    expect(canEnter(baseChange(), 1, null).ok).toBe(false);
    expect(readinessComplete(null)).toBe(false);
  });
  it("答了题但没选主领域，仍算未完成", () => {
    expect(readinessComplete(scan(7, false))).toBe(false);
    expect(readinessComplete(scan(7))).toBe(true);
  });
  it("一次只能走一步，不许跨级跳", () => {
    const g = canEnter(baseChange({ stage: 1 }), 4, scan(7));
    expect(g.ok).toBe(false);
    expect(g.reason).toBe("gate.skip");
  });
});

describe("§2.1 决定：没有承诺就不许进入设计阶段", () => {
  it("缺决定 ⇒ gate.commit", () => {
    expect(canEnter(baseChange({ stage: 2 }), 3, scan(7)).reason).toBe("gate.commit");
  });
  it("选「暂时不改变」不打开后续阶段，但也不报错", () => {
    const c = baseChange({ stage: 2, decision: { kind: "keep", madeAt: "", note: "" }, audit: { desiredChange: "x", desiredOutcome: [], intrinsicReasons: [], externalReasons: [], benefitsOfChange: [], costsOfChange: [], benefitsOfStatusQuo: [], costsOfStatusQuo: [] } });
    expect(canEnter(c, 3, scan(7)).reason).toBe("gate.commit");
  });
  it("课程没写满四段不许进 DECIDE", () => {
    const c = baseChange({ stage: 1, lessons: [{ lessonId: "lesson-01", answer: "断了在意愿", completedAt: "" }] });
    expect(lessonsDone(c)).toBe(1);
    expect(lessonsRequired).toBe(4);
    expect(canEnter(c, 2, scan(7)).reason).toBe("gate.lessons");
  });
});

describe("§2.3 行为比宣言重要", () => {
  it("零记录时不给落差结论，避免拿空数据劝人改目标", () => {
    const ev = summarizeEvidence([]);
    expect(ev.medianMinutes).toBeNull();
    expect(ev.weeklyRate).toBeNull();
    const plan = { declaredIntent: "每天4小时", evidenceBasedTarget: "", minAction: "", cue: "", sessionsPerWeek: 7, maxSessionMinutes: 240, environmentChanges: [], reviewAfterDays: 14, createdAt: "" };
    expect(declarationGap(plan as never, ev)).toBeNull();
  });
  it("实际远低于计划时给出落差，且只引用记录数", () => {
    const dates = ["2026-09-01", "2026-09-05", "2026-09-10", "2026-09-15", "2026-09-20"];
    const ev = summarizeEvidence(dates.map((d) => rep(d, "done", 25)));
    expect(ev.totalReps).toBe(5);
    expect(ev.medianMinutes).toBe(25);
    const gap = declarationGap({ sessionsPerWeek: 7 } as never, ev);
    expect(gap).toBeTruthy();
    expect(gap).toContain("5");
  });
  it("中位数不受极端值绑架", () => {
    expect(median([5, 5, 6, 7, 300])).toBe(6);
  });
});

describe("§9 只提问，不下结论", () => {
  const empty = { desiredChange: "创业", desiredOutcome: [], intrinsicReasons: [], externalReasons: [], benefitsOfChange: [], costsOfChange: [], benefitsOfStatusQuo: [], costsOfStatusQuo: [] };
  it("全是外界期待 ⇒ 指出矛盾", () => {
    const f = reviewAudit({ ...empty, externalReasons: ["父母希望"] });
    expect(f.map((x) => x.id)).toContain("only-external-reasons");
  });
  it("没写不改变的代价 ⇒ 追问", () => {
    const f = reviewAudit({ ...empty, intrinsicReasons: ["自己想"] });
    expect(f.map((x) => x.id)).toContain("no-cost-of-staying");
  });
  it("输出永远是问句，不含人格判断词", () => {
    const f = reviewAudit({ ...empty, externalReasons: ["a"], intrinsicReasons: ["b"] });
    for (const x of f) {
      expect(x.question).toMatch(/[?？]$/);
      expect(x.question).not.toMatch(/你这个人|人格|懒惰|不自律|心理疾病/);
    }
  });
});

describe("§2.5 监督只降不升，且无证据不降", () => {
  it("阶梯顺序固定且 none 之后没有更低", () => {
    expect(nextLower("high")).toBe("medium");
    expect(nextLower("none")).toBeNull();
  });
  it("证据不足时不给降档建议", () => {
    const c = baseChange({ plan: { sessionsPerWeek: 3 } as never });
    expect(proposeStepDown(c, summarizeEvidence([]), c.plan)).toBeNull();
  });
  it("稳定达成才建议降一档", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `2026-09-${String(i * 2 + 1).padStart(2, "0")}`);
    const ev = summarizeEvidence(dates.map((d) => rep(d, "done", 30)));
    const c = baseChange({ supervision: "high", plan: { sessionsPerWeek: 3 } as never });
    expect(completionRate(ev)).toBe(1);
    const p = proposeStepDown(c, ev, c.plan);
    expect(p?.to).toBe("medium");
    expect(p?.reason).toContain("19");
    // §2.2：降档理由也是给用户看的，不许出现断签式措辞
    expect(p?.reason).not.toContain("连续");
  });
  it("毕业必须用户自己说准备好", () => {
    const c = baseChange({ supervision: "none", graduation: { proposedAt: "", criteriaMet: [], selfRunPlan: "每周日看一次日历", completedAt: null } });
    expect(graduationReady(c, false)).toBe(false);
    expect(graduationReady(c, true)).toBe(true);
  });
});

describe("阶段判据的原因码必须都能翻成人话（不许把内部码甩给用户）", () => {
  const src = readFileSync(join(process.cwd(), "src/domain/stages.ts"), "utf8");
  const codes = [...src.matchAll(/reason:\s*"([^"]+)"/g)].map((m) => m[1] as string);
  it("stages.ts 里确实在抛原因码", () => {
    expect(codes.length).toBeGreaterThan(5);
  });
  for (const code of [...new Set(codes)]) {
    it(`${code} 有对应文案`, () => {
      expect(gateMessage(code)).not.toBe(code);
      expect(gateMessage(code).length).toBeGreaterThan(3);
    });
  }
});
