// =============================================================================
// engine/grade.ts — grade a Response against a Question's AnswerKey.
// =============================================================================

import type { Question, Response } from "./types.ts";

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
      return response.kind === "numeric" && Math.abs(response.value - key.value) <= key.tolerance;
  }
}
