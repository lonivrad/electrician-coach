import { projectBoard, type ContentPack, type MasteryState } from "@engine/index.ts";
import { TopBar } from "../components/TopBar.tsx";

interface Props {
  pack: ContentPack;
  mastery: MasteryState;
  answered: number;
  onRestart: () => void;
  onReset: () => void;
  onHome: () => void;
}

export function WeaknessMap({ pack, mastery, answered, onRestart, onReset, onHome }: Props) {
  const projection = projectBoard(pack.blueprint, mastery);
  const topicName = (id: string) => pack.domains.find((d) => d.id === id)?.name ?? id;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} />

      <h1 className="text-xl font-bold text-white">How You're Doing</h1>
      <p className="mt-1 text-sm text-slate-300">
        Based on the {answered} question{answered === 1 ? "" : "s"} you just answered.
      </p>

      {/* Pass outlook banner */}
      <div
        className={[
          "mt-4 rounded-xl border px-4 py-3",
          projection.passesAllSections ? "border-good/40 bg-good/10" : "border-warn/40 bg-warn/10",
        ].join(" ")}
      >
        <div className={`text-sm font-semibold ${projection.passesAllSections ? "text-good" : "text-warn"}`}>
          {projection.passesAllSections
            ? "You're on track to pass both parts"
            : "Not on track to pass yet — keep practicing"}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          You need 70% on each part. This is an early estimate and will sharpen as you answer more.
        </div>
      </div>

      {/* Per-part cards */}
      <div className="mt-4 flex flex-col gap-4">
        {projection.sections.map((s) => (
          <div key={s.sectionId} className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-100">{s.name}</h2>
              <span className={`text-sm font-bold ${s.passesProjected ? "text-good" : "text-warn"}`}>
                {(s.expectedScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mb-1 text-xs text-slate-500">
              About {Math.round(s.expectedQuestionsCorrect)} out of {s.totalQuestions} right · need 70%
            </div>

            {/* score bar with 70% goal line */}
            <ScoreBar value={s.expectedScore} cut={s.cutScorePct} pass={s.passesProjected} />

            {/* what to focus on next */}
            <div className="mt-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
                What to practice next
              </div>
              <div className="flex flex-col gap-2">
                {s.domains.slice(0, 4).map((d) => (
                  <div key={d.domainId} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-200">{topicName(d.domainId)}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${Math.round(d.mastery * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-12 shrink-0 text-right text-xs text-slate-300">
                      {Math.round(d.mastery * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-slate-400">
        These are practice questions to help you study. They are not the official exam.
      </p>

      <div className="mt-4 flex flex-col gap-2 pb-2">
        <button
          onClick={onRestart}
          className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          Practice again
        </button>
        <button
          onClick={onReset}
          className="w-full rounded-xl border border-line px-4 py-3 text-sm text-slate-400 active:bg-panel"
        >
          Erase my practice history
        </button>
      </div>
    </div>
  );
}

function ScoreBar({ value, cut, pass }: { value: number; cut: number; pass: boolean }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full ${pass ? "bg-good" : "bg-warn"}`}
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
      {/* 70% goal marker */}
      <div className="absolute top-0 h-full w-0.5 bg-slate-200/70" style={{ left: `${cut * 100}%` }} />
    </div>
  );
}
