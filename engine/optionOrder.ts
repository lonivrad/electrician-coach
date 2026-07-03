// =============================================================================
// engine/optionOrder.ts — deterministic option shuffling.
//
// Authored answer keys cluster in the first slots (mostly A/B). Presenting the
// options in authored order lets a test-taker game position instead of knowing
// the material. `orderedOptions` returns a per-question-stable shuffle seeded by
// the question id: the same question always shows the same order (so navigation
// and end-of-run review stay consistent), but correct answers spread across all
// positions. Each option keeps its original id + isCorrect, so grading is
// unaffected — the UI labels A/B/C/D by DISPLAY position, not by option id.
// =============================================================================

import type { Option, Question } from "./types.ts";

/** FNV-1a string hash → 32-bit unsigned. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — small, deterministic, good enough for shuffling 4 items. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A question's options in a deterministic, id-seeded shuffled order. */
export function orderedOptions(q: Question): Option[] {
  const opts = q.options ?? [];
  const rand = mulberry32(hashStr(q.id));
  const a = opts.slice();
  // Fisher-Yates.
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
