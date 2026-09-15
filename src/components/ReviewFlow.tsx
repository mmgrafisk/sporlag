"use client";

/**
 * COMMUNITY REVIEW FLOW (§16/§18 DESIGN)
 * One question at a time, structured factual answers, keyboard accessible
 * (1–4 select, Enter continues), progress visible, ~20 seconds target.
 * Never star ratings. Completion shows points + impact note (§18: separate).
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Question = { key: string; label: string; answers: { value: string; label: string }[] };

export default function ReviewFlow(props: {
  taskId: string;
  claim: string;
  company: string;
  questions: Question[];
  labels: Record<string, string>;
}) {
  const L = props.labels;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState<{ points: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = props.questions.length;
  const q = props.questions[step];

  const advance = useCallback(() => {
    if (!q || !selected) return;
    const nextAnswers = { ...answers, [q.key]: selected };
    setAnswers(nextAnswers);
    setSelected(null);
    if (step + 1 >= total) {
      setSubmitting(true);
      fetch(`/api/users/me/reviews/${props.taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) {
            setDone({ points: data.points_awarded ?? 0 });
            router.refresh();
          } else {
            setError(data.error ?? L.errGeneric);
          }
        })
        .catch(() => setError(L.errGeneric))
        .finally(() => setSubmitting(false));
    } else {
      setStep(step + 1);
    }
  }, [answers, q, selected, step, total, props.taskId, router, L.errGeneric]);

  // Keyboard: 1–4 select, Enter continue (§23 keyboard-accessible review flow)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done) return;
      if (e.key >= "1" && e.key <= String(Math.min(4, q?.answers.length ?? 0))) {
        const answer = q?.answers[Number(e.key) - 1];
        if (answer) setSelected(answer.value);
      } else if (e.key === "Enter" && selected && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, selected, advance, done]);

  if (done) {
    return (
      <div className="review-shell">
        <div className="paper" style={{ padding: "clamp(1.6rem,4vw,2.6rem)", textAlign: "center" }}>
          <p className="mono" style={{ color: "var(--recognition)" }}>{L.doneTitle}</p>
          <h2 className="mt-1" style={{ fontSize: "1.7rem" }}>{L.doneBody}</h2>
          <p className="display mt-2" style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--primary)" }}>
            {L.pointsEarned.replace("{points}", String(done.points))}
          </p>
          <p className="small muted" style={{ maxWidth: "30rem", marginInline: "auto" }}>{L.impactNote}</p>
          <div className="flex gap-2 mt-3" style={{ justifyContent: "center" }}>
            <a className="btn" href="/vurderinger">{L.backToQueue}</a>
            <a className="btn btn-ghost" href="/bidrag">{L.contribLink}</a>
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="review-shell">
      <div className="review-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}
        aria-label={L.progress.replace("{n}", String(step + 1)).replace("{total}", String(total))}>
        {props.questions.map((_, i) => (
          <i key={i} data-done={i <= step ? "true" : "false"} />
        ))}
      </div>

      <p className="mono muted mb-1">
        {L.progress.replace("{n}", String(step + 1)).replace("{total}", String(total))}
      </p>

      <div className="review-context">
        <p className="mono muted mb-0" style={{ fontSize: "0.66rem" }}>{L.contextTitle}</p>
        <p className="display" style={{ fontSize: "1.15rem", fontWeight: 650, margin: "0.3rem 0 0.2rem" }}>
          “{props.claim}”
        </p>
        <p className="small muted mb-0">{props.company} · {L.contextNote}</p>
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="review-question">{q.label}</legend>
        <div className="review-answers" role="radiogroup" aria-label={q.label}>
          {q.answers.map((a, i) => (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={selected === a.value}
              className="review-answer"
              data-selected={selected === a.value ? "true" : "false"}
              onClick={() => setSelected(a.value)}
              onDoubleClick={advance}
            >
              <span>{a.label}</span>
              <kbd aria-hidden="true">{i + 1}</kbd>
            </button>
          ))}
        </div>
      </fieldset>

      <p className="small muted mt-2">{L.keyboardHint}</p>
      {error && <p className="alert-err mt-1" role="alert">{error}</p>}

      <div className="flex gap-2 mt-2">
        <button type="button" className="btn" onClick={advance} disabled={!selected || submitting}>
          {step + 1 >= total ? L.finish : L.nextQuestion}
        </button>
        {step > 0 && (
          <button type="button" className="btn btn-quiet" onClick={() => { setStep(step - 1); setSelected(null); }}>
            {L.back}
          </button>
        )}
      </div>
    </div>
  );
}
