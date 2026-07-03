import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearAllProgress } from "../../data/progressRepo.ts";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Catches any render/runtime crash (including a bad saved-progress read) and
 * shows a calm, plain-language recovery screen instead of a white page. The
 * "Start fresh" action wipes saved data — the usual fix if storage got corrupt.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error caught by boundary:", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private startFresh = () => {
    clearAllProgress();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-3 text-base text-slate-300">
          The app ran into a problem. Your progress is saved. Try reopening it first.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={this.reload}
            className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
          >
            Try again
          </button>
          <button
            onClick={this.startFresh}
            className="w-full rounded-xl border border-line px-4 py-3 text-base font-medium text-slate-300 active:bg-panel"
          >
            Reset my data and start fresh
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          "Reset my data" erases your saved practice history on this device. Use it if "Try again" doesn't
          help.
        </p>
      </div>
    );
  }
}
