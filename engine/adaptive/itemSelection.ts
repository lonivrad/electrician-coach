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

import type {
  Blueprint,
  Domain,
  DomainId,
  Mode,
  MasteryState,
  Question,
  Section,
  SectionId,
} from "../types.ts";
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

/** The section a domain belongs to (pack-defined; opaque to the engine). */
export function sectionIdOfDomain(domains: Domain[], domainId: DomainId): SectionId | undefined {
  return domains.find((d) => d.id === domainId)?.sectionId;
}

/** A domain's share of its section's questions (its exam frequency, 0..1). */
export function weightFractionOfDomain(blueprint: Blueprint, domainId: DomainId): number {
  for (const s of blueprint.sections) {
    const w = s.domainWeights.find((x) => x.domainId === domainId);
    if (w) return s.totalQuestions > 0 ? w.officialExamWeight / s.totalQuestions : 0;
  }
  return 0;
}

export interface AcrossSectionsArgs {
  blueprint: Blueprint;
  domains: Domain[];
  questions: Question[];
  mode: Mode;
  mastery: MasteryState;
  usedQuestionIds: Set<string>;
  policy: SelectionPolicy;
  prior?: MasteryPrior;
}

/**
 * Pick the next item across ALL sections (used by the Baseline Diagnostic):
 * take the best candidate per section, then choose the one whose domain is most
 * worth measuring now — exam frequency weighted against how uncertain we still
 * are about it. Reusable by future modes via the `mode` filter.
 */
export function selectNextAcrossSections(args: AcrossSectionsArgs): Question | null {
  const prior = args.prior ?? DEFAULT_PRIOR;
  const candidates: Question[] = [];
  for (const section of args.blueprint.sections) {
    const pool = args.questions.filter(
      (q) => q.modes.includes(args.mode) && sectionIdOfDomain(args.domains, q.domainId) === section.id,
    );
    const c = selectNext({
      section,
      pool,
      mastery: args.mastery,
      usedQuestionIds: args.usedQuestionIds,
      policy: args.policy,
      prior,
    });
    if (c) candidates.push(c);
  }
  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestNeed = -Infinity;
  for (const q of candidates) {
    const est = domainMastery(args.mastery, q.domainId, prior);
    const uncertainty = est.variance / 0.25;
    const weightFrac = weightFractionOfDomain(args.blueprint, q.domainId);
    const need = 0.4 * weightFrac + 0.6 * uncertainty;
    if (need > bestNeed) {
      bestNeed = need;
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
