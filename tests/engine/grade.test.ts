import { describe, it, expect } from "vitest";
import { grade, parseNumericInput, type Question, type Response } from "../../engine/index.ts";

// A numeric fill-in question whose correct value is 24 in³ (tolerance 0.01).
const numericQ: Question = {
  id: "q-num",
  domainId: "nec.box-fill",
  skillIds: [],
  type: "numeric",
  difficulty: 3,
  stem: "Minimum box volume?",
  answer: { kind: "numeric", value: 24, unit: "in³", tolerance: 0.01 },
  solution: { steps: [], codePath: [], keyIdea: "" },
  timeTargetSec: 60,
  modes: ["diagnostic"],
  status: "draft",
  version: 1,
};

const numResponse = (raw: string): Response => ({
  kind: "numeric",
  value: parseNumericInput(raw) ?? NaN,
});

describe("parseNumericInput — strips units, keeps the number", () => {
  it("bare number", () => expect(parseNumericInput("24")).toBe(24));
  it("number with unit and space", () => expect(parseNumericInput("24 in³")).toBe(24));
  it("number jammed against unit", () => expect(parseNumericInput("24in3")).toBe(24));
  it("thousands separator", () => expect(parseNumericInput("1,200")).toBe(1200));
  it("decimal", () => expect(parseNumericInput("13.5")).toBe(13.5));
  it("leading decimal", () => expect(parseNumericInput(".5")).toBe(0.5));
  it("negative", () => expect(parseNumericInput("-5.5")).toBe(-5.5));
  it("surrounding whitespace and trailing unit", () => expect(parseNumericInput("  33 A ")).toBe(33));
  it("no number → null", () => expect(parseNumericInput("abc")).toBeNull());
  it("empty → null", () => expect(parseNumericInput("")).toBeNull());
});

describe("grade() numeric — value only, unit never required", () => {
  it("bare number is correct", () => {
    expect(grade(numericQ, numResponse("24"))).toBe(true);
  });
  it("number WITH unit is still correct", () => {
    expect(grade(numericQ, numResponse("24 in³"))).toBe(true);
    expect(grade(numericQ, numResponse("24in3"))).toBe(true);
  });
  it("wrong number is incorrect", () => {
    expect(grade(numericQ, numResponse("15"))).toBe(false);
  });
  it("respects tolerance at the boundary", () => {
    const q: Question = { ...numericQ, answer: { kind: "numeric", value: 45.1, unit: "A", tolerance: 1 } };
    expect(grade(q, numResponse("46 A"))).toBe(true); // within ±1
    expect(grade(q, numResponse("47"))).toBe(false); // outside ±1
  });
});

describe("grade() single-choice", () => {
  const singleQ: Question = {
    ...numericQ,
    id: "q-single",
    type: "single",
    options: [
      { id: "a", text: "wrong", isCorrect: false },
      { id: "b", text: "right", isCorrect: true },
    ],
    answer: { kind: "single", optionId: "b" },
  };
  it("correct option", () => expect(grade(singleQ, { kind: "single", optionId: "b" })).toBe(true));
  it("wrong option", () => expect(grade(singleQ, { kind: "single", optionId: "a" })).toBe(false));
});
