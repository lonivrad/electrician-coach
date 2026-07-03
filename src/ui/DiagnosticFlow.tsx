import { useEffect, useRef, useState } from "react";
import { useDiagnostic } from "../state/useDiagnostic.ts";
import { QuestionPlayer } from "./player/QuestionPlayer.tsx";
import { Explanation } from "./player/Explanation.tsx";
import { WeaknessMap } from "./results/WeaknessMap.tsx";
import { ExitConfirm } from "./components/ExitConfirm.tsx";

export function DiagnosticFlow({ onExit }: { onExit: () => void }) {
  const d = useDiagnostic();
  const [exitOpen, setExitOpen] = useState(false);
  const started = useRef(false);

  // Start the diagnostic once when this flow mounts.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    d.start();
  }, [d]);

  const askExit = () => setExitOpen(true);
  const domainName = (id: string) => d.pack.domains.find((x) => x.id === id)?.name ?? id;

  return (
    <>
      {d.phase === "question" && d.current && (
        <QuestionPlayer
          question={d.current}
          section={d.currentSection}
          domainName={domainName(d.current.domainId)}
          index={d.answeredThisRun}
          total={d.plannedItems}
          onSubmit={d.submit}
          onHome={askExit}
          onPrevious={d.onSeePrevious}
          canPrevious={d.canReview}
        />
      )}

      {d.phase === "explanation" && d.explanationItem && (
        <Explanation
          question={d.explanationItem.question}
          correct={d.explanationItem.correct}
          response={d.explanationItem.response}
          progressLabel={
            d.explanationIsLatest
              ? `Question ${d.answeredThisRun} of ${d.plannedItems}`
              : d.explanationPosition
                ? `Reviewing question ${d.explanationPosition.index + 1} of ${d.explanationPosition.total}`
                : "Looking back"
          }
          onContinue={d.onContinue}
          onPrevious={d.onPreviousQuestion}
          canPrevious={d.canPreviousExplanation}
          onHome={askExit}
        />
      )}

      {d.phase === "results" && (
        <WeaknessMap
          pack={d.pack}
          mastery={d.liveMastery}
          answered={d.answeredThisRun}
          onRestart={d.start}
          onReset={() => {
            d.resetAll();
            onExit();
          }}
          onHome={onExit}
        />
      )}

      {exitOpen && (
        <ExitConfirm
          message="Leave the diagnostic? Your progress is saved."
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
