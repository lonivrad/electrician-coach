import { useMemo } from "react";
import { loadPackOnce } from "../data/packLoader.ts";
import { createLocalProgressRepo } from "../data/progressRepo.ts";

interface Props {
  onStartDiagnostic: () => void;
  onStartBoard: () => void;
  onStartHardMode: () => void;
  onPracticeMissed: () => void;
}

export function Home({ onStartDiagnostic, onStartBoard, onStartHardMode, onPracticeMissed }: Props) {
  const { pack } = useMemo(() => loadPackOnce(), []);
  const repo = useMemo(() => createLocalProgressRepo(), []);

  const missedCount = useMemo(() => {
    const inPack = new Set(pack.questions.map((q) => q.id));
    return repo.load(pack.examId).missedQuestionIds.filter((id) => inPack.has(id)).length;
  }, [repo, pack]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mt-4">
        <div className="text-xs font-medium uppercase tracking-widest text-brand">Electrician Coach</div>
        <h1 className="mt-1 text-2xl font-bold text-white">{pack.name}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Practice for the Washington journeyman electrician exam. Two parts: Electrical Code &amp; Theory and
          Washington Laws &amp; Rules. You need 70% on each part to pass.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <ModeCard
          title="Find My Weak Spots"
          desc="A relaxed quiz that shows which topics to focus on. No timer."
          active
          onClick={onStartDiagnostic}
        />
        <ModeCard
          title="Practice Exam"
          desc="A timed test that feels like the real exam. Scored at the end."
          active
          onClick={onStartBoard}
        />
        <ModeCard
          title="Hard Mode"
          desc="Tougher questions and a tighter clock than the real exam. Scored at the end."
          active
          onClick={onStartHardMode}
        />
        {missedCount > 0 && (
          <ModeCard
            title="Practice the ones I missed"
            desc={`Go back over the ${missedCount} question${missedCount === 1 ? "" : "s"} you got wrong recently.`}
            active
            onClick={onPracticeMissed}
          />
        )}
      </div>

      <div className="mt-auto pt-6 text-xs text-slate-400">
        These are practice questions to help you study. They are not the official exam.
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
        "w-full rounded-xl border px-4 py-4 text-left",
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
