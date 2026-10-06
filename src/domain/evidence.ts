import type { ChangeAudit, Rep, Plan } from "./types";

/**
 * §2.3「行为比宣言重要」的算术化。
 * 只统计**实际记录到的行为**，宣言（declaredIntent）永远不作为事实来源。
 */

export interface Evidence {
  totalReps: number;
  doneCount: number;
  partialCount: number;
  missedCount: number;
  /** 有行为的记录（done + partial）里，单次分钟的中位数。无数据为 null。 */
  medianMinutes: number | null;
  /** 实际达成的周频次（按跨度天数折算）。 */
  weeklyRate: number | null;
  /** 跨度天数（首末记录之间，至少 1）。 */
  spanDays: number;
}

export function summarizeEvidence(reps: Rep[]): Evidence {
  if (reps.length === 0) {
    return {
      totalReps: 0,
      doneCount: 0,
      partialCount: 0,
      missedCount: 0,
      medianMinutes: null,
      weeklyRate: null,
      spanDays: 0,
    };
  }
  const sorted = [...reps].sort((a, b) => (a.date < b.date ? -1 : 1));
  const done = reps.filter((r) => r.outcome === "done");
  const partial = reps.filter((r) => r.outcome === "partial");
  const missed = reps.filter((r) => r.outcome === "missed");
  const acted = [...done, ...partial].map((r) => r.actualMinutes).sort((a, b) => a - b);

  const first = Date.parse(sorted[0]!.date);
  const last = Date.parse(sorted[sorted.length - 1]!.date);
  const spanDays = Math.max(1, Math.round((last - first) / 86_400_000) + 1);

  return {
    totalReps: reps.length,
    doneCount: done.length,
    partialCount: partial.length,
    missedCount: missed.length,
    medianMinutes: acted.length ? median(acted) : null,
    weeklyRate: (acted.length / spanDays) * 7,
    spanDays,
  };
}

export function median(sortedAsc: number[]): number {
  const n = sortedAsc.length;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid]! : Math.round(((sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2) * 10) / 10;
}

/**
 * 宣言与证据的落差。返回 null 表示证据还太少，**不许**据此劝用户改目标。
 * 阈值是刻意的保守值：至少 5 条行为记录才发言。
 */
export const MIN_REPS_TO_COMPARE = 5;

export function declarationGap(plan: Plan, ev: Evidence): string | null {
  if (ev.totalReps < MIN_REPS_TO_COMPARE || ev.weeklyRate === null) return null;
  const declared = plan.sessionsPerWeek;
  if (declared <= 0) return null;
  const ratio = ev.weeklyRate / declared;
  if (ratio < 0.5) {
    return `按已记录的 ${ev.totalReps} 次行为算，实际约每周 ${ev.weeklyRate.toFixed(1)} 次，` + `低于计划中的每周 ${declared} 次。`;
  }
  return null;
}

/**
 * §9 Change Equation 的"矛盾/未明确"检查 —— 纯本地、确定性、只提问不诊断。
 * 输出永远是**问题**，不是结论；不做任何人格或病理判断（§9 明令）。
 */
export interface Finding {
  id: string;
  /** 呈现给用户的问题文本（中文原文在此，测试用禁用词表扫描它）。 */
  question: string;
}

export function reviewAudit(a: ChangeAudit): Finding[] {
  const out: Finding[] = [];
  const n = (x: string[]) => x.map((s) => s.trim()).filter(Boolean).length;

  if (n(a.intrinsicReasons) === 0 && n(a.externalReasons) > 0) {
    out.push({
      id: "only-external-reasons",
      question: "写下的理由全部来自别人期待。如果没有人知道这件事，你还会做吗？",
    });
  } else if (n(a.externalReasons) > n(a.intrinsicReasons) && n(a.intrinsicReasons) > 0) {
    out.push({
      id: "external-outweighs-intrinsic",
      question: "外界期待比自己想做的多。哪一条理由是完全属于你自己的？",
    });
  }
  if (n(a.costsOfStatusQuo) === 0) {
    out.push({
      id: "no-cost-of-staying",
      question: "「不改变」这一栏是空的。再维持一年，会付出什么？",
    });
  }
  if (n(a.benefitsOfStatusQuo) === 0) {
    out.push({
      id: "no-benefit-of-staying",
      question: "现状一无是处的话，它为什么能维持这么久？它替你挡住了什么？",
    });
  }
  if (n(a.costsOfChange) === 0) {
    out.push({
      id: "no-cost-of-change",
      question: "改变看起来没有代价？那要牺牲的时间、精力或关系去哪了？",
    });
  }
  if (n(a.desiredOutcome) === 0) {
    out.push({
      id: "no-outcome",
      question: "写成一件可指认的事——做成之后，你具体会得到什么？",
    });
  }
  if (
    n(a.benefitsOfChange) > 0 &&
    n(a.costsOfChange) > 0 &&
    n(a.benefitsOfStatusQuo) > 0 &&
    n(a.costsOfStatusQuo) > 0
  ) {
    out.push({
      id: "all-four-filled",
      question: "四栏都填满了。刚才犹豫最久的是哪一栏？",
    });
  }
  return out;
}
