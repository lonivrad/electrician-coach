import { useEffect, useState } from "react";
import type { Question, Response, Section } from "@engine/index.ts";
import { TopBar } from "../components/TopBar.tsx";

interface Props {
  question: Question;
  section?: Section;
  domainName: string;
  index: number;
  total: number;
  onSubmit: (r: Response) => void;
  onHome: () => void;
  onPrevious?: () => void;
  canPrevious: boolean;
}

export function QuestionPlayer({
  question,
  section,
  domainName,
  index,
  total,
  onSubmit,
  onHome,
  onPrevious,
  canPrevious,
}: Props) {
  const [choice, setChoice] = useState<string | null>(null);
  const [numeric, setNumeric] = useState("");

  // Reset inputs whenever the question changes.
  useEffect(() => {
    setChoice(null);
    setNumeric("");
  }, [question.id]);

  const canSubmit =
    question.type === "numeric" ? numeric.trim() !== "" && !Number.isNaN(Number(numeric)) : choice !== null;

  function handleSubmit() {
    if (question.type === "numeric") {
      onSubmit({ kind: "numeric", value: Number(numeric) });
    } else if (choice) {
      onSubmit({ kind: "single", optionId: choice });
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} progressLabel={`Question ${index + 1} of ${total}`} />

      <div className="mb-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          {section?.name ?? "Practice"}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-2">
        <span className="rounded-full border border-brand/40 bg-panel2 px-2.5 py-0.5 text-[11px] font-medium text-brand">
          {domainName}
        </span>
      </div>

      <h1 className="mb-5 text-lg font-semibold leading-snug text-slate-100">{question.stem}</h1>

      {question.type === "numeric" ? (
        <div className="mb-6">
          <label className="mb-2 block text-sm text-slate-400">Enter your answer</label>
          <input
            inputMode="decimal"
            autoFocus
            value={numeric}
            onChange={(e) => setNumeric(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
            placeholder="e.g. 24"
            className="w-full rounded-xl border border-line bg-panel px-4 py-4 text-xl text-slate-100 outline-none focus:border-brand"
          />
          {question.answer.kind === "numeric" && (
            <p className="mt-2 text-xs text-slate-500">Units: {question.answer.unit}</p>
          )}
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3">
          {question.options?.map((o) => {
            const selected = choice === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setChoice(o.id)}
                className={[
                  "w-full rounded-xl border px-4 py-4 text-left text-base transition-colors",
                  selected
                    ? "border-brand bg-panel2 text-white"
                    : "border-line bg-panel text-slate-200 active:bg-panel2",
                ].join(" ")}
              >
                <span className="mr-2 font-mono text-slate-400">{o.id.toUpperCase()}.</span>
                {o.text}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {canPrevious && onPrevious && (
          <button
            onClick={onPrevious}
            className="w-full rounded-xl border border-line px-4 py-3 text-base font-medium text-slate-300 active:bg-panel"
          >
            ← See previous questions
          </button>
        )}
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
