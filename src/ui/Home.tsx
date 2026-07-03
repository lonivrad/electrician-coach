import { useMemo } from "react";
import { domainMastery, weightFractionOfDomain } from "@engine/index.ts";
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

  // Weakest topics: exam weight × (1 − mastery), among domains with any evidence.
  const weakest = useMemo(() => {
    const mastery = repo.load(pack.examId).mastery;
    return pack.domains
      .map((d) => {
        const est = domainMastery(mastery, d.id);
        return {
          name: d.name,
          seen: est.seen,
          priority: weightFractionOfDomain(pack.blueprint, d.id) * (1 - est.mastery),
        };
      })
      .filter((x) => x.seen > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
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

        {weakest.length > 0 ? (
          <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-slate-200">
            Your weakest areas right now are{" "}
            <span className="font-semibold text-white">{joinList(weakest.map((w) => w.name))}</span>. Start
            there.
          </p>
        ) : (
          <button
            onClick={onStartDiagnostic}
            className="mt-4 w-full rounded-xl border border-brand/50 bg-panel2 px-4 py-3 text-left text-sm text-slate-200 active:bg-panel"
          >
            New here? Start with <span className="font-semibold text-white">Find My Weak Spots</span> — it&apos;ll
            show you which topics to focus on.
          </button>
        )}
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

/** "A" / "A and B" / "A, B, and C" — plain-language list. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
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
