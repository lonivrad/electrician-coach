import type { ExamReport } from "../../state/useExam.ts";
import { TopBar } from "../components/TopBar.tsx";

interface Props {
  report: ExamReport;
  onAgain: () => void;
  onHome: () => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamResults({ report, onAgain, onHome }: Props) {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} />

      <h1 className="text-xl font-bold text-white">{report.sectionName} — Results</h1>

      {/* Pass / fail — the actual score, not a projection. */}
      <div
        className={[
          "mt-4 rounded-xl border px-4 py-4",
          report.passed ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10",
        ].join(" ")}
      >
        <div className={`text-2xl font-bold ${report.passed ? "text-good" : "text-bad"}`}>
          {report.passed ? "Passed" : "Not passed"} · {(report.scorePct * 100).toFixed(0)}%
        </div>
        <div className="mt-1 text-sm text-slate-300">
          {report.correct} of {report.total} correct · need {(report.cutPct * 100).toFixed(0)}% to pass
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Time used {fmt(report.timeUsedSec)} of {fmt(report.allottedSec)}
          {report.timedOut ? " · time ran out" : ""}
          {report.answered < report.total ? ` · ${report.total - report.answered} left blank` : ""}
        </div>
      </div>

      {/* Weighted weakness map for this exam, worst-first. */}
      <div className="mt-5">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">What to practice next</div>
        <div className="flex flex-col gap-2">
          {report.domains.map((d) => (
            <div key={d.domainId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-200">{d.name}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full ${d.accuracy >= 0.7 ? "bg-good" : "bg-warn"}`}
                    style={{ width: `${Math.round(d.accuracy * 100)}%` }}
                  />
                </div>
              </div>
              <div className="w-16 shrink-0 text-right text-xs text-slate-300">
                {d.correct}/{d.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-slate-400">
        These are practice questions to help you study. They are not the official exam.
      </p>

      <div className="mt-4 flex flex-col gap-2 pb-2">
        <button
          onClick={onAgain}
          className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          Take another practice exam
        </button>
        <button
          onClick={onHome}
          className="w-full rounded-xl border border-line px-4 py-3 text-sm text-slate-400 active:bg-panel"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}
