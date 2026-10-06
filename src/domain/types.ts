/**
 * OpenReboot 领域模型 —— 方案书 §4 八个 Stage 的完整状态承载。
 *
 * 设计约束（来自方案书，不是我的偏好）：
 *  - §2.1 「不改变」是合法结果 ⇒ DecisionKind 有三个终值，不是二选一。
 *  - §2.2 不制造羞耻 ⇒ 记录里没有 "failed"，只有 done / partial / missed；
 *        文案层由 tests/shame-free-language.test.ts 机器把关。
 *  - §2.3 行为比宣言重要 ⇒ Plan 同时存 declaredIntent（说了什么）与
 *        evidenceBasedTarget（做到什么），二者由 review.ts 做差。
 *  - §2.4 Missed → Diagnose → Intervention → Recovery → Learn ⇒ Interruption 是一条
 *        有阶段的结构，不是一个布尔标记。
 *  - §2.5 摆脱软件 ⇒ SupervisionLevel 只能往下走，且 graduation 需要证据。
 *  - §3  一次只有一个 Active Change ⇒ 由 repository 层强制，不靠 UI。
 */

export const STAGE_CODES = [
  "AWARE",
  "UNDERSTAND",
  "DECIDE",
  "REBOOT",
  "TRAIN",
  "ADAPT",
  "INTERNALIZE",
  "GRADUATE",
] as const;

export type StageCode = (typeof STAGE_CODES)[number];
export type StageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** §6 四级频率。刻意不量化成数字分数（§9 禁止伪科学指数）。 */
export type Frequency = "never" | "sometimes" | "often" | "almostAlways";
export const FREQUENCIES: Frequency[] = ["never", "sometimes", "often", "almostAlways"];

/** §7 摩擦领域，MVP 最多选 3 个。 */
export const FRICTION_AREAS = [
  "workCreating",
  "learning",
  "timeUse",
  "bodyEnergy",
  "digitalLife",
  "relationships",
  "lifeDirection",
  "personalProject",
  "other",
] as const;
export type FrictionArea = (typeof FRICTION_AREAS)[number];
export const MAX_FRICTION_AREAS = 3;

/** §6 + §7 合并成的 Change Readiness 检查。§5：没做完不许建 Goal。 */
export interface FrictionScan {
  answers: Record<string, Frequency>;
  areas: FrictionArea[];
  primaryArea: FrictionArea | null;
  completedAt: string;
}

/** §8 方案书给定的结构，字段名逐字对齐。 */
export interface ChangeAudit {
  desiredChange: string;
  desiredOutcome: string[];
  intrinsicReasons: string[];
  externalReasons: string[];
  benefitsOfChange: string[];
  costsOfChange: string[];
  benefitsOfStatusQuo: string[];
  costsOfStatusQuo: string[];
}

/** §2.1 三种决定都通向合法结局；只有 commit 才继续往后走。 */
export type DecisionKind = "commit" | "notNow" | "stayAsIs";
export interface Decision {
  kind: DecisionKind;
  madeAt: string;
  /** 用户在决定页自己写的一句话理由（用于日后回看，不做评分）。 */
  note: string;
}

/** §10-11 微型交互课程的进度。 */
export interface LessonProgress {
  lessonId: string;
  /** 课程里的自我提问，用户自己的答案文本 —— 这是学习发生的证据，不是打卡。 */
  answer: string;
  completedAt: string;
}

/** §2.4 记录行为，不记录道德判断。 */
export type RepOutcome = "done" | "partial" | "missed";

export interface Rep {
  id: string;
  date: string; // YYYY-MM-DD
  outcome: RepOutcome;
  /** 实际发生的分钟数；missed 时为 0。§2.3：以这里为准，不以宣言为准。 */
  actualMinutes: number;
  /** 一句客观描述（"写完 300 字"），不写自我评价。 */
  evidenceNote: string;
  loggedAt: string;
}

/** §2.4 中断的可诊断原因。都是"哪一段链条断了"，不是"你这个人怎样"。 */
export const DIAGNOSIS_FACTORS = [
  "actionTooBig",
  "noCue",
  "noImmediateReward",
  "environmentConflict",
  "timingConflict",
  "energyInsufficient",
  "meaningUnclear",
  "externalPressure",
  "planUnrealistic",
  "other",
] as const;
export type DiagnosisFactor = (typeof DIAGNOSIS_FACTORS)[number];

/** Missed → Diagnose → Intervention → Recovery → Learn 的完整一条。 */
export interface Interruption {
  id: string;
  openedAt: string;
  missedDates: string[];
  diagnosis: { factors: DiagnosisFactor[]; note: string } | null;
  intervention: { adjustment: string; effectiveFrom: string } | null;
  /** 恢复行动的第一条 Rep 的日期 —— 由 repository 在记录时回填。 */
  recoveredOn: string | null;
  learned: string | null;
  closedAt: string | null;
}

/** §2.5 监督阶梯：只允许下降。 */
export const SUPERVISION_LEVELS = ["high", "medium", "light", "none"] as const;
export type SupervisionLevel = (typeof SUPERVISION_LEVELS)[number];

export interface SupervisionStep {
  level: SupervisionLevel;
  at: string;
  /** 依据哪条证据降档（可回查，不是系统自动拍脑袋）。 */
  reason: string;
}

/** Stage 03 REBOOT —— 把方向翻译成可执行的最小实验。 */
export interface Plan {
  /** 用户最初的宣言原文，例："每天学习 4 小时"。保留以便对照。 */
  declaredIntent: string;
  /** 依据已有证据校准后的目标，例："每周 3 次、每次 25 分钟"。 */
  evidenceBasedTarget: string;
  minAction: string;
  cue: string;
  sessionsPerWeek: number;
  maxSessionMinutes: number;
  environmentChanges: string[];
  /** 多久之后回看证据并决定是否降档监督。 */
  reviewAfterDays: number;
  createdAt: string;
}

/** Stage 07 GRADUATE —— 需要证据与"没有软件时怎么办"的预案。 */
export interface Graduation {
  proposedAt: string;
  criteriaMet: string[];
  selfRunPlan: string;
  completedAt: string | null;
}

export type ChangeStatus = "active" | "paused" | "graduated" | "closed";

export interface Change {
  id: string;
  title: string;
  stage: StageIndex;
  status: ChangeStatus;
  createdAt: string;
  updatedAt: string;
  audit: ChangeAudit | null;
  decision: Decision | null;
  lessons: LessonProgress[];
  plan: Plan | null;
  reps: Rep[];
  interruptions: Interruption[];
  supervision: SupervisionLevel;
  supervisionHistory: SupervisionStep[];
  graduation: Graduation | null;
}

export interface Profile {
  /** schema 版本，导出/导入与将来迁移都靠它。 */
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  readiness: FrictionScan | null;
}

export interface Database {
  profile: Profile;
  changes: Change[];
}

export const SCHEMA_VERSION = 1;
