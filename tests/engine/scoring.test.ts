import { describe, it, expect } from "vitest";
import {
  emptyMastery,
  applyResponse,
  updateEstimate,
  practicePriority,
  projectBoard,
  studyQueue,
  DEFAULT_PRIOR,
  type Blueprint,
} from "../../engine/index.ts";

// A tiny two-section blueprint that mirrors the real exam's shape.
const blueprint: Blueprint = {
  examId: "test",
  passPolicy: "per-section",
  sections: [
    {
      id: "A",
      name: "A",
      totalQuestions: 10,
      totalTimeSec: 600,
      cutScorePct: 0.7,
      domainWeights: [
        { domainId: "big", officialExamWeight: 8 },
        { domainId: "rare", officialExamWeight: 2 },
      ],
    },
    {
      id: "B",
      name: "B",
      totalQuestions: 5,
      totalTimeSec: 300,
      cutScorePct: 0.7,
      domainWeights: [{ domainId: "law", officialExamWeight: 5 }],
    },
  ],
};

describe("shrinkage mastery", () => {
  it("barely moves off the prior on a single 0-for-1", () => {
    const est = updateEstimate(undefined, false, DEFAULT_PRIOR);
    // (0 + 4*0.5) / (1 + 4) = 0.40
    expect(est.mastery).toBeCloseTo(0.4, 5);
    expect(est.seen).toBe(1);
  });

  it("starts every domain at the neutral prior (no seeding)", () => {
    const s = emptyMastery();
    expect(Object.keys(s.byDomain)).toHaveLength(0);
  });
});

describe("weighted learning model", () => {
  it("does not prioritize a rare domain over a big one on one miss each", () => {
    let m = emptyMastery();
    // Both domains: one wrong answer.
    m = applyResponse(m, { domainId: "big", skillIds: [], correct: false });
    m = applyResponse(m, { domainId: "rare", skillIds: [], correct: false });

    // Same mastery (0.40), but PracticePriority scales by exam weight.
    const pBig = practicePriority(8, 0.4);
    const pRare = practicePriority(2, 0.4);
    expect(pBig).toBeGreaterThan(pRare);

    const queue = studyQueue(blueprint, m);
    expect(queue[0].domainId).not.toBe("rare");
  });

  it("computes ExpectedSectionScore per section and gates pass on each", () => {
    let m = emptyMastery();
    // Make section A strong, section B weak.
    for (let i = 0; i < 10; i++) m = applyResponse(m, { domainId: "big", skillIds: [], correct: true });
    for (let i = 0; i < 10; i++) m = applyResponse(m, { domainId: "law", skillIds: [], correct: false });

    const proj = projectBoard(blueprint, m);
    const a = proj.sections.find((s) => s.sectionId === "A")!;
    const b = proj.sections.find((s) => s.sectionId === "B")!;
    expect(a.expectedScore).toBeGreaterThan(b.expectedScore);
    // A strong section must not mask a failing one.
    expect(proj.passesAllSections).toBe(b.passesProjected && a.passesProjected);
  });

  it("ExpectedBoardScore matches Σ(weight*mastery)/totalQuestions", () => {
    const m = emptyMastery(); // all at prior 0.5
    const proj = projectBoard(blueprint, m);
    // Every domain at 0.5 → overall expected 0.5.
    expect(proj.expectedBoardScore).toBeCloseTo(0.5, 5);
    expect(proj.totalQuestions).toBe(15);
  });
});
