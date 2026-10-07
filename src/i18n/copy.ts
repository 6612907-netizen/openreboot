/**
 * 全部**面向用户**的文案集中在此，目的是让 §2.2「不制造羞耻」成为可执行判据：
 * tests/shame-free-language.test.ts 会递归扫描本文件与 lessons.ts 的每一条字符串，
 * 命中禁用词即测试失败。判据层（domain/）不写任何字面文案，避免绕过这道门。
 *
 * 方案书 §6/§7/§9 给了原文的地方，此处逐字照抄。
 */

export const copy = {
  app: {
    name: "OpenReboot",
    tagline: "先判断要不要改变，再谈怎么改变。",
    offlineReady: "本机数据已就绪，离线可用。",
    privacyNote: "训练数据默认只存在这台设备的浏览器里。应用本身没有账号、没有后端、没有遥测；在线演示由 GitHub Pages 托管，它可能按自己的政策记录正常访问日志。",
  },

  welcome: {
    lines: [
      "你可能不需要“重启人生”。",
      "有时候我们只是累了、焦虑了，或者暂时对自己不满意。",
      "OpenReboot 不会马上要求你制定目标。",
      "我们先判断：",
      "你的生活中是否真的存在一个值得改变的问题？",
    ],
    cta: "开始检查",
    skipHint: "只是想看看，什么都不填也可以。",
  },

  /** §6 Life Friction Scan —— 题干逐字照抄 */
  scan: {
    intro: "过去 3 个月：",
    questions: [
      { id: "q1", text: "我知道某件事情很重要，但一直没有真正行动。" },
      { id: "q2", text: "我反复告诉自己“以后开始”“下周开始”。" },
      { id: "q3", text: "我对某个状态长期不满意，但已经逐渐习惯。" },
      { id: "q4", text: "我的时间实际花在哪里，与我认为重要的事情明显不同。" },
      { id: "q5", text: "我已经尝试改变某件事情多次，但最后总回到原状态。" },
      { id: "q6", text: "某些事情发生以后，我经常后悔自己当时的选择。" },
      { id: "q7", text: "我知道自己正在重复某种模式，但不知道为什么。" },
    ],
    options: [
      { value: "never", label: "从不" },
      { value: "sometimes", label: "偶尔" },
      { value: "often", label: "经常" },
      { value: "almostAlways", label: "几乎一直" },
    ],
    progress: "第 {n} / {total} 题",
  },

  /** §7 Friction Areas —— 选项逐字照抄，上限 3 个 */
  areas: {
    title: "主要摩擦领域",
    hint: "最多选 3 个。",
    limit: "最多选 3 个，先选最挡路的。",
    options: [
      { value: "workCreating", label: "工作 / 创造" },
      { value: "learning", label: "学习" },
      { value: "timeUse", label: "时间使用" },
      { value: "bodyEnergy", label: "身体 / 精力" },
      { value: "digitalLife", label: "数字生活" },
      { value: "relationships", label: "关系" },
      { value: "lifeDirection", label: "生活方向" },
      { value: "personalProject", label: "个人项目" },
      { value: "other", label: "其他" },
    ],
    primaryQuestion: "如果只能解决其中一个，哪个改变会对你的生活产生最大影响？",
  },

  readiness: {
    resultTitle: "意图与现实的差距",
    resultBody: "上面这些不是评分，只是把你已经写下的东西摆在一起看。",
    emptyHint: "一题都没答，就没有可看的差距。回去选一选。",
  },

  /** §8 Change Audit */
  audit: {
    title: "把这件事拆开看",
    intro: "先别急着定目标。系统不接受“我要创业”这种说法——它没法检验。",
    fields: {
      desiredChange: { label: "表面目标", hint: "你刚才说想做的事，原话。" },
      desiredOutcome: { label: "真正想获得的东西", hint: "做成之后，具体得到什么。" },
      intrinsicReasons: { label: "自己想做的理由", hint: "没有人知道也仍然成立的那些。" },
      externalReasons: { label: "外部期待", hint: "别人希望你做的那部分。" },
      benefitsOfChange: { label: "改变的收益" },
      costsOfChange: { label: "改变的成本" },
      benefitsOfStatusQuo: { label: "保持现状的收益", hint: "现状替你挡住了什么？" },
      costsOfStatusQuo: { label: "不改变的代价" },
    },
    addPlaceholder: "再写一条",
    remove: "删掉这条",
  },

  /** §9 Change Equation —— 四象限标签逐字照抄 */
  equation: {
    title: "改变等式",
    quadrants: {
      benefitsOfChange: "改变的收益",
      costsOfStatusQuo: "不改变的代价",
      costsOfChange: "改变的成本",
      benefitsOfStatusQuo: "保持现状的收益",
    },
    notScoring: "这里不给你算“改变指数”。四栏摆出来，剩下的判断是你的。",
    findingsTitle: "可以再想想的地方",
    findingsEmpty: "没发现明显的自相矛盾。",
  },

  /** §10-11 Stage 01 UNDERSTAND */
  understand: {
    title: "为什么知道不等于做到",
    intro: "四段短内容，每段 2–5 分钟。看完要写一句话，不写就不算过。",
    answerPlaceholder: "用你自己的话写一句。",
    next: "下一段",
  },

  /**
   * §02 DECIDE —— v0.1 Baseline Spec 的三个合法出口。
   * observe / keep 都不是终点：用户可以回来重新选，也可以自己按「归档」。
   * 中文串里的引号一律用全角，避免和字符串定界符打架。
   */
  decide: {
    title: "现在，你来决定",
    intro: "看完上面这些，你有三个合法出口。选「继续观察」或「暂时不改变」都不算退出系统，也不算没做到。",
    options: [
      {
        value: "change",
        label: "我决定改变",
        hint: "接下来一起把方向变成能做的实验。",
      },
      {
        value: "observe",
        label: "还没想清楚，继续观察",
        hint: "这份判断留在本机，想看回来随时回来看。",
      },
      {
        value: "keep",
        label: "想清楚了，暂时不改变",
        hint: "这也是把收益与代价都摆过之后的结论。",
      },
    ],
    noteLabel: "给你自己留一句话",
    heldTitle: "这条判断已经记在本机了",
    redecideHint: "想改主意，直接在下面重新选一个出口就行；这条记录不会被清掉。",
    archive: "这次就到这里，归档它",
    archived: "上一条已经归档。它的记录还在本机，设置 → 数据 可以导出回看。",
  },

  /** Stage 03 REBOOT —— 把方向变成最小实验 */
  reboot: {
    title: "设计一个实验，不是一份计划",
    declaredIntent: "你最初的说法",
    declaredHint: "例：每天学习 4 小时。",
    evidenceLabel: "按你实际做到的算",
    evidenceBody: "下面这些来自你已有的记录，不是来自宣言。",
    evidenceEmpty: "还没有行为记录。先用你**过去真做过**的水平起步，别从愿望起步。",
    minAction: "最小可行动作",
    minActionHint: "小到不想做也能开始的那一步。",
    cue: "触发线索",
    cueHint: "什么时间、什么之后、在哪里开始。",
    sessionsPerWeek: "每周几次",
    maxSessionMinutes: "单次上限（分钟）",
    environment: "环境改动",
    environmentHint: "让这件事更容易发生的一两处改动。",
    reviewAfter: "多少天后回看证据",
  },

  /** Stage 04 TRAIN —— §2.3 行为比宣言重要 */
  train: {
    title: "今天发生了什么",
    outcomes: [
      { value: "done", label: "做了" },
      { value: "partial", label: "做了一部分" },
      { value: "missed", label: "没做" },
    ],
    minutes: "实际分钟",
    evidenceNote: "留下什么证据",
    evidenceHint: "一句客观描述：写了 300 字 / 跑了 2 公里。不写评价。",
    logged: "记下了",
    weekView: "本周",
    declaredVsActual: "计划每周 {plan} 次，实际记录 {actual} 次。",
    noReps: "还没有记录。第一次不需要做到很好，只需要留下一条。",
  },

  /** §2.4 Missed → Diagnose → Intervention → Recovery → Learn */
  adapt: {
    title: "中断了，来看是哪一段断了",
    intro: "阻碍通常有具体位置，不在你的品格里。",
    opened: "已记为中断",
    diagnose: "看看原因",
    factors: [
      { value: "actionTooBig", label: "动作太大" },
      { value: "noCue", label: "没有触发线索" },
      { value: "noImmediateReward", label: "做完没有即时反馈" },
      { value: "environmentConflict", label: "环境不允许" },
      { value: "timingConflict", label: "时间冲突" },
      { value: "energyInsufficient", label: "精力不够" },
      { value: "meaningUnclear", label: "为什么做没想清楚" },
      { value: "externalPressure", label: "主要是别人的期待" },
      { value: "planUnrealistic", label: "计划本身不现实" },
      { value: "other", label: "其他" },
    ],
    intervention: "打算怎么调整",
    interventionHint: "改环境、改动作大小，或改频次。别只改决心。",
    effectiveFrom: "从哪天开始",
    recovered: "恢复了",
    learned: "这次学到什么",
    learnedHint: "一句就够，留给以后的自己。",
    close: "结束这段中断",
  },

  /** §2.5 监督阶梯 */
  supervision: {
    title: "需要这个软件盯你多紧",
    levels: {
      high: "高监督",
      medium: "中监督",
      light: "轻提醒",
      none: "无提醒",
    },
    proposeDown: "可以少依赖一点了",
    proposeBody: "{reason} 要不要降到“{to}”？",
    accept: "降档",
    decline: "先不",
    keepWatch: "没有足够证据时不会建议降档；有证据也**不会自动降**，由你确认。",
  },

  graduate: {
    title: "不再需要它",
    intro: "这一步的目标是让你以后不靠这个软件也能做下去。",
    criteria: "看看证据",
    selfRunPlan: "没有这个软件时，你怎么继续",
    selfRunHint: "写具体的：什么时候、做什么、卡住了怎么回来。",
    ready: "我已经不需要它了",
    done: "毕业",
    exportFirst: "导出前先存一份数据。毕业之后你随时可以删掉它。",
  },

  common: {
    back: "返回",
    next: "继续",
    save: "保存",
    saved: "已保存",
    data: "数据",
    export: "导出 JSON",
    import: "导入 JSON",
    erase: "清空本机全部数据",
    eraseConfirm: "这会删除这台设备上所有记录，无法撤销。确定？",
    stageOf: "第 {n} / 8 阶段",
  },

  gates: {
    readiness: "先完成上面的检查，再往下。",
    lessons: "四段都写一句话，再往下。",
    commit: "还没做决定。决定这一步没有默认答案。",
    audit: "先把上面那几栏填完。",
    plan: "实验还没设计完。",
    noInterruption: "目前没有待处理的中断。",
    interruptionsOpen: "还有没结束的中断，先处理完。",
    graduation: "还没到毕业条件。",
    skip: "一次只走一步。",
    backwards: "已经在后面了。",
    notEarlier: "这不算退回。",
  },
} as const;

