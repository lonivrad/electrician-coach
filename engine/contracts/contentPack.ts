// =============================================================================
// engine/contracts/contentPack.ts — the ONE seam between engine and content.
//
// A ContentPack is a self-contained exam. The engine consumes packs solely
// through this interface. To add a future exam you author a new pack that
// satisfies this contract — no engine code changes.
// =============================================================================

import type {
  Blueprint,
  Domain,
  Question,
  TrapDef,
  ExamId,
  Section,
  DomainId,
  SkillId,
  TrapId,
} from "../types.ts";
import { isKnownCalc, isKnownSizeCalc } from "../calc/calculators.ts";

export interface PackEdition {
  /** e.g. "NEC-2023". */
  code: string;
  status: "NEEDS_VERIFICATION" | "verified";
  note: string;
}

export interface ContentPack {
  id: string;
  examId: ExamId;
  name: string;
  version: number;
  edition: PackEdition;
  domains: Domain[];
  traps: TrapDef[];
  blueprint: Blueprint;
  questions: Question[];
}

// ---- Validation ------------------------------------------------------------
// Pure, dependency-free invariant checks. Used by both the CI validator
// (scripts/validate-pack.ts) and the runtime loader so a malformed pack fails
// loudly instead of silently degrading the adaptive model.

export interface PackIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export function validatePack(pack: ContentPack): PackIssue[] {
  const issues: PackIssue[] = [];
  const err = (code: string, message: string) => issues.push({ level: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ level: "warning", code, message });

  const domainIds = new Set<DomainId>(pack.domains.map((d) => d.id));
  const skillIds = new Set<SkillId>(pack.domains.flatMap((d) => d.skillIds));
  const trapIds = new Set<TrapId>(pack.traps.map((t) => t.id));
  const sectionIds = new Set<string>(pack.blueprint.sections.map((s) => s.id));

  // Every domain points at a real section.
  for (const d of pack.domains) {
    if (!sectionIds.has(d.sectionId)) {
      err("domain.section", `Domain "${d.id}" references unknown section "${d.sectionId}".`);
    }
  }

  // Per section: Σ officialExamWeight === totalQuestions, and weights map to domains.
  for (const s of pack.blueprint.sections) {
    let sum = 0;
    for (const w of s.domainWeights) {
      sum += w.officialExamWeight;
      if (!domainIds.has(w.domainId)) {
        err("weight.domain", `Section "${s.id}" weights unknown domain "${w.domainId}".`);
      }
    }
    if (sum !== s.totalQuestions) {
      err("weight.sum", `Section "${s.id}" weights sum to ${sum} but totalQuestions is ${s.totalQuestions}.`);
    }
    if (s.cutScorePct <= 0 || s.cutScorePct > 1) {
      err("section.cut", `Section "${s.id}" cutScorePct should be a fraction in (0,1].`);
    }
  }

  // Questions: ids resolve; live-gating under NEEDS_VERIFICATION; answer sanity.
  const editionUnverified = pack.edition.status === "NEEDS_VERIFICATION";
  for (const q of pack.questions) {
    if (!domainIds.has(q.domainId)) {
      err("q.domain", `Question "${q.id}" references unknown domain "${q.domainId}".`);
    }
    for (const sk of q.skillIds) {
      if (!skillIds.has(sk)) {
        err("q.skill", `Question "${q.id}" references unknown skill "${sk}".`);
      }
    }
    for (const tp of q.trapIds ?? []) {
      if (!trapIds.has(tp)) {
        err("q.trap", `Question "${q.id}" references unknown trap "${tp}".`);
      }
    }
    if (editionUnverified && q.status === "live") {
      err(
        "q.live-gate",
        `Question "${q.id}" is "live" but pack edition is NEEDS_VERIFICATION. ` +
          `Confirm the adopted code edition before promoting items to live.`,
      );
    }
    if (q.needsReview && q.status === "live") {
      err(
        "q.review-gate",
        `Question "${q.id}" is flagged needsReview but marked live — resolve review first.`,
      );
    }
    if (q.needsReview) {
      warn("q.needs-review", `Question "${q.id}" is flagged needsReview: ${q.note ?? "(author unsure)"}`);
    }
    validateAnswer(q, err);
    checkHygiene(q, err);
  }

  // Warn on any domain/subweight still flagged as provisional.
  for (const d of pack.domains) {
    if (d.needsVerification) {
      warn(
        "domain.unverified",
        `Domain "${d.id}" is flagged NEEDS_VERIFICATION: ${d.verificationNote ?? ""}`,
      );
    }
  }
  for (const s of pack.blueprint.sections) {
    for (const w of s.domainWeights) {
      if (w.needsVerification) {
        warn(
          "weight.unverified",
          `Weight for "${w.domainId}" in section "${s.id}" is provisional: ${w.verificationNote ?? ""}`,
        );
      }
    }
  }

