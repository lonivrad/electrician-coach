// =============================================================================
// engine/adaptive/itemSelection.ts — mode-agnostic item picking.
//
// Selection is a POLICY over the mastery state + blueprint. The three modes
// differ only in their policy knobs (see modes/policies.ts):
//   • diagnostic  — maximize information: high exam-weight × high uncertainty,
//                   difficulty near the current ability estimate.
//   • overtrain   — bias to weakest, highest-priority domains and hard items.
//   • board       — blueprint-proportional draw at realistic difficulty.
// =============================================================================

import type { Blueprint, MasteryState, Question, Section } from "../types.ts";
import { domainMastery, DEFAULT_PRIOR, type MasteryPrior } from "./mastery.ts";

export interface SelectionPolicy {
  /** Extra difficulty applied on top of the ability-matched target (−? .. +?). */
  difficultyBias: number;
  /** Weight uncertainty vs. exam-frequency when choosing the next domain. */
  uncertaintyWeight: number; // 0 = pure exam-frequency, 1 = pure uncertainty
}

export interface StopRule {
  maxItems: number;
  /** Stop early once every in-blueprint domain's variance is below this. */
  varianceFloor?: number;
}

/** Deterministic tie-break so sessions are reproducible in tests. */
function byIdHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

/** Target difficulty (1..5) for a domain given its current mastery. */
export function targetDifficulty(mastery: number, bias: number): number {
  const base = 1 + mastery * 4; // 1 at 0 mastery, 5 at full mastery
  return clamp(base + bias, 1, 5);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Pick the next question for a section, or null if none remain / stop reached.
 * `pool` should already be filtered to the mode's eligible, section-scoped,
 * live-or-draft questions.
 */
export function selectNext(args: {
  section: Section;
  pool: Question[];
  mastery: MasteryState;
  usedQuestionIds: Set<string>;
  policy: SelectionPolicy;
  prior?: MasteryPrior;
}): Question | null {
  const { section, pool, mastery, usedQuestionIds, policy } = args;
  const prior = args.prior ?? DEFAULT_PRIOR;

  const available = pool.filter((q) => !usedQuestionIds.has(q.id));
  if (available.length === 0) return null;

  // Score each domain by how much a question there would help *this exam*.
  const domainScore = new Map<string, number>();
  for (const w of section.domainWeights) {
    const est = domainMastery(mastery, w.domainId, prior);
    const freq = w.officialExamWeight / section.totalQuestions; // 0..1
    const uncertainty = est.variance / 0.25; // 0..1
    const score = (1 - policy.uncertaintyWeight) * freq + policy.uncertaintyWeight * uncertainty;
    domainScore.set(w.domainId, score);
  }

  // Rank available questions: prefer high-value domains, then difficulty match.
  let best: Question | null = null;
  let bestKey = -Infinity;
  for (const q of available) {
    const dScore = domainScore.get(q.domainId) ?? 0;
    const m = domainMastery(mastery, q.domainId, prior).mastery;
    const wantDiff = targetDifficulty(m, policy.difficultyBias);
    const diffFit = 1 - Math.abs(q.difficulty - wantDiff) / 4; // 0..1
    const key = dScore * 2 + diffFit + byIdHash(q.id) * 0.05;
    if (key > bestKey) {
      bestKey = key;
      best = q;
    }
  }
  return best;
}

/** Whether the diagnostic has measured every domain confidently enough. */
export function diagnosticShouldStop(args: {
  blueprint: Blueprint;
  mastery: MasteryState;
  answered: number;
  stop: StopRule;
  prior?: MasteryPrior;
}): boolean {
  const { blueprint, mastery, answered, stop } = args;
  const prior = args.prior ?? DEFAULT_PRIOR;
  if (answered >= stop.maxItems) return true;
  const floor = stop.varianceFloor;
  if (floor == null) return false;
  const allDomains = blueprint.sections.flatMap((s) => s.domainWeights);
  return allDomains.every((w) => domainMastery(mastery, w.domainId, prior).variance <= floor);
}
