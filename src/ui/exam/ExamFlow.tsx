import { useState } from "react";
import { useExam, type ExamMode, type SectionOption } from "../../state/useExam.ts";
import { ExamRunner } from "./ExamRunner.tsx";
import { ExamResults } from "./ExamResults.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { ExitConfirm } from "../components/ExitConfirm.tsx";

interface Props {
  mode: ExamMode;
  onExit: () => void;
}

export function ExamFlow({ mode, onExit }: Props) {
  const e = useExam(mode);
  const [exitOpen, setExitOpen] = useState(false);
  const askExit = () => setExitOpen(true);

  return (
    <>
      {e.phase === "config" && (
        <ExamConfig
          title={mode === "overtrain" ? "Hard Mode" : "Practice Exam"}
          subtitle={
            mode === "overtrain"
              ? "Tougher questions and a tighter clock than the real exam. You won't see answers until you finish."
              : "Pick a part to take under real exam time. You won't see answers until you finish."
          }
          options={e.sectionOptions}
          onStart={e.start}
          onHome={onExit}
        />
      )}

      {e.phase === "running" && e.current && (
        <ExamRunner
          question={e.current}
          section={e.section}
          index={e.index}
          total={e.total}
          remainingSec={e.remainingSec}
          allottedSec={e.allottedSec}
          response={e.answers[e.current.id]}
          rawNumeric={e.numericRaw[e.current.id] ?? ""}
          onSingle={(oid) => e.current && e.setSingle(e.current.id, oid)}
          onNumeric={(raw, val) => e.current && e.setNumeric(e.current.id, raw, val)}
          onPrev={e.goPrev}
          canPrev={e.index > 0}
          onNext={e.goNext}
          isLast={e.isLast}
          onFinish={() => e.finish(false)}
          onHome={askExit}
        />
      )}

      {e.phase === "results" && e.report && (
        <ExamResults report={e.report} onAgain={e.restart} onHome={onExit} />
      )}

      {exitOpen && (
        <ExitConfirm
          message="Leave the practice exam? This run won't be scored."
          onStay={() => setExitOpen(false)}
          onLeave={() => {
            setExitOpen(false);
            onExit();
          }}
        />
      )}
    </>
  );
}

function ExamConfig({
  title,
  subtitle,
  options,
  onStart,
  onHome,
}: {
  title: string;
  subtitle: string;
  options: SectionOption[];
  onStart: (sectionId: string) => void;
  onHome: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <TopBar onHome={onHome} />
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <p className="mt-1 text-sm text-slate-300">{subtitle}</p>

      <div className="mt-6 flex flex-col gap-3">
        {options.map((o) => {
          const minutes = Math.round((o.available * o.perQuestionSec) / 60);
          return (
            <button
              key={o.id}
              onClick={() => onStart(o.id)}
              disabled={o.available === 0}
              className="w-full rounded-xl border border-brand bg-panel2 px-4 py-4 text-left active:bg-panel disabled:opacity-40"
            >
              <span className="text-base font-semibold text-slate-100">{o.name}</span>
              <p className="mt-1 text-xs text-slate-400">
                {o.available} question{o.available === 1 ? "" : "s"} · about {minutes} min
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
