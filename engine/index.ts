// =============================================================================
// engine/index.ts — public surface of the exam-agnostic engine.
//
// The UI and content packs import ONLY from here (and the contracts module).
// Nothing under engine/ imports from content-packs/ — enforced by
// scripts/validate-pack.ts and tests/engine.
// =============================================================================

export * from "./types.ts";
export * from "./contracts/contentPack.ts";
export * from "./adaptive/mastery.ts";
export * from "./adaptive/itemSelection.ts";
export * from "./scoring/scoring.ts";
export * from "./modes/policies.ts";
export { grade, parseNumericInput } from "./grade.ts";
export {
  runCalc,
  isKnownCalc,
  runSizeCalc,
  isKnownSizeCalc,
  nextStandardOCPD,
  correctionFactor,
  adjustmentFactor,
  CALCULATORS,
} from "./calc/calculators.ts";
