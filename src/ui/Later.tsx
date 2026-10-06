import { useState } from "react";
import { copy } from "../i18n/copy";
import { Card, Field, Pill, t } from "./parts";
import { summarizeEvidence } from "../domain/evidence";
import { GRADUATION_CRITERIA, graduationReady, proposeStepDown } from "../domain/supervision";
import { SUPERVISION_LEVELS, type Change } from "../domain/types";
import type { Repo } from "../storage/repository";

/** Stage 06 INTERNALIZE —— 只降不升，有证据才建议，建议也要用户确认。 */
export function Internalize({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const ev = summarizeEvidence(change.reps);
  const p = proposeStepDown(change, ev, change.plan);
  const atNone = change.supervision === "none";

  return (
    <section>
      <h1>{copy.supervision.title}</h1>
      <Card>
        <div className="row">
          {SUPERVISION_LEVELS.map((l) => (
            <span key={l} className={`pill ${l === change.supervision ? "done" : ""}`}>
              {copy.supervision.levels[l]}
            </span>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 10 }}>
          {copy.supervision.keepWatch}
        </div>
        <ul className="plain" style={{ marginTop: 12 }}>
          {change.supervisionHistory.map((s, i) => (
            <li key={i}>
              <Pill outcome="done" /> {copy.supervision.levels[s.level]} · <span className="muted">{s.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      {p ? (
        <Card>
          <h2 style={{ marginTop: 0 }}>{copy.supervision.proposeDown}</h2>
          <div>{t(copy.supervision.proposeBody, { reason: p.reason, to: copy.supervision.levels[p.to] })}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="primary"
              onClick={async () => {
                await repo.setSupervision(change.id, p.to, p.reason);
                onDone();
              }}
            >
              {copy.supervision.accept}
            </button>
            <button className="ghost" onClick={onDone}>
              {copy.supervision.decline}
            </button>
          </div>
        </Card>
      ) : null}

      {atNone ? (
        <button className="primary" onClick={async () => { await repo.advance(change.id, 7); onDone(); }}>
          {copy.graduate.title}
        </button>
      ) : (
        <button className="ghost" onClick={onDone}>{copy.train.title}</button>
      )}
    </section>
  );
}

/** Stage 07 GRADUATE —— 要证据，更要用户自己说不再需要。 */
export function Graduate({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const [plan, setPlan] = useState(change.graduation?.selfRunPlan ?? "");
  const [ready, setReady] = useState(false);
  const ev = summarizeEvidence(change.reps);
  const criteria = [
    `${copy.supervision.levels[change.supervision]}（需 ${copy.supervision.levels.none}）`,
    plan.trim() ? "✓ 已写" : "— 未写",
    change.interruptions.every((i) => i.closedAt) ? "✓ 无未处理中断" : "— 有中断未结束",
    ready ? "✓ 本人确认" : "— 待本人确认",
  ];
  const can = graduationReady({ ...change, graduation: { proposedAt: "", criteriaMet: [], selfRunPlan: plan, completedAt: null } }, ready);

  return (
    <section>
      <h1>{copy.graduate.title}</h1>
      <p className="muted">{copy.graduate.intro}</p>
      <Card>
        <h2 style={{ marginTop: 0 }}>{copy.graduate.criteria}</h2>
        <ul className="plain">{criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <div className="muted">
          {GRADUATION_CRITERIA.length} 项判据 · 已记录 {ev.totalReps} 次行为 · 近 {ev.spanDays} 天
        </div>
        <Field label={copy.graduate.selfRunPlan} hint={copy.graduate.selfRunHint} value={plan} onChange={setPlan} />
        <label className="choices">
          <label>
            <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
            <span>{copy.graduate.ready}</span>
          </label>
        </label>
        <div className="muted" style={{ margin: "8px 0" }}>{copy.graduate.exportFirst}</div>
        <button
          className="primary"
          disabled={!can}
          onClick={async () => {
            await repo.setGraduation(change.id, { selfRunPlan: plan, criteriaMet: criteria });
            await repo.graduate(change.id);
            onDone();
          }}
        >
          {copy.graduate.done}
        </button>
      </Card>
    </section>
  );
}

/** 数据所有权：导出 / 导入 / 彻底删除。 */
export function Settings({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const [msg, setMsg] = useState("");

  const download = async () => {
    const text = await repo.exportJson();
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `openreboot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <h1>{copy.common.data}</h1>
      <Card>
        <div className="row">
          <button onClick={download}>{copy.common.export}</button>
          <label className="ghost" style={{ border: "1px solid var(--line)", borderRadius: 11, padding: "11px 16px" }}>
            {copy.common.import}
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  await repo.importJson(await f.text());
                  setMsg(copy.common.saved);
                } catch (err) {
                  setMsg(String((err as Error).message));
                }
              }}
            />
          </label>
          <button
            className="ghost"
            onClick={async () => {
              if (confirm(copy.common.eraseConfirm)) {
                await repo.erase();
                setMsg(copy.common.saved);
                onClose();
              }
            }}
          >
            {copy.common.erase}
          </button>
        </div>
        {msg ? <div className="muted" style={{ marginTop: 10 }}>{msg}</div> : null}
      </Card>
      <p className="muted">{copy.app.privacyNote}</p>
      <button className="ghost" onClick={onClose}>{copy.common.back}</button>
    </section>
  );
}
