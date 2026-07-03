interface Props {
  onStay: () => void;
  onLeave: () => void;
  message?: string;
}

/** Confirms leaving a practice/exam run. Large, plain buttons for older users. */
export function ExitConfirm({ onStay, onLeave, message }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel2 p-5">
        <h2 className="text-lg font-bold text-white">Leave?</h2>
        <p className="mt-1 text-sm text-slate-300">{message ?? "Your progress is saved automatically."}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onStay}
            className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
          >
            Stay
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
