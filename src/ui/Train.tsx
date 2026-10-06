import { useState } from "react";
import { copy } from "../i18n/copy";
import { Card, Choice, Field, ListField, Pill, t } from "./parts";
import { declarationGap, summarizeEvidence } from "../domain/evidence";
import type { Change, DiagnosisFactor, Plan, RepOutcome } from "../domain/types";
import type { Repo } from "../storage/repository";

/** Stage 03 REBOOT —— 把方向变成最小实验。 */
export function Reboot({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const [p, setP] = useState({
    declaredIntent: change.plan?.declaredIntent ?? change.title,
    evidenceBasedTarget: change.plan?.evidenceBasedTarget ?? "",
    minAction: change.plan?.minAction ?? "",
    cue: change.plan?.cue ?? "",
    sessionsPerWeek: change.plan?.sessionsPerWeek ?? 3,
    maxSessionMinutes: change.plan?.maxSessionMinutes ?? 25,
    environmentChanges: change.plan?.environmentChanges ?? [""],
    reviewAfterDays: change.plan?.reviewAfterDays ?? 14,
  });
  const set = (patch: Partial<typeof p>) => setP((s) => ({ ...s, ...patch }));
  const ev = summarizeEvidence(change.reps);

  const submit = async () => {
    await repo.setPlan(change.id, { ...p } as Omit<Plan, "createdAt">);
    await repo.advance(change.id, 4);
    onDone();
  };

  return (
    <section>
      <h1>{copy.reboot.title}</h1>
      <Card>
        <Field label={copy.reboot.declaredIntent} hint={copy.reboot.declaredHint} value={p.declaredIntent} onChange={(v) => set({ declaredIntent: v })} />
        <div className="muted" style={{ margin: "4px 0 14px" }}>
          {ev.totalReps === 0 ? copy.reboot.evidenceEmpty : `${copy.reboot.evidenceBody} ${t(copy.train.declaredVsActual, { plan: p.sessionsPerWeek, actual: (ev.weeklyRate ?? 0).toFixed(1) })}`}
        </div>
        <Field label={copy.reboot.evidenceLabel} value={p.evidenceBasedTarget} onChange={(v) => set({ evidenceBasedTarget: v })} />
        <Field label={copy.reboot.minAction} hint={copy.reboot.minActionHint} value={p.minAction} onChange={(v) => set({ minAction: v })} />
        <Field label={copy.reboot.cue} hint={copy.reboot.cueHint} value={p.cue} onChange={(v) => set({ cue: v })} />
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            <span>{copy.reboot.sessionsPerWeek}</span>
            <input type="number" min={1} value={p.sessionsPerWeek} onChange={(e) => set({ sessionsPerWeek: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>{copy.reboot.maxSessionMinutes}</span>
            <input type="number" min={1} value={p.maxSessionMinutes} onChange={(e) => set({ maxSessionMinutes: Number(e.target.value) })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>{copy.reboot.reviewAfter}</span>
            <input type="number" min={3} value={p.reviewAfterDays} onChange={(e) => set({ reviewAfterDays: Number(e.target.value) })} />
          </label>
        </div>
        <ListField label={copy.reboot.environment} hint={copy.reboot.environmentHint} items={p.environmentChanges} onChange={(v) => set({ environmentChanges: v })} />
        <button className="primary" disabled={!p.minAction.trim() || !p.evidenceBasedTarget.trim()} onClick={submit}>
          {copy.common.next}
        </button>
      </Card>
    </section>
  );
}

/** Stage 04 TRAIN + Stage 05 ADAPT（有未处理中断时自动顶到前面）。 */
export function Train({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const open = change.interruptions.find((i) => !i.closedAt);
  if (open) return <Adapt repo={repo} change={change} interruptionId={open.id} onDone={onDone} />;

  const [outcome, setOutcome] = useState<RepOutcome>("done");
  const [minutes, setMinutes] = useState("25");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const ev = summarizeEvidence(change.reps);
  const gap = change.plan ? declarationGap(change.plan, ev) : null;

  const log = async () => {
    await repo.logRep(change.id, {
      date,
      outcome,
      actualMinutes: outcome === "missed" ? 0 : Math.max(0, Number(minutes) || 0),
      evidenceNote: note,
    });
    setNote("");
    onDone();
  };

  return (
    <section>
      <h1>{copy.train.title}</h1>
      {change.reps.length === 0 ? <Card>{copy.train.noReps}</Card> : null}
      {gap ? <Card tone="err">{gap}</Card> : null}

      <Card>
        <label className="field">
          <span>{copy.common.data}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <Choice options={copy.train.outcomes} value={outcome} onChange={(v) => setOutcome(v as RepOutcome)} />
        {outcome !== "missed" ? (
          <label className="field">
            <span>{copy.train.minutes}</span>
            <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        ) : null}
        <Field label={copy.train.evidenceNote} hint={copy.train.evidenceHint} value={note} onChange={setNote} />
        <button className="primary" onClick={log}>{copy.train.logged}</button>
      </Card>

      {change.reps.length > 0 ? (
        <>
          <h2>{copy.train.weekView}</h2>
          <Card>
            <ul className="plain">
              {[...change.reps].reverse().slice(0, 14).map((r) => (
                <li key={r.id}>
                  <Pill outcome={r.outcome} /> {r.date} {r.outcome !== "missed" ? `${r.actualMinutes}′` : ""}{" "}
                  <span className="muted">{r.evidenceNote}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </section>
  );
}

/** §2.4 一条中断的四步：看原因 → 调整 → 恢复 → 记下学到什么。 */
function Adapt({ repo, change, interruptionId, onDone }: { repo: Repo; change: Change; interruptionId: string; onDone: () => void }) {
  const i = change.interruptions.find((x) => x.id === interruptionId)!;
  const [factors, setFactors] = useState<string[]>(i.diagnosis?.factors ?? []);
  const [note, setNote] = useState(i.diagnosis?.note ?? "");
  const [adjust, setAdjust] = useState(i.intervention?.adjustment ?? "");
  const [from, setFrom] = useState(i.intervention?.effectiveFrom ?? new Date().toISOString().slice(0, 10));
  const [learned, setLearned] = useState(i.learned ?? "");

  return (
    <section>
      <h1>{copy.adapt.title}</h1>
      <p className="muted">{copy.adapt.intro}</p>
      <Card>
        <div className="muted">{copy.adapt.opened}：{i.missedDates.join("、")}</div>
        <h2>{copy.adapt.diagnose}</h2>
        <Choice
          multi
          selected={factors}
          options={copy.adapt.factors}
          onChange={(v) => setFactors((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))}
        />
        <Field label={copy.adapt.learnedHint} value={note} onChange={setNote} />
        <button onClick={() => repo.diagnoseInterruption(change.id, interruptionId, factors as DiagnosisFactor[], note)}>
          {copy.common.save}
        </button>

        {i.diagnosis ? (
          <>
            <h2>{copy.adapt.intervention}</h2>
            <Field label={copy.adapt.interventionHint} value={adjust} onChange={setAdjust} />
            <label className="field">
              <span>{copy.adapt.effectiveFrom}</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <button disabled={!adjust.trim()} onClick={() => repo.intervene(change.id, interruptionId, adjust, from)}>
              {copy.common.save}
            </button>
          </>
        ) : null}

        {i.intervention ? (
          <>
            <h2>{copy.adapt.learned}</h2>
            <div className="muted">{copy.adapt.learnedHint}</div>
            {i.recoveredOn ? <div className="muted">{copy.adapt.recovered}：{i.recoveredOn}</div> : null}
            <Field label={copy.adapt.learned} value={learned} onChange={setLearned} />
            <button
              className="primary"
              disabled={!learned.trim()}
              onClick={async () => {
                await repo.closeInterruption(change.id, interruptionId, learned);
                onDone();
              }}
            >
              {copy.adapt.close}
            </button>
          </>
        ) : null}
      </Card>
    </section>
  );
}
