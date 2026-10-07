import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "../src/storage/db";
import { createRepository, GateError, type Repo } from "../src/storage/repository";
import type { FrictionScan } from "../src/domain/types";

const scan: FrictionScan = {
  answers: { q1: "often", q2: "almostAlways" },
  areas: ["learning"],
  primaryArea: "learning",
  completedAt: "2026-10-01T00:00:00.000Z",
};

let store: ReturnType<typeof memoryStore>;
let repo: Repo;

beforeEach(async () => {
  store = memoryStore();
  repo = createRepository(store);
});

describe("§5 服务层强制前置，不靠 UI 隐藏", () => {
  it("没做检查就建 Change ⇒ GateError(gate.readiness)", async () => {
    await expect(repo.createChange("稳定写作")).rejects.toBeInstanceOf(GateError);
    await expect(repo.createChange("稳定写作")).rejects.toThrow("gate.readiness");
  });
  it("做完检查后可以创建，且起始阶段是 UNDERSTAND", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("稳定写作");
    expect(c.stage).toBe(1);
    expect(c.supervision).toBe("high");
  });
});

describe("§3 同时只能有一个进行中的改变", () => {
  it("第二个 active 被拒", async () => {
    await repo.saveReady(scan);
    await repo.createChange("第一个");
    await expect(repo.createChange("第二个")).rejects.toThrow(/只有一个进行中的改变/);
  });
  // Baseline §02 定稿后改的判据：observe / keep 不再"顺手替用户归档"。
  // 旧断言是"选了就等于结束、名额立刻释放"，那等于把「继续观察」做成一条死路 ——
  // 用户既回不到这条判断，也不知道自己的理由去了哪。现在必须他自己按「归档」。
  it("选「暂时不改变」之后这条仍然 active，也不会被偷偷推进", async () => {
    await repo.saveReady(scan);
    const a = await repo.createChange("第一个");
    await repo.setDecision(a.id, { kind: "keep", note: "想清楚了，暂不做" });
    const after = repo.activeChange(await repo.load());
    expect(after?.id).toBe(a.id);
    expect(after?.status).toBe("active");
    expect(after?.stage).toBe(1); // 没被推进；等他走到 DECIDE 后仍可重新选一个出口
    expect(repo.activeChange(await repo.load())?.decision?.kind).toBe("keep");
  });

  it("由用户自己归档之后，才可以开新的 Active Change", async () => {
    await repo.saveReady(scan);
    const a = await repo.createChange("第一个");
    await repo.setDecision(a.id, { kind: "observe", note: "再看看" });
    await expect(repo.createChange("第二个")).rejects.toThrow(/只有一个进行中的改变/);
    const closed = await repo.archiveChange(a.id);
    expect(closed.status).toBe("closed");
    expect(repo.activeChange(await repo.load())).toBeNull();
    const b = await repo.createChange("第二个");
    expect(b.id).not.toBe(a.id);
  });

  it("已经决定改变的那条不许被归档（归档只服务 observe / keep）", async () => {
    await repo.saveReady(scan);
    const a = await repo.createChange("第一个");
    await repo.setDecision(a.id, { kind: "change", note: "做" });
    await expect(repo.archiveChange(a.id)).rejects.toThrow(/不归档/);
  });
});

describe("§2.4 Missed → Diagnose → Intervention → Recovery → Learn", () => {
  it("记一次没做会自动开一条中断，并进入 ADAPT", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("稳定写作");
    await repo.logRep(c.id, { date: "2026-10-03", outcome: "missed", actualMinutes: 0, evidenceNote: "" });
    const after = (await repo.load()).changes[0]!;
    expect(after.interruptions).toHaveLength(1);
    expect(after.interruptions[0]!.closedAt).toBeNull();
    expect(after.stage).toBe(5);
  });
  it("第二次没做并入同一条中断，不重复开", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("x");
    await repo.logRep(c.id, { date: "2026-10-03", outcome: "missed", actualMinutes: 0, evidenceNote: "" });
    await repo.logRep(c.id, { date: "2026-10-04", outcome: "missed", actualMinutes: 0, evidenceNote: "" });
    const after = (await repo.load()).changes[0]!;
    expect(after.interruptions).toHaveLength(1);
    expect(after.interruptions[0]!.missedDates).toEqual(["2026-10-03", "2026-10-04"]);
  });
  it("恢复后回填 recoveredOn；走完四步可关闭并回到 TRAIN", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("x");
    await repo.logRep(c.id, { date: "2026-10-03", outcome: "missed", actualMinutes: 0, evidenceNote: "" });
    const opened = (await repo.load()).changes[0]!.interruptions[0]!;
    await repo.diagnoseInterruption(c.id, opened.id, ["actionTooBig"], "动作太大");
    await repo.intervene(c.id, opened.id, "改成每次 10 分钟", "2026-10-05");
    await repo.logRep(c.id, { date: "2026-10-05", outcome: "done", actualMinutes: 12, evidenceNote: "写了 200 字" });
    await repo.closeInterruption(c.id, opened.id, "小步比意志力可靠");

    const after = (await repo.load()).changes[0]!;
    const i = after.interruptions[0]!;
    expect(i.diagnosis?.factors).toEqual(["actionTooBig"]);
    expect(i.intervention?.adjustment).toContain("10 分钟");
    expect(i.recoveredOn).toBe("2026-10-05");
    expect(i.learned).toContain("小步");
    expect(after.stage).toBe(4); // 回到 TRAIN
  });
});

