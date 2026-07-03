// =============================================================================
// engine/modes/policies.ts — the three modes as data, over one engine.
//
// A "mode" is just a bundle of knobs: item-selection policy, a stop rule, and a
// timing config. Board Sim is deliberately NON-adaptive within a session (a
// blueprint-proportional draw at realistic difficulty); Diagnostic maximizes
// information with no pressure; Overtraining compresses time and pushes hard,
// high-priority items.
// =============================================================================

import type { Mode, Section } from "../types.ts";
import type { SelectionPolicy, StopRule } from "../adaptive/itemSelection.ts";

export interface TimingConfig {
  perQuestionSec: number | null;
  totalSec: number | null;
  showClock: boolean;
}

export interface ModePolicy {
  mode: Mode;
  selection: SelectionPolicy;
  stop: StopRule;
  /** Per-section timing, keyed by sectionId; falls back to `default`. */
  timing: (section: Section) => TimingConfig;
}

/** Baseline Diagnostic: broad, low-pressure, information-maximizing. */
export function diagnosticPolicy(maxItems = 30): ModePolicy {
  return {
    mode: "diagnostic",
    selection: { difficultyBias: 0, uncertaintyWeight: 0.6 },
    stop: { maxItems, varianceFloor: 0.03 },
    timing: () => ({ perQuestionSec: null, totalSec: null, showClock: false }),
  };
}

/** Board Simulator: mirror the real section pace exactly (no compression). */
export function boardPolicy(): ModePolicy {
  return {
    mode: "board",
    selection: { difficultyBias: 0, uncertaintyWeight: 0 }, // blueprint-proportional
    stop: { maxItems: Number.MAX_SAFE_INTEGER },
    timing: (s) => ({
      perQuestionSec: Math.floor(s.totalTimeSec / s.totalQuestions),
      totalSec: s.totalTimeSec,
      showClock: true,
    }),
  };
}

/** Overtraining: harder than real, compressed clock, weakest-first. */
export function overtrainPolicy(paceFactor = 0.75): ModePolicy {
  return {
    mode: "overtrain",
    selection: { difficultyBias: 1, uncertaintyWeight: 0.35 },
    stop: { maxItems: 40 },
    timing: (s) => {
      const realPace = s.totalTimeSec / s.totalQuestions;
      return {
        perQuestionSec: Math.max(30, Math.floor(realPace * paceFactor)),
        totalSec: null,
        showClock: true,
      };
    },
  };
}
