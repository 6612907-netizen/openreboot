import type { Change, SupervisionLevel, SupervisionStep } from "./types";
import { SUPERVISION_LEVELS } from "./types";
import type { Evidence } from "./evidence";

/**
 * §2.5「产品应该主动减少用户对自己的依赖」。
 * 这里的规则只允许**降档**（high → medium → light → none），
 * 且每次降档都必须绑定一条可回查的证据理由 —— 没有证据就不许降，
 * 有证据也**不自动降**：只产出建议，由用户确认。
 */

export interface StepDownProposal {
  from: SupervisionLevel;
  to: SupervisionLevel;
  reason: string;
}

/** 降档门槛：达成率与实际频次。数值刻意保守。 */
export const STEP_DOWN_RULES = {
  minSpanDays: 14,
  minActedReps: 8,
  /** done+partial 占全部记录的比例下限。 */
  minCompletionRate: 0.7,
  /** 实际周频次达到计划的这个比例。 */
  minRateRatio: 0.8,
} as const;

export const nextLower = (level: SupervisionLevel): SupervisionLevel | null => {
  const i = SUPERVISION_LEVELS.indexOf(level);
  return i >= 0 && i < SUPERVISION_LEVELS.length - 1 ? SUPERVISION_LEVELS[i + 1]! : null;
};

export function completionRate(ev: Evidence): number {
  if (ev.totalReps === 0) return 0;
  return (ev.doneCount + ev.partialCount) / ev.totalReps;
}

export function proposeStepDown(c: Change, ev: Evidence, plan: { sessionsPerWeek: number } | null): StepDownProposal | null {
  if (!plan || c.status !== "active") return null;
  const to = nextLower(c.supervision);
  if (!to) return null;

  const openInterruptions = c.interruptions.filter((i) => !i.closedAt).length;
  const recentMisses = c.reps.filter((r) => r.outcome === "missed").length;

  const enoughHistory = ev.spanDays >= STEP_DOWN_RULES.minSpanDays && ev.totalReps >= STEP_DOWN_RULES.minActedReps;
  const steady = completionRate(ev) >= STEP_DOWN_RULES.minCompletionRate;
  const onRate = plan.sessionsPerWeek > 0 && (ev.weeklyRate ?? 0) >= plan.sessionsPerWeek * STEP_DOWN_RULES.minRateRatio;
  const clean = openInterruptions === 0 && recentMisses === 0;

  if (enoughHistory && steady && onRate && clean) {
    return {
      from: c.supervision,
      to,
      // 措辞受 §2.2 约束：说"近 N 天"，不说"连续 N 天"（后者是断签式表达）。
      reason:
        `近 ${ev.spanDays} 天、${ev.totalReps} 条记录：达成率 ${(completionRate(ev) * 100).toFixed(0)}%，` +
        `实际每周 ${(ev.weeklyRate ?? 0).toFixed(1)} 次（计划 ${plan.sessionsPerWeek} 次），无未处理的中断。`,
    };
  }
  return null;
}

/** 降档必须留下痕迹，供毕业时回看。 */
export function applyStepDown(c: Change, p: StepDownProposal, at: string): SupervisionStep[] {
  return [...c.supervisionHistory, { level: p.to, at, reason: p.reason }];
}

/**
 * 毕业判据（§2.5 终点）。全部满足才允许进入 Stage 07。
 * 注意最后一条：**用户自己说**不再需要，而不是系统判定。
 */
export const GRADUATION_CRITERIA = [
  "supervision_none",
  "self_run_plan_written",
  "no_open_interruption",
  "user_says_ready",
] as const;

export function graduationReady(c: Change, userSaysReady: boolean): boolean {
  return (
    c.supervision === "none" &&
    !!c.graduation &&
    c.graduation.selfRunPlan.trim().length > 0 &&
    c.interruptions.every((i) => i.closedAt) &&
    userSaysReady
  );
}
