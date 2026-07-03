// The math guardrail: for EVERY numeric question, re-derive the answer from its
// recompute spec using the engine calculators and assert it matches the authored
// answer within tolerance. A mismatch — or a numeric question with no recompute
// spec — fails the build, so no wrong-math question can be committed.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { runCalc, type Question } from "../../engine/index.ts";

const packDir = join(process.cwd(), "content-packs", "wa-electrician-01");

function walkYaml(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkYaml(p));
    else if (e.endsWith(".yaml")) out.push(p);
  }
  return out;
}

function loadQuestions(): Question[] {
  const questions: Question[] = [];
  for (const file of walkYaml(join(packDir, "questions"))) {
    const parsed = yaml.load(readFileSync(file, "utf8"));
    if (Array.isArray(parsed)) questions.push(...(parsed as Question[]));
  }
  return questions;
}

const numericQuestions = loadQuestions().filter((q) => q.type === "numeric");

describe("numeric answer recompute guardrail", () => {
  it("there are numeric questions to check", () => {
    expect(numericQuestions.length).toBeGreaterThan(0);
  });

  for (const q of numericQuestions) {
    it(`${q.id}: recomputed answer matches within tolerance`, () => {
      // Every numeric question must be machine-verifiable.
      expect(q.recompute, `${q.id} is numeric but has no recompute spec`).toBeDefined();
      expect(q.answer.kind).toBe("numeric");
      if (q.answer.kind !== "numeric" || !q.recompute) return;

      const computed = runCalc(q.recompute.calc, q.recompute.inputs);
      const diff = Math.abs(computed - q.answer.value);
      expect(
        diff,
        `${q.id}: recompute(${q.recompute.calc}) = ${computed}, authored answer = ${q.answer.value} ${q.answer.unit} (tol ${q.answer.tolerance})`,
      ).toBeLessThanOrEqual(q.answer.tolerance);
    });
  }
});
