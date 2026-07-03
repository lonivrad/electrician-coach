import { useEffect, useRef } from "react";

interface Props {
  onStay: () => void;
  onLeave: () => void;
  message?: string;
}

/** Confirms leaving a practice/exam run. Large, plain buttons for older users. */
export function ExitConfirm({ onStay, onLeave, message }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  // Always call the latest onStay without re-running the mount effect.
  const onStayRef = useRef(onStay);
  onStayRef.current = onStay;

  useEffect(() => {
    // Remember what had focus so we can restore it when the dialog closes.
    const trigger = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onStayRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Trap focus inside the dialog.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-dialog-title"
        className="w-full max-w-sm rounded-2xl border border-line bg-panel2 p-5"
      >
        <h2 id="exit-dialog-title" className="text-lg font-bold text-white">
          Leave?
        </h2>
        <p className="mt-1 text-sm text-slate-300">{message ?? "Your progress is saved automatically."}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={stayRef}
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
