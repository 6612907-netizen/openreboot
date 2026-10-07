import type { Change, FrictionScan, StageIndex } from "./types";
import { STAGE_CODES } from "./types";

/**
 * Stage 推进判据（方案书 §4、§5、§2.1）。纯函数，全部可测。
 *
 * 最重要的一条不变量来自 §5：「第一次打开软件时，不允许直接创建 Goal，
 * 必须先完成 Change Readiness」—— 这条在服务端式校验里强制，不靠 UI 隐藏按钮。
 */

export interface Gate {
  ok: boolean;
  /** 不通过时给用户看的原因键（文案在 i18n 层，判据层不写字面文案）。 */
  reason?: string;
}

export const stageCode = (n: StageIndex) => STAGE_CODES[n];

export const readinessComplete = (r: FrictionScan | null): boolean =>
  !!r && Object.keys(r.answers).length > 0 && !!r.primaryArea;

/** 进入 Stage 03 之前必须存在的决定；Baseline §2.1：observe / keep 都是合法出口。 */
export const hasCommitment = (c: Change): boolean => c.decision?.kind === "change";

export const lessonsRequired = 4;

export const lessonsDone = (c: Change): number =>
  c.lessons.filter((l) => l.answer.trim().length > 0).length;

/** 未关闭的中断 = 正在 ADAPT。 */
export const openInterruptions = (c: Change) => c.interruptions.filter((i) => !i.closedAt);

export const canEnter = (c: Change, target: StageIndex, readiness: FrictionScan | null): Gate => {
  if (target <= c.stage) return { ok: false, reason: "gate.backwards" };
  if (target > c.stage + 1) return { ok: false, reason: "gate.skip" };

  switch (target) {
    case 1:
      return readinessComplete(readiness) ? { ok: true } : { ok: false, reason: "gate.readiness" };
    case 2:
      return lessonsDone(c) >= lessonsRequired ? { ok: true } : { ok: false, reason: "gate.lessons" };
    case 3:
      if (!hasCommitment(c)) return { ok: false, reason: "gate.commit" };
      return c.audit ? { ok: true } : { ok: false, reason: "gate.audit" };
    case 4:
      return c.plan && c.plan.minAction.trim() && c.plan.evidenceBasedTarget.trim()
        ? { ok: true }
        : { ok: false, reason: "gate.plan" };
    case 5:
      return openInterruptions(c).length > 0 ? { ok: true } : { ok: false, reason: "gate.noInterruption" };
    case 6:
      return openInterruptions(c).length === 0 && c.plan
        ? { ok: true }
        : { ok: false, reason: "gate.interruptionsOpen" };
    case 7:
      return c.supervision === "none" && !!c.graduation && c.graduation.selfRunPlan.trim().length > 0
        ? { ok: true }
        : { ok: false, reason: "gate.graduation" };
    default:
      return { ok: false, reason: "gate.skip" };
  }
};

/** 允许原地退回（例如从 TRAIN 回到 DECIDE 重看决定），但不允许跨级跳。 */
export const canReturn = (c: Change, target: StageIndex): Gate =>
  target < c.stage ? { ok: true } : { ok: false, reason: "gate.notEarlier" };
