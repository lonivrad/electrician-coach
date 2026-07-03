// Small accessibility helpers shared by the two answer-option radio groups.
import type { KeyboardEvent, MutableRefObject } from "react";

/**
 * Arrow-key handler for an ARIA radiogroup of option buttons: moves focus to the
 * previous/next option (wrapping) and selects it, matching native radio behavior.
 * Returns whether it handled the key (so the caller can ignore other keys).
 */
export function radioKeyHandler(
  e: KeyboardEvent<HTMLButtonElement>,
  index: number,
  count: number,
  refs: MutableRefObject<(HTMLButtonElement | null)[]>,
  select: (index: number) => void,
): void {
  const dir =
    e.key === "ArrowDown" || e.key === "ArrowRight"
      ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft"
        ? -1
        : 0;
  if (dir === 0) return;
  e.preventDefault();
  const next = (index + dir + count) % count;
  refs.current[next]?.focus();
  select(next);
}
