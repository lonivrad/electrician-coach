import { describe, it, expect } from "vitest";
import { orderedOptions, type Question } from "../../engine/index.ts";

function q(id: string): Question {
  return {
    id,
    domainId: "d",
    skillIds: ["s"],
    type: "single",
    difficulty: 1,
    stem: "?",
    options: [
      { id: "a", text: "A", isCorrect: true },
      { id: "b", text: "B", isCorrect: false },
      { id: "c", text: "C", isCorrect: false },
      { id: "d", text: "D", isCorrect: false },
    ],
    answer: { kind: "single", optionId: "a" },
    solution: { steps: [], codePath: ["x"], keyIdea: "" },
    timeTargetSec: 10,
    modes: ["board"],
    status: "draft",
    version: 1,
  };
}

describe("orderedOptions", () => {
  it("is deterministic for the same question id", () => {
    expect(orderedOptions(q("q1")).map((o) => o.id)).toEqual(orderedOptions(q("q1")).map((o) => o.id));
  });

  it("preserves the exact option set (ids + isCorrect intact)", () => {
    const out = orderedOptions(q("q1"));
    expect(out).toHaveLength(4);
    expect([...out.map((o) => o.id)].sort()).toEqual(["a", "b", "c", "d"]);
    expect(out.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it("produces different orders across different ids", () => {
    const orders = new Set(
      ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => orderedOptions(q(id)).map((o) => o.id).join("")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("handles a question with no options", () => {
    const bare = { ...q("q1"), options: undefined };
    expect(orderedOptions(bare)).toEqual([]);
  });
});
