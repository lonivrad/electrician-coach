// =============================================================================
// engine/optionOrder.ts — balanced answer-option ordering.
//
// Authored answer keys cluster in the first slots (mostly A/B). Presenting them
// in authored order lets a test-taker game position instead of knowing the
// material. `balancedOptionOrders` assigns each single-choice question a slot for
// its correct answer by ROUND-ROBIN over a stable id sort (0,1,2,3,0,1,2,3,…),
// so across the whole bank the correct answer lands evenly on A/B/C/D. Each
// option keeps its id + isCorrect, so grading is unaffected — the UI labels
// A/B/C/D by DISPLAY position. Deterministic: the same bank always produces the
// same order, so navigation and end-of-run review stay consistent.
// =============================================================================

import type { Option, Question } from "./types.ts";

function isSingle(q: Question): boolean {
  return q.type === "single" && (q.options?.length ?? 0) >= 2;
}

/** Map of question id → reordered options with the correct answer balanced. */
export function balancedOptionOrders(questions: Question[]): Map<string, Option[]> {
  const singles = questions
    .filter(isSingle)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const map = new Map<string, Option[]>();
  singles.forEach((q, i) => {
    const opts = q.options ?? [];
    const correct = opts.find((o) => o.isCorrect);
    if (!correct) return; // malformed — leave untouched, validator will flag it
    const distractors = opts.filter((o) => !o.isCorrect);
    const target = i % opts.length; // round-robin slot for the correct answer
    const out: Option[] = [];
    let d = 0;
    for (let slot = 0; slot < opts.length; slot++) {
      out.push(slot === target ? correct : distractors[d++]);
    }
    map.set(q.id, out);
  });
  return map;
}

/** Apply balanced orders in place (used by the pack loader once at startup). */
export function applyBalancedOptionOrders(questions: Question[]): void {
  const orders = balancedOptionOrders(questions);
  for (const q of questions) {
    const o = orders.get(q.id);
    if (o) q.options = o;
  }
}
