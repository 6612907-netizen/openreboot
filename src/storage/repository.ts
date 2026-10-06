import type {
  Change,
  Database,
  Decision,
  DiagnosisFactor,
  FrictionScan,
  Interruption,
  Plan,
  Rep,
  RepOutcome,
  StageIndex,
} from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";
import { emptyDatabase, type KvStore } from "./db";
import { canEnter } from "../domain/stages";

/**
 * 所有写操作集中在这里，UI 不直接改对象。
 * 两条硬不变量在服务层强制（不靠界面隐藏按钮）：
 *   ① §3  同时只能有一个 active Change；
 *   ② §5  没完成 Change Readiness 就不许创建 Change。
 */

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export class GateError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "GateError";
  }
}

export interface Repo {
  load(): Promise<Database>;
  saveReady(scan: FrictionScan): Promise<Database>;
  createChange(title: string): Promise<Change>;
  activeChange(db: Database): Change | null;
  setAudit(id: string, patch: Partial<Change["audit"]>): Promise<Change>;
  setDecision(id: string, decision: Omit<Decision, "madeAt">): Promise<Change>;
  addLessonAnswer(id: string, lessonId: string, answer: string): Promise<Change>;
  setPlan(id: string, plan: Omit<Plan, "createdAt">): Promise<Change>;
  logRep(id: string, input: { date: string; outcome: RepOutcome; actualMinutes: number; evidenceNote: string }): Promise<Rep>;
  openInterruption(id: string, missedDates: string[]): Promise<Interruption>;
  diagnoseInterruption(id: string, interruptionId: string, factors: string[], note: string): Promise<void>;
  intervene(id: string, interruptionId: string, adjustment: string, effectiveFrom: string): Promise<void>;
  closeInterruption(id: string, interruptionId: string, learned: string): Promise<void>;
  advance(id: string, target: StageIndex): Promise<Change>;
  setSupervision(id: string, level: Change["supervision"], reason: string): Promise<Change>;
  setGraduation(id: string, patch: Partial<NonNullable<Change["graduation"]>>): Promise<Change>;
  graduate(id: string): Promise<Change>;
  erase(): Promise<void>;
  exportJson(): Promise<string>;
  importJson(text: string): Promise<Database>;
}

