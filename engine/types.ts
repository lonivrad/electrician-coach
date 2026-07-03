// =============================================================================
// engine/types.ts — EXAM-AGNOSTIC domain types.
//
// The engine knows NOTHING about electricians, the NEC, or Washington law.
// Every domain-specific concept (domains, skills, traps, sections, blueprint
// weights) arrives as DATA from a ContentPack. There are deliberately NO enums
// of content areas or trap tags here — those live in the pack. Adding a new
// exam must require zero changes to this file.
// =============================================================================

export type Id = string;

/** Opaque identifiers, aliased for readability only. All are plain strings. */
export type DomainId = Id;
export type SkillId = Id;
export type TrapId = Id;
export type SectionId = Id;
export type QuestionId = Id;
export type ExamId = Id;

export type Mode = "diagnostic" | "board" | "overtrain";

// ---- Content shape (see contracts/contentPack.ts for the full pack) ---------

export interface Domain {
  id: DomainId;
  sectionId: SectionId;
  name: string;
  skillIds: SkillId[];
  /** Code references (article/table numbers only — never reproduced text). */
  refs: string[];
  /** Provisional weightings etc. are flagged so the UI can surface them. */
  needsVerification?: boolean;
  verificationNote?: string;
}

export interface TrapDef {
  id: TrapId;
  name: string;
  description: string;
}

export type QuestionType = "single" | "multi" | "numeric";
export type QuestionStatus = "draft" | "reviewed" | "live";

export interface Option {
  id: Id;
  text: string;
  isCorrect: boolean;
  /** Why a candidate might wrongly pick this — used to teach the trap. */
  distractorRationale?: string;
}

export interface SolutionStep {
  text: string;
  /** Article/table cited for this step (reference only). */
  ref?: string;
}

export type AnswerKey =
  | { kind: "single"; optionId: Id }
  | { kind: "multi"; optionIds: Id[] }
  | { kind: "numeric"; value: number; unit: string; tolerance: number };

export interface Question {
  id: QuestionId;
  domainId: DomainId;
  skillIds: SkillId[];
  type: QuestionType;
  /** Authored difficulty on a 1..5 ladder (see content strategy §6.3). */
  difficulty: number;
  stem: string;
  options?: Option[];
  answer: AnswerKey;
  solution: { steps: SolutionStep[]; codePath: string[]; keyIdea: string };
  /** One plain sentence naming the likely wrong path — shown on a wrong answer. */
  commonMistake?: string;
  trapIds?: TrapId[];
  timeTargetSec: number;
  modes: Mode[];
  status: QuestionStatus;
  version: number;
  /** Free-text note, e.g. a NEEDS_VERIFICATION reason on a draft item. */
  note?: string;
  /** Author is unsure of a value/citation — surfaced by the validator for SME review. */
  needsReview?: boolean;
}

// ---- Blueprint (section-structured; passing is PER SECTION) -----------------

export interface DomainWeight {
  domainId: DomainId;
  /**
   * OfficialExamWeight, expressed as the NUMBER OF EXAM QUESTIONS drawn from
   * this domain. Per section these must sum to section.totalQuestions.
   */
  officialExamWeight: number;
  needsVerification?: boolean;
  verificationNote?: string;
}

export interface Section {
  id: SectionId;
  name: string;
  totalQuestions: number;
  totalTimeSec: number;
  /** Pass threshold for THIS section (fraction, e.g. 0.70). */
  cutScorePct: number;
  domainWeights: DomainWeight[];
}

export interface Blueprint {
  examId: ExamId;
  /** Both sections must independently clear their cut score. */
  passPolicy: "per-section";
  sections: Section[];
}

// ---- Mastery / progress -----------------------------------------------------

export interface MasteryEstimate {
  /**
   * Shrinkage estimate in [0,1]:
   *   mastery = (correct + priorAlpha * priorMean) / (seen + priorAlpha)
   * so a single 0-for-1 barely moves off the neutral prior.
   */
  mastery: number;
  seen: number;
  correct: number;
  /** Uncertainty; shrinks as `seen` grows. Drives the diagnostic stop rule. */
  variance: number;
}

export interface MasteryState {
  byDomain: Record<DomainId, MasteryEstimate>;
  bySkill: Record<SkillId, MasteryEstimate>;
  trapAccuracy: Record<TrapId, { seen: number; correct: number }>;
}

// ---- Sessions ---------------------------------------------------------------

export type Response =
  { kind: "single"; optionId: Id } | { kind: "multi"; optionIds: Id[] } | { kind: "numeric"; value: number };

export interface SessionItem {
  questionId: QuestionId;
  domainId: DomainId;
  presentedAt: number;
  answeredAt?: number;
  response?: Response;
  correct?: boolean;
  elapsedSec?: number;
}

export interface Session {
  id: Id;
  mode: Mode;
  examId: ExamId;
  startedAt: number;
  itemsPlanned: number;
  items: SessionItem[];
  state: "active" | "completed" | "abandoned";
}
