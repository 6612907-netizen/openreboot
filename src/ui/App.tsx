import { useCallback, useEffect, useMemo, useState } from "react";
import { copy, gateMessage } from "../i18n/copy";
import { Card, Field, t } from "./parts";
import { idbStore, type KvStore } from "../storage/db";
import { createRepository, GateError, type Repo } from "../storage/repository";
import type { Database } from "../domain/types";
import { stageCode } from "../domain/stages";
import { Aware } from "./Aware";
import { Understand } from "./Understand";
import { Decide } from "./Decide";
import { Reboot, Train } from "./Train";
import { Graduate, Internalize, Settings } from "./Later";

/** store 可注入：测试用内存库跑真界面，产品代码不为测试特化。 */
export function App({ store }: { store?: KvStore } = {}) {
  const repo = useMemo<Repo>(() => createRepository(store ?? idbStore()), [store]);
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
        if (e instanceof GateError) setErr(gateMessage(e.reason));
        else setErr((e as Error).message);
      }
    },
    [refresh],
  );

  if (!db) return <div className="wrap boot">载入本机数据…</div>;

  const change = repo.activeChange(db);
  const readiness = db.profile.readiness;
  const stage = change?.stage ?? 0;
  // 归档过的判断仍然留在本机；新建页要说一句"上一条去哪了"，
  // 否则用户会以为选了「暂时不改变」之后数据被应用吞掉了。
  const hasArchived = db.changes.some((c) => c.status === "closed" && !!c.decision);

  return (
    <div className="wrap">
      <header className="top">
        <span className="brand">{copy.app.name}</span>
        <span className="stages">
          {/* 没有 Change 时 stage 就是 0：这里曾把「AWARE」写两遍（硬编码字面 · stageCode(0)）。
              阶段名一律取自 stageCode，界面不自己造字面文案。 */}
          {t(copy.common.stageOf, { n: stage + 1 })} · {stageCode(stage as 0)}
        </span>
      </header>

      {err ? <Card tone="err">{err}</Card> : null}

      {view === "settings" ? (
        <Settings
            repo={repo}
            onClose={() => {
              setView("app");
              // 关掉设置页必须重读一次库：设置页里会导出/导入/**清空**。
              // 之前只切视图不刷新，清空之后界面还挂着旧数据，
              // 用户看不出自己按下了什么 —— 真浏览器验收就是这么抓到的。
              void refresh();
            }}
          />
      ) : !readiness ? (
        <Aware repo={repo} readiness={readiness} onDone={() => void refresh()} />
      ) : !change ? (
        <section>
          <h1>{copy.audit.title}</h1>
          <p className="muted">{copy.app.tagline}</p>
          {hasArchived ? <p className="muted">{copy.decide.archived}</p> : null}
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
