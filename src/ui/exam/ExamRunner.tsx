import { parseNumericInput, type Question, type Response, type Section } from "@engine/index.ts";
import { TopBar } from "../components/TopBar.tsx";

interface Props {
  question: Question;
  section: Section | null;
  index: number;
  total: number;
  remainingSec: number;
  allottedSec: number;
  response: Response | undefined;
  rawNumeric: string;
  flagged: boolean;
  onToggleFlag: () => void;
  onSingle: (optionId: string) => void;
  onNumeric: (raw: string, value: number | null) => void;
  onPrev: () => void;
  canPrev: boolean;
  onNext: () => void;
  isLast: boolean;
  onFinish: () => void;
  onHome: () => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamRunner({
  question,
  section,
  index,
  total,
  remainingSec,
  allottedSec,
  response,
  rawNumeric,
  flagged,
  onToggleFlag,
  onSingle,
  onNumeric,
  onPrev,
  canPrev,
  onNext,
  isLast,
  onFinish,
  onHome,
}: Props) {
  const low = remainingSec <= 60 || (allottedSec > 0 && remainingSec / allottedSec <= 0.1);

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} progressLabel={`Question ${index + 1} of ${total}`} />

      {/* Countdown — the whole point of this mode. */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">{section?.name ?? "Exam"}</span>
        <span
          className={`font-mono text-lg font-bold tabular-nums ${low ? "text-bad" : "text-slate-100"}`}
          aria-label="Time remaining"
        >
          {fmt(remainingSec)}
        </span>
      </div>

      {/* Mark-for-review — mirrors the real exam. Never affects the score. */}
      <button
        onClick={onToggleFlag}
        aria-pressed={flagged}
        className={[
          "mb-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-base font-semibold transition-colors",
          flagged
            ? "border-warn bg-warn/15 text-warn"
            : "border-line bg-panel text-slate-300 active:bg-panel2",
        ].join(" ")}
      >
        <span aria-hidden>🚩</span>
        {flagged ? "Flagged — tap to remove" : "Flag this to review later"}
      </button>

      <h1 className="mb-5 text-lg font-semibold leading-snug text-slate-100">{question.stem}</h1>

      {question.type === "numeric" ? (
        <div className="mb-6">
          <label className="mb-2 block text-sm text-slate-400">Enter your answer</label>
          <input
            inputMode="decimal"
            value={rawNumeric}
            onChange={(e) => onNumeric(e.target.value, parseNumericInput(e.target.value))}
            placeholder="e.g. 24"
            className="w-full rounded-xl border border-line bg-panel px-4 py-4 text-xl text-slate-100 outline-none focus:border-brand"
          />
          {question.answer.kind === "numeric" && (
            <p className="mt-2 text-xs text-slate-500">
              Answer in {question.answer.unit} — just type the number.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3">
          {question.options?.map((o, i) => {
            const selected = response?.kind === "single" && response.optionId === o.id;
            return (
              <button
                key={o.id}
                onClick={() => onSingle(o.id)}
                className={[
                  "w-full rounded-xl border px-4 py-4 text-left text-base transition-colors",
                  selected
                    ? "border-brand bg-panel2 text-white"
                    : "border-line bg-panel text-slate-200 active:bg-panel2",
                ].join(" ")}
              >
                <span className="mr-2 font-mono text-slate-400">{"ABCD"[i] ?? "•"}.</span>
                {o.text}
              </button>
            );
          })}
          <span className="text-xs text-slate-500">You can change your answer until you finish.</span>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-2">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="flex-1 rounded-xl border border-line px-4 py-4 text-base font-medium text-slate-200 active:bg-panel disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={isLast ? onFinish : onNext}
          className="flex-1 rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
