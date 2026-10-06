import { useState } from "react";
import { copy } from "../i18n/copy";
import { Card, Field, ListField } from "./parts";
import { reviewAudit } from "../domain/evidence";
import type { Change, ChangeAudit } from "../domain/types";
import type { Repo } from "../storage/repository";

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
  const set = (patch: Partial<ChangeAudit>) => setA((p) => ({ ...p, ...patch }));
  const findings = reviewAudit(a);

  const saveAudit = async () => {
    await repo.setAudit(change.id, a);
  };

  const decide = async (kind: "commit" | "notNow" | "stayAsIs") => {
    await repo.setDecision(change.id, { kind, note });
    if (kind === "commit") {
      await repo.advance(change.id, 3);
      onDone();
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
      <div className="choices">
        {copy.decide.options.map((o) => (
          <label key={o.value} onClick={() => decide(o.value as "commit")}>
            <span>
              <strong>{o.label}</strong>
              <div className="muted">{o.hint}</div>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

/** 决定之后但尚未承诺时的静态收尾页。 */
export function ClosedOutcome({ change }: { change: Change }) {
  return (
    <section>
      <h1>{copy.decide.title}</h1>
      <Card>{copy.decide.notCommitClosed}</Card>
      <div className="muted">{change.decision?.note || ""}</div>
    </section>
  );
}
