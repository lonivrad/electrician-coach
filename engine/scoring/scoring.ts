// =============================================================================
// engine/scoring/scoring.ts — the weighted learning model.
//
// This is the user's explicit specification, implemented verbatim and computed
// PER SECTION because the WA exam passes/fails each section independently at
// 70%. Raw percentage is never used to prioritize study.
//
//   OfficialExamWeight(d)   = exam question-count for domain d (from blueprint)
//   Mastery(d)              ∈ [0,1]  (live shrinkage estimate)
//   PracticePriority(d)     = OfficialExamWeight(d) · (1 − Mastery(d))
//   ExpectedSectionScore(s) = Σ_{d∈s} weight(d)·Mastery(d) / s.totalQuestions
//   PassProjection          = every section's ExpectedSectionScore ≥ its cut
// =============================================================================

import type { Blueprint, MasteryState, Section } from "../types.ts";
import { domainMastery, DEFAULT_PRIOR, type MasteryPrior } from "../adaptive/mastery.ts";

export interface DomainPriority {
  domainId: string;
  officialExamWeight: number;
  mastery: number;
  practicePriority: number;
  needsVerification?: boolean;
}

export interface SectionProjection {
  sectionId: string;
  name: string;
  totalQuestions: number;
  cutScorePct: number;
  expectedScore: number; // fraction 0..1
  expectedQuestionsCorrect: number;
  passesProjected: boolean;
  domains: DomainPriority[];
}

export interface BoardProjection {
  sections: SectionProjection[];
  /** Informational overall aggregate (the user's ExpectedBoardScore formula). */
  expectedBoardScore: number;
  totalQuestions: number;
  /** True only if EVERY section is projected to clear its own cut. */
  passesAllSections: boolean;
}

export function practicePriority(officialExamWeight: number, mastery: number): number {
  return officialExamWeight * (1 - mastery);
}

function projectSection(section: Section, mastery: MasteryState, prior: MasteryPrior): SectionProjection {
  let weightedCorrect = 0;
  const domains: DomainPriority[] = section.domainWeights.map((w) => {
    const m = domainMastery(mastery, w.domainId, prior).mastery;
    weightedCorrect += w.officialExamWeight * m;
    return {
      domainId: w.domainId,
      officialExamWeight: w.officialExamWeight,
      mastery: m,
      practicePriority: practicePriority(w.officialExamWeight, m),
      needsVerification: w.needsVerification,
    };
  });
  // Rank worst-first by what actually moves the exam needle.
  domains.sort((a, b) => b.practicePriority - a.practicePriority);

  const expectedScore = section.totalQuestions > 0 ? weightedCorrect / section.totalQuestions : 0;
  return {
    sectionId: section.id,
    name: section.name,
    totalQuestions: section.totalQuestions,
    cutScorePct: section.cutScorePct,
    expectedScore,
    expectedQuestionsCorrect: weightedCorrect,
    passesProjected: expectedScore >= section.cutScorePct,
    domains,
  };
}

export function projectBoard(
  blueprint: Blueprint,
  mastery: MasteryState,
  prior: MasteryPrior = DEFAULT_PRIOR,
): BoardProjection {
  const sections = blueprint.sections.map((s) => projectSection(s, mastery, prior));
  const totalQuestions = sections.reduce((n, s) => n + s.totalQuestions, 0);
  const weightedCorrect = sections.reduce((n, s) => n + s.expectedQuestionsCorrect, 0);
  return {
    sections,
    totalQuestions,
    expectedBoardScore: totalQuestions > 0 ? weightedCorrect / totalQuestions : 0,
    passesAllSections: sections.every((s) => s.passesProjected),
  };
}

/** Flat, worst-first priority list across all sections (for a study queue). */
export function studyQueue(
  blueprint: Blueprint,
  mastery: MasteryState,
  prior: MasteryPrior = DEFAULT_PRIOR,
): DomainPriority[] {
  return projectBoard(blueprint, mastery, prior)
    .sections.flatMap((s) => s.domains)
    .sort((a, b) => b.practicePriority - a.practicePriority);
}
