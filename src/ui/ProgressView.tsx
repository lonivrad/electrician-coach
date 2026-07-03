import { useMemo } from "react";
import { domainMastery, weightFractionOfDomain } from "@engine/index.ts";
import { loadPackOnce } from "../data/packLoader.ts";
import { createLocalProgressRepo, type AttemptRecord } from "../data/progressRepo.ts";
import { TopBar } from "./components/TopBar.tsx";

const KIND_LABEL: Record<AttemptRecord["kind"], string> = {
  board: "Practice Exam",
  overtrain: "Hard Mode",
  retry: "Retry missed",
};

function fmtWhen(at: number): string {
  const d = new Date(at);
  const day = d.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
}

// One short, motivating sentence — not a stats readout.
function trendLine(scores: number[]): string {
  if (scores.length === 1) return "Nice start — take a few more and you'll see your trend.";
  const last = scores[scores.length - 1];
  const earlier = scores.slice(0, -1);
  const earlierAvg = earlier.reduce((s, x) => s + x, 0) / earlier.length;
  if (last >= earlierAvg + 0.03) return "Your scores are going up. Keep it up!";
  if (last <= earlierAvg - 0.03) return "A little dip lately — keep practicing, you've got this.";
  return "You're holding steady. Keep going.";
}

export function ProgressView({ onHome }: { onHome: () => void }) {
  const { pack } = useMemo(() => loadPackOnce(), []);
  const repo = useMemo(() => createLocalProgressRepo(), []);
  const stored = useMemo(() => repo.load(pack.examId), [repo, pack]);
  const attempts = stored.attempts;

  // Per-topic progress from mastery — reflects EVERY answered question (diagnostic
  // included), so this is useful before any timed exam. Weakest first.
  const areas = useMemo(
    () =>
      pack.domains
        .map((d) => {
          const est = domainMastery(stored.mastery, d.id);
          return {
            id: d.id,
            name: d.name,
            seen: est.seen,
            mastery: est.mastery,
            priority: weightFractionOfDomain(pack.blueprint, d.id) * (1 - est.mastery),
          };
        })
        .filter((x) => x.seen > 0)
        .sort((a, b) => b.priority - a.priority),
    [pack, stored],
  );

  const scores = attempts.map((a) => a.scorePct);
  const recent = attempts.slice(-8); // chronological, for the bars
  const rows = [...attempts].reverse(); // newest first, for the list

  const nothingYet = areas.length === 0 && attempts.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} />
      <h1 className="text-xl font-bold text-white">My progress</h1>

      {nothingYet ? (
        <p className="mt-4 text-sm text-slate-300">
          Nothing here yet. Take “Find My Weak Spots” or a Practice Exam and your progress will show up here
          so you can watch yourself improve.
        </p>
      ) : (
        <>
          {/* By-topic breakdown from mastery — shows after any practice, not just exams. */}
          {areas.length > 0 && (
            <div className="mt-5">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
                How you're doing by topic
              </div>
              <p className="mb-3 text-xs text-slate-400">
                Weakest first. Based on every question you've answered so far.
              </p>
              <div className="flex flex-col gap-2">
                {areas.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-200">{a.name}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className={`h-full rounded-full ${a.mastery >= 0.7 ? "bg-good" : "bg-warn"}`}
                          style={{ width: `${Math.round(a.mastery * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-10 shrink-0 text-right text-xs text-slate-300">
                      {Math.round(a.mastery * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timed practice-exam history. */}
          <div className="mt-6 pb-2">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">Your practice exams</div>

            {attempts.length === 0 ? (
              <p className="text-sm text-slate-400">
                No timed exams yet. Take a Practice Exam and your scores will show up here.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-200">{trendLine(scores)}</p>

                {recent.length > 1 && (
                  <div className="mt-3 flex h-16 items-end gap-1" aria-hidden>
                    {recent.map((a, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-t ${a.scorePct >= 0.7 ? "bg-good" : "bg-warn"}`}
                        style={{ height: `${Math.max(8, Math.round(a.scorePct * 100))}%` }}
                        title={`${Math.round(a.scorePct * 100)}%`}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  {rows.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-slate-200">
                          {KIND_LABEL[a.kind]} · {a.section}
                        </div>
                        <div className="text-xs text-slate-400">
                          {fmtWhen(a.at)} · {a.correct}/{a.total}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-base font-bold ${a.scorePct >= 0.7 ? "text-good" : "text-warn"}`}
                      >
                        {Math.round(a.scorePct * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