describe("阶段推进的服务层把关", () => {
  it("没承诺就想到 REBOOT ⇒ 被拒", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("x");
    // 一次只走一步：stage 1 直接跳 3 会先被"跨级"拦下，所以这里测的是 1→2 的课程门
    await expect(repo.advance(c.id, 2)).rejects.toThrow("gate.lessons");
    for (const l of ["lesson-01", "lesson-02", "lesson-03", "lesson-04"]) {
      await repo.addLessonAnswer(c.id, l, "写过了");
    }
    await repo.advance(c.id, 2);
    await expect(repo.advance(c.id, 3)).rejects.toThrow("gate.commit");
  });
  it("承诺 + 审计齐全后进 REBOOT", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("x");
    for (const l of ["lesson-01", "lesson-02", "lesson-03", "lesson-04"]) await repo.addLessonAnswer(c.id, l, "写过了");
    await repo.advance(c.id, 2);
    await repo.setAudit(c.id, { desiredChange: "稳定写作", intrinsicReasons: ["自己想写"] });
    await repo.setDecision(c.id, { kind: "change", note: "试试" });
    const next = await repo.advance(c.id, 3);
    expect(next.stage).toBe(3);
  });
});

describe('导入旧导出文件：三种出口的旧名字要认，认不出就整份拒绝', () => {
  const wrap = (changes: unknown[]) =>
    JSON.stringify({ app: "OpenReboot", schemaVersion: 1, data: { profile: { createdAt: "", updatedAt: "", readiness: scan }, changes } });

  it("v0.1.0 的 commit / notNow / stayAsIs 翻译成 change / observe / keep", async () => {
    const legacy = [
      { kind: "commit", want: "change" },
      { kind: "notNow", want: "observe" },
      { kind: "stayAsIs", want: "keep" },
    ];
    for (const { kind, want } of legacy) {
      const fresh = createRepository(memoryStore());
      await fresh.importJson(
        wrap([{ id: "c1", title: "t", stage: 1, status: "active", createdAt: "", updatedAt: "",
                audit: null, decision: { kind, madeAt: "", note: "" }, lessons: [], plan: null,
                reps: [], interruptions: [], supervision: "high", supervisionHistory: [], graduation: null }]),
      );
      const db = await fresh.load();
      expect(db.changes[0]?.decision?.kind, `旧值 ${kind}`).toBe(want);
    }
  });

  it("认不出的决定类型：拒绝导入，且不动现有数据", async () => {
    await repo.saveReady(scan);
    const before = await repo.exportJson();
    const evil = wrap([{ id: "c9", title: "t", stage: 1, status: "active", createdAt: "", updatedAt: "",
      audit: null, decision: { kind: "yolo", madeAt: "", note: "" }, lessons: [], plan: null,
      reps: [], interruptions: [], supervision: "high", supervisionHistory: [], graduation: null }]);
    await expect(repo.importJson(evil)).rejects.toThrow(/认不出的决定类型/);
    expect(await repo.exportJson()).toBe(before);
  });
});

describe("数据所有权（本地优先的落地要求）", () => {
  it("导出→清空→导入 逐字节等价", async () => {
    await repo.saveReady(scan);
    const c = await repo.createChange("稳定写作");
    await repo.logRep(c.id, { date: "2026-10-01", outcome: "done", actualMinutes: 25, evidenceNote: "写完一段" });
    const dump = await repo.exportJson();

    await repo.erase();
    expect((await repo.load()).changes).toHaveLength(0);

    await repo.importJson(dump);
    const back = await repo.load();
    expect(back.changes[0]!.title).toBe("稳定写作");
    expect(back.changes[0]!.reps[0]!.actualMinutes).toBe(25);
    expect(back.profile.readiness?.primaryArea).toBe("learning");
  });
  it("拒绝非本应用的导入文件", async () => {
    await expect(repo.importJson(JSON.stringify({ foo: 1 }))).rejects.toThrow(/不是 OpenReboot 导出文件/);
  });
  it("版本不匹配时拒绝静默迁移", async () => {
    const bad = JSON.stringify({ schemaVersion: 999, data: { profile: {}, changes: [] } });
    await expect(repo.importJson(bad)).rejects.toThrow(/不匹配/);
  });
});
