import { describe, it, expect } from "vitest";
import {
  targetDifficulty,
  selectNext,
  selectNextAcrossSections,
  sectionIdOfDomain,
  weightFractionOfDomain,
  diagnosticShouldStop,
  emptyMastery,
  applyResponse,
  type Blueprint,
  type Domain,
  type Question,
  type Section,
  type SelectionPolicy,
} from "../../engine/index.ts";

const policy: SelectionPolicy = { difficultyBias: 0, uncertaintyWeight: 0.6 };

const domains: Domain[] = [
  { id: "a", sectionId: "S1", name: "A", skillIds: [], refs: [] },
  { id: "b", sectionId: "S1", name: "B", skillIds: [], refs: [] },
  { id: "law", sectionId: "S2", name: "Law", skillIds: [], refs: [] },
];

const section1: Section = {
  id: "S1",
  name: "S1",
  totalQuestions: 10,
  totalTimeSec: 600,
  cutScorePct: 0.7,
  domainWeights: [
    { domainId: "a", officialExamWeight: 8 },
    { domainId: "b", officialExamWeight: 2 },
  ],
};
const section2: Section = {
  id: "S2",
  name: "S2",
  totalQuestions: 5,
  totalTimeSec: 300,
  cutScorePct: 0.7,
  domainWeights: [{ domainId: "law", officialExamWeight: 5 }],
};
const blueprint: Blueprint = { examId: "t", passPolicy: "per-section", sections: [section1, section2] };

function q(id: string, domainId: string, difficulty: number): Question {
  return {
    id,
    domainId,
    skillIds: [],
    type: "single",
    difficulty,
    stem: id,
    options: [
      { id: "x", text: "x", isCorrect: true },
      { id: "y", text: "y", isCorrect: false },
    ],
    answer: { kind: "single", optionId: "x" },
    solution: { steps: [], codePath: [], keyIdea: "" },
    timeTargetSec: 60,
    modes: ["diagnostic"],
    status: "draft",
    version: 1,
  };
}

describe("targetDifficulty", () => {
  it("maps mastery 0..1 onto difficulty 1..5", () => {
    expect(targetDifficulty(0, 0)).toBe(1);
    expect(targetDifficulty(1, 0)).toBe(5);
    expect(targetDifficulty(0.5, 0)).toBe(3);
  });
  it("applies and clamps the difficulty bias", () => {
    expect(targetDifficulty(1, 2)).toBe(5); // clamped high
    expect(targetDifficulty(0, -3)).toBe(1); // clamped low
    expect(targetDifficulty(0.5, 1)).toBe(4);
  });
});

describe("selectNext", () => {
  const pool = [q("a1", "a", 1), q("a3", "a", 3), q("b2", "b", 2)];

  it("returns a question from the pool", () => {
    const picked = selectNext({
      section: section1,
      pool,
      mastery: emptyMastery(),
      usedQuestionIds: new Set(),
      policy,
    });
    expect(picked).not.toBeNull();
    expect(pool.map((p) => p.id)).toContain(picked!.id);
  });

  it("never returns an already-used question", () => {
    const used = new Set(["a1", "a3"]);
    const picked = selectNext({
      section: section1,
      pool,
      mastery: emptyMastery(),
      usedQuestionIds: used,
      policy,
    });
    expect(picked?.id).toBe("b2");
  });

  it("returns null when every candidate is used", () => {
    const used = new Set(["a1", "a3", "b2"]);
    const picked = selectNext({
      section: section1,
      pool,
      mastery: emptyMastery(),
      usedQuestionIds: used,
      policy,
    });
    expect(picked).toBeNull();
  });

  it("returns null for an empty pool", () => {
    expect(
      selectNext({
        section: section1,
        pool: [],
        mastery: emptyMastery(),
        usedQuestionIds: new Set(),
        policy,
      }),
    ).toBeNull();
  });
});

describe("sectionIdOfDomain / weightFractionOfDomain", () => {
  it("resolves a domain's section", () => {
    expect(sectionIdOfDomain(domains, "a")).toBe("S1");
    expect(sectionIdOfDomain(domains, "law")).toBe("S2");
    expect(sectionIdOfDomain(domains, "nope")).toBeUndefined();
  });
  it("computes a domain's exam-frequency share", () => {
    expect(weightFractionOfDomain(blueprint, "a")).toBeCloseTo(0.8); // 8/10
    expect(weightFractionOfDomain(blueprint, "law")).toBeCloseTo(1); // 5/5
    expect(weightFractionOfDomain(blueprint, "nope")).toBe(0);
  });
});

describe("selectNextAcrossSections", () => {
  const questions = [q("a1", "a", 1), q("b2", "b", 2), q("law1", "law", 2)];

  it("draws from multiple sections and excludes used ids", () => {
    const picked = selectNextAcrossSections({
      blueprint,
      domains,
      questions,
      mode: "diagnostic",
      mastery: emptyMastery(),
      usedQuestionIds: new Set(),
      policy,
    });
    expect(picked).not.toBeNull();
  });

  it("returns null when all eligible questions are used", () => {
    const picked = selectNextAcrossSections({
      blueprint,
      domains,
      questions,
      mode: "diagnostic",
      mastery: emptyMastery(),
      usedQuestionIds: new Set(["a1", "b2", "law1"]),
      policy,
    });
    expect(picked).toBeNull();
  });

  it("ignores questions not eligible for the requested mode", () => {
    const boardOnly = { ...q("a1", "a", 1), modes: ["board"] as Question["modes"] };
    const picked = selectNextAcrossSections({
      blueprint,
      domains,
      questions: [boardOnly],
      mode: "diagnostic",
      mastery: emptyMastery(),
      usedQuestionIds: new Set(),
      policy,
    });
    expect(picked).toBeNull();
  });
});

describe("diagnosticShouldStop", () => {
  const stop = { maxItems: 5, varianceFloor: 0.03 };

  it("stops when the item budget is reached", () => {
    expect(diagnosticShouldStop({ blueprint, mastery: emptyMastery(), answered: 5, stop })).toBe(true);
  });

  it("does not stop early while domains are still uncertain", () => {
    expect(diagnosticShouldStop({ blueprint, mastery: emptyMastery(), answered: 1, stop })).toBe(false);
  });

  it("never stops early when no variance floor is set", () => {
    const s = { maxItems: 100 };
    expect(diagnosticShouldStop({ blueprint, mastery: emptyMastery(), answered: 3, stop: s })).toBe(false);
  });

  it("stops once every domain is measured below the variance floor", () => {
    let m = emptyMastery();
    for (const d of ["a", "b", "law"]) {
      for (let i = 0; i < 40; i++) m = applyResponse(m, { domainId: d, skillIds: [], correct: true });
    }
    expect(diagnosticShouldStop({ blueprint, mastery: m, answered: 3, stop })).toBe(true);
  });
});
