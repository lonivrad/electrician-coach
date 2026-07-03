import { useEffect, useRef, useState } from "react";
import { useExam } from "../../state/useExam.ts";
import { ExamRunner } from "./ExamRunner.tsx";
import { ExamResults } from "./ExamResults.tsx";
import { ExitConfirm } from "../components/ExitConfirm.tsx";
import { TopBar } from "../components/TopBar.tsx";

// A focused run over only the questions the user has missed. Reuses the exam
// runner/results; the mode passed to useExam is irrelevant because startRetry
// bypasses the per-mode blueprint config.
export function RetryFlow({ onExit }: { onExit: () => void }) {
  const e = useExam("board");
  const started = useRef(false);
  const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    e.startRetry();
  }, [e]);

  return (
    <>
      {e.phase === "config" && (
        <div className="flex min-h-full flex-col">
          <TopBar onHome={onExit} />
          <h1 className="text-xl font-bold text-white">Nothing to practice yet</h1>
          <p className="mt-2 text-sm text-slate-300">
            You have no missed questions right now. Take a Practice Exam or Hard Mode run first — the ones
            you get wrong will collect here so you can practice them again.
          </p>
          <button
            onClick={onExit}
            className="mt-6 w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
          >
            Back to home
          </button>
        </div>
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
          flagged={!!e.flagged[e.current.id]}
          onToggleFlag={() => e.current && e.toggleFlag(e.current.id)}
          onSingle={(oid) => e.current && e.setSingle(e.current.id, oid)}
          onNumeric={(raw, val) => e.current && e.setNumeric(e.current.id, raw, val)}
          onPrev={e.goPrev}
          canPrev={e.index > 0}
          onNext={e.goNext}
          isLast={e.isLast}
          onFinish={() => e.finish(false)}
          onHome={() => setExitOpen(true)}
        />
      )}

      {e.phase === "results" && e.report && (
        <ExamResults
          report={e.report}
          onAgain={() => (e.missedCount > 0 ? e.startRetry() : onExit())}
          againLabel={e.missedCount > 0 ? "Practice these again" : "Back to home"}
          onHome={onExit}
        />
      )}

      {exitOpen && (
        <ExitConfirm
          message="Leave this practice set? This run won't be scored."
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
