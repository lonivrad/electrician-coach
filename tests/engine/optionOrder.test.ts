import { describe, it, expect } from "vitest";
import { balancedOptionOrders, type Question } from "../../engine/index.ts";

function q(id: string, correctIdx: number): Question {
  const options = ["a", "b", "c", "d"].map((letter, i) => ({
    id: letter,
    text: letter.toUpperCase(),
    isCorrect: i === correctIdx,
  }));
  return {
    id,
    domainId: "d",
    skillIds: ["s"],
    type: "single",
    difficulty: 1,
    stem: "?",
    options,
    answer: { kind: "single", optionId: options[correctIdx].id },
    solution: { steps: [], codePath: ["x"], keyIdea: "" },
    timeTargetSec: 10,
    modes: ["board"],
    status: "draft",
    version: 1,
  };
}

describe("balancedOptionOrders", () => {
  it("preserves each question's option set (ids + one correct)", () => {
    const qs = [q("q1", 0), q("q2", 0), q("q3", 0)];
    const m = balancedOptionOrders(qs);
    for (const qq of qs) {
      const out = m.get(qq.id)!;
      expect([...out.map((o) => o.id)].sort()).toEqual(["a", "b", "c", "d"]);
      expect(out.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });

  it("spreads the correct answer evenly across all four slots", () => {
    // 40 questions, ALL authored with the correct answer at slot 0.
    const qs = Array.from({ length: 40 }, (_, i) => q(`q${String(i).padStart(2, "0")}`, 0));
    const m = balancedOptionOrders(qs);
    const counts = [0, 0, 0, 0];
    for (const qq of qs) counts[m.get(qq.id)!.findIndex((o) => o.isCorrect)]++;
    expect(counts).toEqual([10, 10, 10, 10]); // exact for a multiple of 4
  });

  it("is deterministic", () => {
    const qs = [q("q1", 1), q("q2", 2)];
    const a = balancedOptionOrders(qs);
    const b = balancedOptionOrders(qs);
    for (const qq of qs) {
      expect(a.get(qq.id)!.map((o) => o.id)).toEqual(b.get(qq.id)!.map((o) => o.id));
    }
  });

  it("ignores numeric questions", () => {
    const num: Question = { ...q("n1", 0), type: "numeric", options: undefined };
    expect(balancedOptionOrders([num]).size).toBe(0);
  });
});
