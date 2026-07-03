import { useState } from "react";
import { Home } from "./ui/Home.tsx";
import { DiagnosticFlow } from "./ui/DiagnosticFlow.tsx";
import { ExamFlow } from "./ui/exam/ExamFlow.tsx";
import { RetryFlow } from "./ui/exam/RetryFlow.tsx";
import { ProgressView } from "./ui/ProgressView.tsx";

type Screen = "home" | "diagnostic" | "board" | "overtrain" | "retry" | "progress";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const goHome = () => setScreen("home");

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-5"
      // Clear the iOS status bar / notch: base 1.25rem plus the top safe-area inset.
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
    >
      {screen === "home" && (
        <Home
          onStartDiagnostic={() => setScreen("diagnostic")}
          onStartBoard={() => setScreen("board")}
          onStartHardMode={() => setScreen("overtrain")}
          onPracticeMissed={() => setScreen("retry")}
          onOpenProgress={() => setScreen("progress")}
        />
      )}
      {screen === "diagnostic" && <DiagnosticFlow onExit={goHome} />}
      {screen === "board" && <ExamFlow mode="board" onExit={goHome} />}
      {screen === "overtrain" && <ExamFlow mode="overtrain" onExit={goHome} />}
      {screen === "retry" && <RetryFlow onExit={goHome} />}
      {screen === "progress" && <ProgressView onHome={goHome} />}
    </div>
  );
}
