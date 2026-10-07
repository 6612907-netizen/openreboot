import { useState } from "react";
import { copy, gateMessage } from "../i18n/copy";
import { Card, Choice, Field, ListField } from "./parts";
import { reviewAudit } from "../domain/evidence";
import type { Change, ChangeAudit, DecisionKind } from "../domain/types";
import { GateError, type Repo } from "../storage/repository";

const EMPTY: ChangeAudit = {
  desiredChange: "",
  desiredOutcome: [],
  intrinsicReasons: [],
  externalReasons: [],
  benefitsOfChange: [],
  costsOfChange: [],
  benefitsOfStatusQuo: [],
  costsOfStatusQuo: [],
};

/** Stage 02 DECIDE —— §8 Change Audit + §9 Change Equation + §2.1 三个合法出口。 */
export function Decide({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const [a, setA] = useState<ChangeAudit>(change.audit ?? { ...EMPTY, desiredChange: change.title });
  const [note, setNote] = useState(change.decision?.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<ChangeAudit>) => setA((p) => ({ ...p, ...patch }));
  const findings = reviewAudit(a);

  // Baseline §02：observe / keep 记下来之后，这条 Change 仍然留在 DECIDE，
  // 页面上要说清"你选的是哪一个"，并给一条明确的归档出口（由用户自己按）。
  const held = change.decision && change.decision.kind !== "change" ? change.decision : null;
  const heldLabel = held ? (copy.decide.options.find((o) => o.value === held.kind)?.label ?? null) : null;

  const archive = async () => {
    setErr(null);
    try {
      await repo.archiveChange(change.id);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const saveAudit = async () => {
    await repo.setAudit(change.id, a);
    // 同 Understand 那一处：写完要刷一次，否则界面里的 change 还是旧的（audit 看着像没存上）。
    onDone();
  };

  const decide = async (kind: DecisionKind) => {
    setErr(null);
    try {
      await repo.setDecision(change.id, { kind, note });
      if (kind === "change") await repo.advance(change.id, 3);
      onDone();
    } catch (e) {
      // 被阶段判据拦下时**必须让用户看见为什么**：GateError 带的是 reason 码，
      // 翻成 copy.gates 里那句人话。之前这里什么都没接，用户点「我决定改变」
      // 只看到页面不动 —— 静默拒绝跟"坏了"没区别。
      setErr(e instanceof GateError ? gateMessage(e.reason) : (e as Error).message);
    }
  };

  const f = copy.audit.fields;
  return (
    <section>
      <h1>{copy.audit.title}</h1>
      <p className="muted">{copy.audit.intro}</p>

      <Card>
        <Field label={f.desiredChange.label} hint={f.desiredChange.hint} value={a.desiredChange} onChange={(v) => set({ desiredChange: v })} />
        <ListField label={f.desiredOutcome.label} hint={f.desiredOutcome.hint} items={a.desiredOutcome} onChange={(v) => set({ desiredOutcome: v })} />
        <ListField label={f.intrinsicReasons.label} hint={f.intrinsicReasons.hint} items={a.intrinsicReasons} onChange={(v) => set({ intrinsicReasons: v })} />
        <ListField label={f.externalReasons.label} hint={f.externalReasons.hint} items={a.externalReasons} onChange={(v) => set({ externalReasons: v })} />
        <ListField label={f.benefitsOfChange.label} items={a.benefitsOfChange} onChange={(v) => set({ benefitsOfChange: v })} />
        <ListField label={f.costsOfChange.label} items={a.costsOfChange} onChange={(v) => set({ costsOfChange: v })} />
        <ListField label={f.benefitsOfStatusQuo.label} hint={f.benefitsOfStatusQuo.hint} items={a.benefitsOfStatusQuo} onChange={(v) => set({ benefitsOfStatusQuo: v })} />
        <ListField label={f.costsOfStatusQuo.label} items={a.costsOfStatusQuo} onChange={(v) => set({ costsOfStatusQuo: v })} />
        <button onClick={saveAudit}>{copy.common.save}</button>
      </Card>

      <h2>{copy.equation.title}</h2>
      <div className="quad">
        <div>
          <h3>{copy.equation.quadrants.benefitsOfChange}</h3>
          <ul className="plain">{a.benefitsOfChange.filter(Boolean).map((x, i) => <li key={i}>· {x}</li>)}</ul>
        </div>
        <div>
          <h3>{copy.equation.quadrants.costsOfStatusQuo}</h3>
          <ul className="plain">{a.costsOfStatusQuo.filter(Boolean).map((x, i) => <li key={i}>· {x}</li>)}</ul>
        </div>
        <div>
          <h3>{copy.equation.quadrants.costsOfChange}</h3>
          <ul className="plain">{a.costsOfChange.filter(Boolean).map((x, i) => <li key={i}>· {x}</li>)}</ul>
        </div>
        <div>
          <h3>{copy.equation.quadrants.benefitsOfStatusQuo}</h3>
          <ul className="plain">{a.benefitsOfStatusQuo.filter(Boolean).map((x, i) => <li key={i}>· {x}</li>)}</ul>
        </div>
      </div>
      <p className="muted">{copy.equation.notScoring}</p>

      <h2>{copy.equation.findingsTitle}</h2>
      {findings.length === 0 ? (
        <div className="muted">{copy.equation.findingsEmpty}</div>
      ) : (
        findings.map((x) => (
          <Card key={x.id}>
            <div>{x.question}</div>
          </Card>
        ))
      )}

      <h2>{copy.decide.title}</h2>
      <p className="muted">{copy.decide.intro}</p>
      <Field label={copy.decide.noteLabel} value={note} onChange={setNote} />

      {err ? <Card tone="err">{err}</Card> : null}

      {heldLabel ? (
        <Card>
          <strong>{copy.decide.heldTitle}</strong>
          <div>{heldLabel}</div>
          {change.decision?.note ? <div className="muted">{change.decision.note}</div> : null}
          <div className="muted">{copy.decide.redecideHint}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="ghost" onClick={() => void archive()}>
              {copy.decide.archive}
            </button>
          </div>
        </Card>
      ) : null}

      {/* 出口用同一个 Choice：它的选中态由 input 驱动，点文字不会像早先那样"选了又取消"。 */}
      <Choice
        value={change.decision?.kind ?? undefined}
        options={copy.decide.options.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
        onChange={(v) => void decide(v as DecisionKind)}
      />
    </section>
  );
}
