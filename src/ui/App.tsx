import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "../i18n/copy";
import { Card, Field, t } from "./parts";
import { idbStore } from "../storage/db";
import { createRepository, GateError, type Repo } from "../storage/repository";
import type { Database } from "../domain/types";
import { stageCode } from "../domain/stages";
import { Aware } from "./Aware";
import { Understand } from "./Understand";
import { ClosedOutcome, Decide } from "./Decide";
import { Reboot, Train } from "./Train";
import { Graduate, Internalize, Settings } from "./Later";

export function App() {
  const repo = useMemo<Repo>(() => createRepository(idbStore()), []);
  const [db, setDb] = useState<Database | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"app" | "settings">("app");
  const [title, setTitle] = useState("");

  const refresh = useCallback(async () => setDb(await repo.load()), [repo]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      setErr(null);
      try {
        await fn();
        await refresh();
      } catch (e) {
        if (e instanceof GateError) setErr(copy.gates[e.reason as keyof typeof copy.gates] ?? e.reason);
        else setErr((e as Error).message);
      }
    },
    [refresh],
  );

  if (!db) return <div className="wrap boot">载入本机数据…</div>;

  const change = repo.activeChange(db);
  const readiness = db.profile.readiness;
  const stage = change?.stage ?? 0;

  return (
    <div className="wrap">
      <header className="top">
        <span className="brand">{copy.app.name}</span>
        <span className="stages">
          {change ? t(copy.common.stageOf, { n: stage + 1 }) : "AWARE"} · {stageCode(stage as 0)}
        </span>
      </header>

      {err ? <Card tone="err">{err}</Card> : null}

      {view === "settings" ? (
        <Settings repo={repo} onClose={() => setView("app")} />
      ) : !readiness ? (
        <Aware repo={repo} readiness={readiness} onDone={() => void refresh()} />
      ) : !change ? (
        <section>
          <h1>{copy.audit.title}</h1>
          <p className="muted">{copy.app.tagline}</p>
          <Card>
            <Field label={copy.audit.fields.desiredChange.label} value={title} onChange={setTitle} placeholder={copy.audit.fields.desiredChange.hint} />
            <button
              className="primary"
              disabled={!title.trim()}
              onClick={() => act(async () => await repo.createChange(title))}
            >
              {copy.common.next}
            </button>
          </Card>
        </section>
      ) : change.decision && change.decision.kind !== "commit" ? (
        <ClosedOutcome change={change} />
      ) : stage === 1 ? (
        <Understand repo={repo} change={change} onDone={() => void refresh()} />
      ) : stage === 2 ? (
        <Decide repo={repo} change={change} onDone={() => void refresh()} />
      ) : stage === 3 ? (
        <Reboot repo={repo} change={change} onDone={() => void refresh()} />
      ) : stage === 6 ? (
        <Internalize repo={repo} change={change} onDone={() => void refresh()} />
      ) : stage === 7 ? (
        <Graduate repo={repo} change={change} onDone={() => void refresh()} />
      ) : (
        <Train repo={repo} change={change} onDone={() => void refresh()} />
      )}

      <footer className="foot">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span>{copy.app.privacyNote}</span>
          <button className="ghost" onClick={() => setView(view === "settings" ? "app" : "settings")}>
            {view === "settings" ? copy.common.back : copy.common.data}
          </button>
        </div>
      </footer>
    </div>
  );
}
