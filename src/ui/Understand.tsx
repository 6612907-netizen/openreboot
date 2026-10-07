import { useState } from "react";
import { copy } from "../i18n/copy";
import { Card } from "./parts";
import { LESSONS } from "../content/lessons";
import type { Change } from "../domain/types";
import type { Repo } from "../storage/repository";

/** Stage 01 UNDERSTAND —— §10/§11 微型课程，每段要写一句话才算过。 */
export function Understand({ repo, change, onDone }: { repo: Repo; change: Change; onDone: () => void }) {
  const idx = change.lessons.filter((l) => l.answer.trim()).length;
  const lesson = LESSONS[Math.min(idx, LESSONS.length - 1)]!;
  const [card, setCard] = useState(0);
  const [answer, setAnswer] = useState("");

  const submit = async () => {
    if (!answer.trim()) return;
    await repo.addLessonAnswer(change.id, lesson.id, answer.trim());
    setCard(0);
    setAnswer("");
    if (idx + 1 >= LESSONS.length) await repo.advance(change.id, 2);
    // 每写一段都要刷一次：idx 是从 props 里的 change.lessons 现算的，
    // 不刷新就永远停在 lesson-01 —— 用户写完第一段发现页面不动，
    // 再点保存就把同一段覆盖掉。这个缺陷是靠"刷新后 idx 才对"的取数路径掩盖的，
    // 之前的冒烟测试只走到 UNDERSTAND 就重开页面，所以没暴露。
    onDone();
  };

  const done = lesson.cards[card]!;
  const last = card >= lesson.cards.length - 1;

  return (
    <section>
      <div className="muted">
        {copy.understand.title} · {idx + 1} / {LESSONS.length}
      </div>
      <h1>{lesson.title}</h1>
      <Card>
        <div style={{ whiteSpace: "pre-line" }}>{done}</div>
      </Card>
      <div className="row" style={{ marginTop: 14 }}>
        {card > 0 ? (
          <button className="ghost" onClick={() => setCard(card - 1)}>
            {copy.common.back}
          </button>
        ) : null}
        {!last ? (
          <button className="primary" onClick={() => setCard(card + 1)}>
            {copy.understand.next}
          </button>
        ) : null}
      </div>

      {last ? (
        <div style={{ marginTop: 22 }}>
          <h2>{lesson.question}</h2>
          <textarea
            value={answer}
            placeholder={copy.understand.answerPlaceholder}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <button className="primary" style={{ marginTop: 10 }} disabled={!answer.trim()} onClick={submit}>
            {copy.common.save}
          </button>
        </div>
      ) : null}
    </section>
  );
}