  return issues;
}

function validateAnswer(q: Question, err: (c: string, m: string) => void) {
  if (q.type === "single" || q.type === "multi") {
    const opts = q.options ?? [];
    if (opts.length < 2) err("q.options", `Question "${q.id}" (${q.type}) needs ≥2 options.`);
    const correct = opts.filter((o) => o.isCorrect).map((o) => o.id);
    if (q.answer.kind === "single") {
      if (correct.length !== 1 || correct[0] !== q.answer.optionId) {
        err("q.key", `Question "${q.id}" answer key does not match exactly one isCorrect option.`);
      }
    } else if (q.answer.kind === "multi") {
      const key = new Set(q.answer.optionIds);
      const iscorrect = new Set(correct);
      if (key.size !== iscorrect.size || [...key].some((k) => !iscorrect.has(k))) {
        err("q.key", `Question "${q.id}" multi answer key does not match isCorrect options.`);
      }
    } else {
      err("q.key", `Question "${q.id}" is ${q.type} but has a numeric answer key.`);
    }
  } else if (q.type === "numeric") {
    if (q.answer.kind !== "numeric") {
      err("q.key", `Question "${q.id}" is numeric but answer key is ${q.answer.kind}.`);
    } else if (q.answer.tolerance < 0) {
      err("q.tol", `Question "${q.id}" has negative tolerance.`);
    }
  }
}

/** Data-hygiene checks applied to every question (all are build-failing errors). */
function checkHygiene(q: Question, err: (c: string, m: string) => void) {
  const id = q.id || "(missing id)";
  if (!q.stem || q.stem.trim() === "") err("hy.stem", `Question "${id}" has an empty stem.`);
  if (!Array.isArray(q.skillIds) || q.skillIds.length === 0)
    err("hy.skills", `Question "${id}" must list at least one skillId.`);
  if (typeof q.difficulty !== "number" || q.difficulty < 1 || q.difficulty > 5)
    err("hy.difficulty", `Question "${id}" difficulty must be 1..5 (got ${q.difficulty}).`);
  if (!Array.isArray(q.modes) || q.modes.length === 0)
    err("hy.modes", `Question "${id}" must list at least one mode.`);
  if (typeof q.timeTargetSec !== "number" || q.timeTargetSec <= 0)
    err("hy.time", `Question "${id}" needs a positive estimated time (timeTargetSec).`);
  if (typeof q.version !== "number") err("hy.version", `Question "${id}" is missing version.`);
  if (!q.status) err("hy.status", `Question "${id}" is missing status.`);

  // Worked solution with at least one code citation.
  if (!q.solution || !Array.isArray(q.solution.steps) || q.solution.steps.length === 0)
    err("hy.solution", `Question "${id}" needs a worked solution (at least one step).`);
  if (!q.solution || !Array.isArray(q.solution.codePath) || q.solution.codePath.length === 0)
    err("hy.citation", `Question "${id}" needs at least one code citation (solution.codePath).`);

  // Numeric items: unit, tolerance, and a machine-checkable recompute spec.
  if (q.type === "numeric") {
    if (q.answer.kind === "numeric") {
      if (!q.answer.unit || q.answer.unit.trim() === "")
        err("hy.unit", `Numeric question "${id}" needs a unit.`);
      if (typeof q.answer.tolerance !== "number" || q.answer.tolerance < 0)
        err("hy.tolerance", `Numeric question "${id}" needs a tolerance ≥ 0.`);
    }
    if (!q.recompute) {
      err("hy.recompute", `Numeric question "${id}" needs a recompute spec (calc + inputs).`);
    } else if (!isKnownCalc(q.recompute.calc)) {
      err("hy.calc", `Question "${id}" recompute references unknown calculator "${q.recompute.calc}".`);
    }
  }

  // A single-choice question MAY carry a recompute that names a size calculator
  // (e.g. EGC/GEC sizing) whose result is checked against the keyed option.
  if (q.type === "single" && q.recompute && !isKnownSizeCalc(q.recompute.calc)) {
    err(
      "hy.sizecalc",
      `Question "${id}" recompute references unknown size calculator "${q.recompute.calc}".`,
    );
  }
}

export function packErrors(issues: PackIssue[]): PackIssue[] {
  return issues.filter((i) => i.level === "error");
}

/** Re-exported for pack authors/tools. */
export type { Section, Domain, Question, TrapDef, Blueprint };
