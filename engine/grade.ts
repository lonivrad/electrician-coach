// =============================================================================
// engine/grade.ts — grade a Response against a Question's AnswerKey.
//
// Numeric answers are graded on the VALUE ONLY. The unit is shown in the prompt
// and is never required in the input — on the real PSI exam the candidate types
// a number, not a unit. parseNumericInput() strips any unit/whitespace/thousands
// separators the user might type so "24", "24 in³", and "24in3" all grade the same.
// =============================================================================

import type { Question, Response } from "./types.ts";

/**
 * Extract the numeric value from free-form user input, ignoring any unit text.
 * Returns null when the input contains no number (so the UI can block submit).
 *
 *   "24"      → 24        "24 in³"  → 24        "24in3"  → 24
 *   "1,200"   → 1200      "-5.5"    → -5.5      ".5"     → 0.5
 *   "  33 A " → 33        "abc"     → null      ""       → null
 */
export function parseNumericInput(raw: string): number | null {
  if (typeof raw !== "string") return null;
  // Drop thousands separators, then take the first number-like token. Anything
  // after it (a unit such as "in³", "A", "VA", "cm") is ignored.
  const cleaned = raw.replace(/,/g, "");
  const match = cleaned.match(/-?\d*\.?\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export function grade(question: Question, response: Response): boolean {
  const key = question.answer;
  switch (key.kind) {
    case "single":
      return response.kind === "single" && response.optionId === key.optionId;
    case "multi": {
      if (response.kind !== "multi") return false;
      const a = new Set(key.optionIds);
      const b = new Set(response.optionIds);
      return a.size === b.size && [...a].every((x) => b.has(x));
    }
    case "numeric":
      // Value-only comparison within tolerance — units are never considered.
      return response.kind === "numeric" && Math.abs(response.value - key.value) <= key.tolerance;
  }
}
