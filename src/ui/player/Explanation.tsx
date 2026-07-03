import type { Question, Response } from "@engine/index.ts";
import { TopBar } from "../components/TopBar.tsx";

interface Props {
  question: Question;
  correct: boolean;
  response: Response;
  progressLabel: string;
  /** Move forward: next question, or forward through reviewed history. */
  onContinue: () => void;
  /** Step back to the previously answered question (read-only). */
  onPrevious: () => void;
  canPrevious: boolean;
  /** Exit to the home screen (shows the "Leave practice?" confirm). */
  onHome: () => void;
}

function responseText(question: Question, response: Response): string {
  if (response.kind === "numeric") return `${response.value}`;
  if (response.kind === "single") {
    return question.options?.find((o) => o.id === response.optionId)?.text ?? response.optionId;
  }
  return "—";
}

function correctText(question: Question): string {
  const k = question.answer;
  if (k.kind === "numeric") return `${k.value} ${k.unit}`;
  if (k.kind === "single") return question.options?.find((o) => o.id === k.optionId)?.text ?? k.optionId;
  return "—";
}

export function Explanation({
  question,
  correct,
  response,
  progressLabel,
  onContinue,
  onPrevious,
  canPrevious,
  onHome,
}: Props) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Home is small, at the top. */}
      <TopBar onHome={onHome} progressLabel={progressLabel} />

      {/* The original question, so the explanation reads alongside what was asked. */}
      <div className="mb-4 rounded-xl border border-line bg-panel2 px-4 py-3">
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Question</div>
        <p className="text-sm text-slate-200">{question.stem}</p>
      </div>

      <div
        className={[
          "mb-4 rounded-xl border px-4 py-3",
          correct ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10",
        ].join(" ")}
      >
        <div className={`text-sm font-semibold ${correct ? "text-good" : "text-bad"}`}>
          {correct ? "Correct" : "Not quite"}
        </div>
        {!correct && (
          <div className="mt-1 text-sm text-slate-300">
            You answered <span className="font-medium">{responseText(question, response)}</span>. Correct
            answer: <span className="font-medium">{correctText(question)}</span>.
          </div>
        )}
      </div>

      {/* On a wrong numeric answer, name the likely wrong path in one sentence. */}
      {!correct && question.type === "numeric" && question.commonMistake && (
        <div className="mb-4 rounded-xl border border-warn/40 bg-warn/5 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-warn">Common mistake</div>
          <p className="mt-1 text-sm text-slate-200">{question.commonMistake}</p>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-line bg-panel p-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">Key idea</div>
        <p className="text-sm text-slate-200">{question.solution.keyIdea}</p>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Step by step</div>
        <ol className="flex flex-col gap-2">
          {question.solution.steps.map((s, i) => (
            <li key={i} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-slate-200">
              <span className="mr-2 font-mono text-slate-400">{i + 1}.</span>
              {s.text}
              {s.ref && (
                <span className="ml-2 rounded bg-panel2 px-1.5 py-0.5 text-[11px] text-blue-300">{s.ref}</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          Where to find it in the code book
        </div>
        <div className="flex flex-wrap gap-1.5">
          {question.solution.codePath.map((c, i) => (
            <span key={i} className="rounded bg-panel2 px-2 py-1 font-mono text-[11px] text-slate-300">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Previous on the LEFT, primary (Continue) on the RIGHT — same row.
          Home is at the top, not here. */}
      <div className="mt-auto flex gap-2 pt-2">
        <button
          onClick={onPrevious}
          disabled={!canPrevious}
          className="flex-1 rounded-xl border border-line px-4 py-4 text-base font-medium text-slate-200 active:bg-panel disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={onContinue}
          className="flex-1 rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
