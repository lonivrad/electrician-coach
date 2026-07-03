// A persistent top bar with a large, obvious Home control and optional
// progress text. Kept deliberately simple and high-contrast for older users.

interface Props {
  /** When omitted, no Home button is shown (e.g. when Home is a footer button). */
  onHome?: () => void;
  progressLabel?: string;
}

export function TopBar({ onHome, progressLabel }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      {onHome ? (
        <button
          onClick={onHome}
          aria-label="Go to the home screen"
          className="flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-base font-semibold text-slate-100 active:bg-panel2"
        >
          <HomeIcon />
          Home
        </button>
      ) : (
        <span />
      )}
      {progressLabel && <span className="text-sm font-medium text-slate-400">{progressLabel}</span>}
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
