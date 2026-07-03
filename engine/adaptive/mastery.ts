// =============================================================================
// engine/adaptive/mastery.ts — shrinkage Mastery estimator.
//
// Mastery is a Beta-Binomial posterior mean (a shrinkage estimate):
//
//   mastery = (correct + α·priorMean) / (seen + α)
//
// This is what makes two of the user's hard requirements hold *mathematically*,
// not by convention:
//
//   • "Never prioritize a domain just because the user went 0-for-1 on a
//      low-frequency topic." With priorMean=0.5, α=4, a 0/1 gives 0.40 — barely
//      off neutral — so PracticePriority can't spike on one miss.
//
//   • "Mastery updates from live in-app performance only." State starts at the
//      neutral prior; nothing is seeded from the candidate's past exam report.
// =============================================================================

import type { MasteryEstimate, MasteryState } from "../types.ts";

export interface MasteryPrior {
  /** Neutral starting belief about mastery before any evidence. */
  priorMean: number;
  /** Pseudo-count: how many "virtual" observations the prior is worth. */
  priorAlpha: number;
}

export const DEFAULT_PRIOR: MasteryPrior = { priorMean: 0.5, priorAlpha: 4 };

/** A fresh estimate sitting exactly on the prior (zero live evidence). */
export function freshEstimate(prior: MasteryPrior = DEFAULT_PRIOR): MasteryEstimate {
  return {
    mastery: prior.priorMean,
    seen: 0,
    correct: 0,
    variance: betaVariance(prior.priorAlpha * prior.priorMean, prior.priorAlpha * (1 - prior.priorMean)),
  };
}

export function emptyMastery(): MasteryState {
  return { byDomain: {}, bySkill: {}, trapAccuracy: {} };
}

/** Fold one graded response into an estimate. Pure — returns a new estimate. */
export function updateEstimate(
  prev: MasteryEstimate | undefined,
  correct: boolean,
  prior: MasteryPrior = DEFAULT_PRIOR,
): MasteryEstimate {
  const seen = (prev?.seen ?? 0) + 1;
  const correctN = (prev?.correct ?? 0) + (correct ? 1 : 0);
  const a = correctN + prior.priorAlpha * prior.priorMean;
  const b = seen - correctN + prior.priorAlpha * (1 - prior.priorMean);
  return {
    seen,
    correct: correctN,
    mastery: a / (a + b),
    variance: betaVariance(a, b),
  };
}

/** Variance of a Beta(a,b) — our confidence proxy; → 0 as evidence accrues. */
function betaVariance(a: number, b: number): number {
  const n = a + b;
  return (a * b) / (n * n * (n + 1));
}

/** Read a domain's estimate, falling back to the prior if unseen. */
export function domainMastery(
  state: MasteryState,
  domainId: string,
  prior: MasteryPrior = DEFAULT_PRIOR,
): MasteryEstimate {
  return state.byDomain[domainId] ?? freshEstimate(prior);
}

/**
 * Apply one graded answer to the whole MasteryState (domain, its skills, and
 * any trap tallies). Returns a new state; never mutates the input.
 */
export function applyResponse(
  state: MasteryState,
  args: { domainId: string; skillIds: string[]; trapIds?: string[]; correct: boolean },
  prior: MasteryPrior = DEFAULT_PRIOR,
): MasteryState {
  const byDomain = { ...state.byDomain };
  byDomain[args.domainId] = updateEstimate(byDomain[args.domainId], args.correct, prior);

  const bySkill = { ...state.bySkill };
  for (const sk of args.skillIds) {
    bySkill[sk] = updateEstimate(bySkill[sk], args.correct, prior);
  }

  const trapAccuracy = { ...state.trapAccuracy };
  for (const tp of args.trapIds ?? []) {
    const cur = trapAccuracy[tp] ?? { seen: 0, correct: 0 };
    trapAccuracy[tp] = { seen: cur.seen + 1, correct: cur.correct + (args.correct ? 1 : 0) };
  }

  return { byDomain, bySkill, trapAccuracy };
}

/** Confidence in [0,1]: high variance → low confidence. */
export function confidence(est: MasteryEstimate): number {
  // Beta variance maxes at 0.25 (a=b→0). Map onto a friendly 0..1 scale.
  return Math.max(0, Math.min(1, 1 - est.variance / 0.25));
}
