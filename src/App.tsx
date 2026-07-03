import { useState } from "react";
import { useDiagnostic } from "./state/useDiagnostic.ts";
import { QuestionPlayer } from "./ui/player/QuestionPlayer.tsx";
import { Explanation } from "./ui/player/Explanation.tsx";
import { WeaknessMap } from "./ui/results/WeaknessMap.tsx";

export function App() {
  const d = useDiagnostic();
  const [exitOpen, setExitOpen] = useState(false);
  const domainName = (id: string) => d.pack.domains.find((x) => x.id === id)?.name ?? id;
  const askExit = () => setExitOpen(true);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-5">
      {d.phase === "intro" && <Intro pack={d.pack} onStart={d.start} />}

      {d.phase === "question" && d.current && (
        <QuestionPlayer
          question={d.current}
          section={d.currentSection}
          domainName={domainName(d.current.domainId)}
          index={d.answeredThisRun}
          total={d.plannedItems}
          onSubmit={d.submit}
          onHome={askExit}
          onPrevious={d.enterReview}
          canPrevious={d.canReview}
        />
      )}

      {d.phase === "feedback" && d.feedback && (
        <Explanation
          question={d.feedback.question}
          correct={d.feedback.correct}
          response={d.feedback.response}
          onHome={askExit}
          progressLabel={`Question ${d.answeredThisRun} of ${d.plannedItems}`}
          onNext={d.next}
        />
      )}

      {d.phase === "review" && d.reviewItem && d.reviewPosition && (
        <Explanation
          question={d.reviewItem.question}
          correct={d.reviewItem.correct}
          response={d.reviewItem.response}
          onHome={askExit}
          progressLabel={`Reviewing ${d.reviewPosition.index + 1} of ${d.reviewPosition.total}`}
          review={{
            label: `Reviewing ${d.reviewPosition.index + 1} of ${d.reviewPosition.total}`,
            canOlder: d.reviewPosition.index > 0,
            canNewer: d.reviewPosition.index < d.reviewPosition.total - 1,
            onOlder: () => d.reviewStep(-1),
            onNewer: () => d.reviewStep(1),
            onReturn: d.exitReview,
          }}
        />
      )}

      {d.phase === "results" && (
        <WeaknessMap
          pack={d.pack}
          mastery={d.liveMastery}
          answered={d.answeredThisRun}
          onRestart={d.start}
          onReset={d.resetAll}
          onHome={d.goHome}
        />
      )}

      {exitOpen && (
        <ExitConfirm
          onStay={() => setExitOpen(false)}
          onLeave={() => {
            setExitOpen(false);
            d.goHome();
          }}
        />
      )}
    </div>
  );
}

function ExitConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel2 p-5">
        <h2 className="text-lg font-bold text-white">Leave practice?</h2>
        <p className="mt-1 text-sm text-slate-300">Your progress is saved automatically.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onStay}
            className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
          >
            Stay in practice
          </button>
          <button
            onClick={onLeave}
            className="w-full rounded-xl border border-line px-4 py-3 text-base font-medium text-slate-300 active:bg-panel"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

function Intro({ pack, onStart }: { pack: ReturnType<typeof useDiagnostic>["pack"]; onStart: () => void }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-6">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Electrician Coach</div>
        <h1 className="mt-1 text-2xl font-bold text-white">{pack.name}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Practice for the Washington journeyman electrician exam. There are two parts: Electrical Code &amp;
          Theory (60 questions) and Washington Laws &amp; Rules (17 questions). You need 70% on each part to
          pass.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <ModeCard
          title="Find My Weak Spots"
          desc="A relaxed quiz that shows which topics to focus on. No timer."
          active
          onClick={onStart}
        />
        <ModeCard
          title="Practice Exam"
          desc="A timed test that feels like the real exam."
          badge="Coming soon"
        />
        <ModeCard title="Hard Mode" desc="Tougher questions to build your confidence." badge="Coming soon" />
      </div>

      <div className="mt-6 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-slate-400">
        These are practice questions to help you study. They are not the official exam.
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={onStart}
          className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          Start
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  desc,
  active,
  badge,
  onClick,
}: {
  title: string;
  desc: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={[
        "w-full rounded-xl border px-4 py-3 text-left",
        active ? "border-brand bg-panel2 active:bg-panel" : "border-line bg-panel opacity-70",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-slate-100">{title}</span>
        {badge && (
          <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] text-slate-400">{badge}</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </button>
  );
}