export function createRepository(store: KvStore): Repo {
  async function mutate(fn: (db: Database) => void): Promise<Database> {
    const db = (await store.get()) ?? emptyDatabase(nowIso());
    fn(db);
    db.profile.updatedAt = nowIso();
    await store.put(db);
    return db;
  }

  function findChange(db: Database, id: string): Change {
    const c = db.changes.find((x) => x.id === id);
    if (!c) throw new Error(`change not found: ${id}`);
    return c;
  }

  function touch(c: Change) {
    c.updatedAt = nowIso();
  }

  return {
    async load() {
      return (await store.get()) ?? emptyDatabase(nowIso());
    },

    async saveReady(scan) {
      return mutate((db) => {
        db.profile.readiness = scan;
      });
    },

    async createChange(title) {
      const db = (await store.get()) ?? emptyDatabase(nowIso());
      if (!db.profile.readiness) throw new GateError("gate.readiness");
      if (db.changes.some((c) => c.status === "active")) throw new GateError("只有一个进行中的改变：请先结束或暂停当前那个。");
      const t = title.trim();
      if (!t) throw new Error("title required");
      const c: Change = {
        id: newId(),
        title: t,
        stage: 1, // §4：做完 AWARE 检查后从 UNDERSTAND 起步；DECIDE 要等四段课程写完话
        status: "active",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        audit: null,
        decision: null,
        lessons: [],
        plan: null,
        reps: [],
        interruptions: [],
        supervision: "high",
        supervisionHistory: [{ level: "high", at: nowIso(), reason: "初始值" }],
        graduation: null,
      };
      await mutate((d) => {
        d.changes.push(c);
      });
      return c;
    },

    activeChange(db) {
      return db.changes.find((c) => c.status === "active") ?? null;
    },

    async setAudit(id, patch) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        const base = c.audit ?? {
          desiredChange: "",
          desiredOutcome: [],
          intrinsicReasons: [],
          externalReasons: [],
          benefitsOfChange: [],
          costsOfChange: [],
          benefitsOfStatusQuo: [],
          costsOfStatusQuo: [],
        };
        c.audit = { ...base, ...patch } as NonNullable<Change["audit"]>;
        out = c;
        touch(c);
      });
      return out;
    },

    async setDecision(id, decision) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        c.decision = { ...decision, madeAt: nowIso() };
        // §2.1：不改变 / 现在不是时候 都是合法终点 —— 直接归档，不留在 active。
        if (decision.kind !== "commit") c.status = "closed";
        out = c;
        touch(c);
      });
      return out;
    },

    async addLessonAnswer(id, lessonId, answer) {
      await mutate((db) => {
        const c = findChange(db, id);
        const existing = c.lessons.find((l) => l.lessonId === lessonId);
        if (existing) existing.answer = answer;
        else c.lessons.push({ lessonId, answer, completedAt: nowIso() });
        touch(c);
      });
      return findChange((await store.get())!, id);
    },

    async setPlan(id, plan) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        c.plan = { ...plan, createdAt: nowIso() };
        out = c;
        touch(c);
      });
      return out;
    },

    async logRep(id, input) {
      const rep: Rep = { id: newId(), ...input, loggedAt: nowIso() };
      await mutate((db) => {
        const c = findChange(db, id);
        c.reps.push(rep);
        if (input.outcome === "missed") {
          const open = c.interruptions.find((i) => !i.closedAt);
          if (open) {
            if (!open.missedDates.includes(input.date)) open.missedDates.push(input.date);
          } else {
            c.interruptions.push({
              id: newId(),
              openedAt: nowIso(),
              missedDates: [input.date],
              diagnosis: null,
              intervention: null,
              recoveredOn: null,
              learned: null,
              closedAt: null,
            });
          }
          c.stage = Math.max(c.stage, 5) as StageIndex; // 进入 ADAPT
        } else {
          // 非 missed 即有行为：若正处中断中，回填恢复日期（§2.4 Recovery）
          const open = c.interruptions.find((i) => !i.closedAt);
          if (open && !open.recoveredOn) open.recoveredOn = input.date;
        }
        touch(c);
      });
      return rep;
    },

    async openInterruption(id, missedDates) {
      let out!: Interruption;
      await mutate((db) => {
        const c = findChange(db, id);
        out = {
          id: newId(),
          openedAt: nowIso(),
          missedDates,
          diagnosis: null,
          intervention: null,
          recoveredOn: null,
          learned: null,
          closedAt: null,
        };
        c.interruptions.push(out);
        c.stage = Math.max(c.stage, 5) as StageIndex;
        touch(c);
      });
      return out;
    },

    async diagnoseInterruption(id, interruptionId, factors, note) {
      await mutate((db) => {
        const c = findChange(db, id);
        const i = c.interruptions.find((x) => x.id === interruptionId);
        if (i) i.diagnosis = { factors: factors as DiagnosisFactor[], note };
        touch(c);
      });
    },

    async intervene(id, interruptionId, adjustment, effectiveFrom) {
      await mutate((db) => {
        const c = findChange(db, id);
        const i = c.interruptions.find((x) => x.id === interruptionId);
        if (i) i.intervention = { adjustment, effectiveFrom };
        touch(c);
      });
    },

    async closeInterruption(id, interruptionId, learned) {
      await mutate((db) => {
        const c = findChange(db, id);
        const i = c.interruptions.find((x) => x.id === interruptionId);
        if (i) {
          i.learned = learned;
          i.closedAt = nowIso();
        }
        if (!c.interruptions.some((x) => !x.closedAt) && c.stage === 5) c.stage = 4 as StageIndex;
        touch(c);
      });
    },

    async advance(id, target) {
      let out!: Change;
      const db = (await store.get()) ?? emptyDatabase(nowIso());
      const c = findChange(db, id);
      const gate = canEnter(c, target, db.profile.readiness);
      if (!gate.ok) throw new GateError(gate.reason ?? "gate.skip");
      await mutate((d) => {
        out = findChange(d, id);
        out.stage = target;
        touch(out);
      });
      return out;
    },

    async setSupervision(id, level, reason) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        c.supervision = level;
        c.supervisionHistory.push({ level, at: nowIso(), reason });
        out = c;
        touch(c);
      });
      return out;
    },

    async setGraduation(id, patch) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        c.graduation = {
          proposedAt: nowIso(),
          criteriaMet: [],
          selfRunPlan: "",
          completedAt: null,
          ...(c.graduation ?? {}),
          ...patch,
        };
        out = c;
        touch(c);
      });
      return out;
    },

    async graduate(id) {
      let out!: Change;
      await mutate((db) => {
        const c = findChange(db, id);
        c.stage = 7;
        c.status = "graduated";
        c.graduation = { ...(c.graduation ?? { proposedAt: nowIso(), criteriaMet: [], selfRunPlan: "" }), completedAt: nowIso() };
        out = c;
        touch(c);
      });
      return out;
    },

    async erase() {
      await store.clear();
    },

    async exportJson() {
      const db = (await store.get()) ?? emptyDatabase(nowIso());
      return JSON.stringify({ app: "OpenReboot", schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data: db }, null, 2);
    },

    async importJson(text) {
      const parsed = JSON.parse(text) as { schemaVersion?: number; data?: Database };
      if (!parsed || typeof parsed !== "object" || !parsed.data || !Array.isArray(parsed.data.changes) || !parsed.data.profile) {
        throw new Error("不是 OpenReboot 导出文件（缺 profile / changes）。");
      }
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        throw new Error(`文件版本 ${String(parsed.schemaVersion)} 与当前 ${SCHEMA_VERSION} 不匹配，暂不自动迁移。`);
      }
      await store.put(parsed.data);
      return parsed.data;
    },
  };
}

export const todayStamp = today;