/**
 * §2.2 明令禁止的表达。测试会扫描所有用户可见字符串。
 * 这里连"软性"的同词一起禁，因为产品一旦用到就变成对用户的道德判断。
 */
export const BANNED_USER_FACING_TERMS = [
  "失败",
  "你又",
  "自律",
  "断签",
  "打卡",
  "坚持不住",
  "懒惰",
  "偷懒",
  "不自律",
  "不想成功",
  "排行榜",
  "连续未",
  "你已经连续",
  "必须",
  "你应该",
  "诊断",
  "治疗",
  "患者",
  "成瘾",
] as const;

/** §2.2 规定应当使用的词，测试反向确认它们确实出现在文案里。 */
export const PREFERRED_TERMS = ["中断", "阻碍", "恢复", "调整", "实验", "证据"] as const;

/**
 * 阶段判据返回的是 `gate.xxx` 这样的原因码（domain 层不写字面文案）。
 * 这里负责把码翻成人话：**翻不出来的码不许静默回退成码本身** ——
 * 之前 App 里就是拿 "gate.audit" 去查 copy.gates，键名没带前缀，
 * 于是界面直接把内部码给用户看。tests/domain.test.ts 钉住"每个码都有人话"。
 */
export const gateMessage = (reason: string): string => {
  const key = reason.replace(/^gate\./, "") as keyof typeof copy["gates"];
  const text = (copy.gates as Record<string, string>)[key as string];
  if (!text) throw new Error(`原因码 ${reason} 没有对应文案，别把内部码甩给用户`);
  return text;
};
