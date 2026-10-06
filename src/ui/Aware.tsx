import { useState } from "react";
import { copy } from "../i18n/copy";
import { Card, Choice, t } from "./parts";
import { MAX_FRICTION_AREAS, type FrictionArea, type FrictionScan, type Frequency } from "../domain/types";
import type { Repo } from "../storage/repository";

/** Stage 00 AWARE —— §5/§6/§7。走完才允许创建 Change。 */
export function Aware({ repo, readiness, onDone }: { repo: Repo; readiness: FrictionScan | null; onDone: () => void }) {
  const [step, setStep] = useState<"welcome" | "scan" | "areas" | "result">(readiness ? "result" : "welcome");
  const [answers, setAnswers] = useState<Record<string, Frequency>>(
    (readiness?.answers as Record<string, Frequency>) ?? {},
  );
  const [areas, setAreas] = useState<FrictionArea[]>((readiness?.areas as FrictionArea[]) ?? []);
  const [primary, setPrimary] = useState<FrictionArea | null>(readiness?.primaryArea ?? null);

  const save = async () => {
    await repo.saveReady({ ...readinessShape(answers, areas, primary) });
    onDone();
  };

  if (step === "welcome")
    return (
      <section>
        {/* §5.1 的文案只渲染一次：标题取首句，其余进正文。
            之前 h1 和正文各放一遍整段，屏幕上重复两遍，读屏也会念两遍。 */}
        <h1>{copy.welcome.lines[0]}</h1>
        <div className="muted" style={{ whiteSpace: "pre-line", marginBottom: 22 }}>
          {copy.welcome.lines.slice(1).join("\n")}
        </div>
        <button className="primary" onClick={() => setStep("scan")}>
          {copy.welcome.cta}
        </button>
        <div className="muted" style={{ marginTop: 14 }}>{copy.welcome.skipHint}</div>
      </section>
    );

  if (step === "scan") {
    const qs = copy.scan.questions;
    const i = Math.min(Object.keys(answers).length, qs.length - 1);
    const q = qs[i]!;
    return (
      <section>
        <div className="muted">{copy.scan.intro}</div>
        <h1>{q.text}</h1>
        <div className="muted" style={{ marginBottom: 10 }}>
          {t(copy.scan.progress, { n: i + 1, total: qs.length })}
        </div>
        <div className="bar" style={{ marginBottom: 18 }}>
          <i style={{ width: `${((i + 1) / qs.length) * 100}%` }} />
        </div>
        <Choice
          options={copy.scan.options}
          onChange={(v) => {
            const next = { ...answers, [q.id]: v as Frequency };
            setAnswers(next);
            if (Object.keys(next).length >= qs.length) setStep("areas");
          }}
        />
        {i > 0 ? (
          <button
            className="ghost"
            style={{ marginTop: 14 }}
            onClick={() => setAnswers(Object.fromEntries(Object.entries(answers).slice(0, -1)))}
          >
            {copy.common.back}
          </button>
        ) : null}
      </section>
    );
  }

  if (step === "areas")
    return (
      <section>
        <h1>{copy.areas.title}</h1>
        <div className="muted">{copy.areas.hint}</div>
        <Choice
          multi
          selected={areas}
          options={copy.areas.options}
          onChange={(v) => {
            const a = v as FrictionArea;
            setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : prev.length >= MAX_FRICTION_AREAS ? prev : [...prev, a]));
          }}
        />
        {areas.length >= MAX_FRICTION_AREAS ? <Card tone="err">{copy.areas.limit}</Card> : null}
        {areas.length > 0 ? (
          <>
            <h2>{copy.areas.primaryQuestion}</h2>
            <Choice
              value={primary ?? undefined}
              options={areas.map((a) => ({ value: a, label: copy.areas.options.find((o) => o.value === a)!.label }))}
              onChange={(v) => setPrimary(v as FrictionArea)}
            />
          </>
        ) : null}
        <div className="row" style={{ marginTop: 18 }}>
          <button className="primary" disabled={!primary} onClick={save}>
            {copy.common.next}
          </button>
        </div>
      </section>
    );

  return (
    <section>
      <h1>{copy.readiness.resultTitle}</h1>
      <p>{copy.readiness.resultBody}</p>
      <Card>
        <ul className="plain">
          {copy.scan.questions.map((q) => {
            const v = answers[q.id];
            return (
              <li key={q.id}>
                <span className="muted">{copy.scan.options.find((o) => o.value === v)?.label ?? "—"}</span> · {q.text}
              </li>
            );
          })}
        </ul>
      </Card>
      <button className="primary" onClick={onDone}>
        {copy.common.next}
      </button>
    </section>
  );
}

const readinessShape = (answers: Record<string, Frequency>, areas: FrictionArea[], primary: FrictionArea | null) => ({
  answers,
  areas,
  primaryArea: primary,
  completedAt: new Date().toISOString(),
});
