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
    if (idx + 1 >= LESSONS.length) {
      await repo.advance(change.id, 2);
      onDone();
    }
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
      {lesson.source === "drafted" ? (
        <div className="muted" style={{ fontSize: 12 }}>
          注：这一段是规范原文缺失处的起草稿，见 README「已知缺口」。
        </div>
      ) : null}
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
