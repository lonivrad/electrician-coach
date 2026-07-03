// =============================================================================
// src/state/useDiagnostic.ts — drives a Baseline Diagnostic over the engine.
//
// The UI is dumb; this hook owns the flow: pick a question (information-
// maximizing across BOTH sections), grade it, fold the result into Mastery,
// persist, and stop when every domain is measured confidently or the item
// budget is hit. Nothing here knows about electricians — it's all engine calls.
// =============================================================================

import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyResponse,
  diagnosticPolicy,
  diagnosticShouldStop,
  grade,
  selectNext,
  selectNextAcrossSections,
  sectionIdOfDomain,
  type ContentPack,
  type MasteryState,
  type Question,
  type Response,
  type Section,
} from "@engine/index.ts";
import { loadPackOnce, indexPack } from "../data/packLoader.ts";
import { createLocalProgressRepo, type StoredProgress } from "../data/progressRepo.ts";

export type Phase = "intro" | "question" | "explanation" | "results";

export interface FeedbackState {
  question: Question;
  correct: boolean;
  response: Response;
}

const POLICY = diagnosticPolicy(30);

// The diagnostic deliberately over-weights the NEC section: the candidate is
// already close on WA Laws & Rules and needs Electrical Code & Theory prep.
const NEC_SECTION_ID = "nec-theory";
const TARGET_NEC_SHARE = 0.85;

function diagnosticPool(pack: ContentPack, section: Section): Question[] {
  return pack.questions.filter(
    (q) => q.modes.includes("diagnostic") && sectionIdOfDomain(pack.domains, q.domainId) === section.id,
  );
}

function pickInSection(
  pack: ContentPack,
  section: Section,
  mastery: MasteryState,
  avoid: Set<string>,
): Question | null {
  return selectNext({
    section,
    pool: diagnosticPool(pack, section),
    mastery,
    usedQuestionIds: avoid,
    policy: POLICY.selection,
  });
}

/**
 * Pick the next diagnostic question. Two deliberate behaviors:
 *  1. NEC emphasis — a proportional scheduler draws ~85% of items from the NEC
 *     section (the candidate needs Code & Theory prep more than WA law).
 *  2. Fresh questions — prefer items not seen in past runs; only cycle back to
 *     already-seen ones once a section's unseen pool is spent.
 */
function pickNext(
  pack: ContentPack,
  mastery: MasteryState,
  drawnThisRun: Set<string>,
  seenBefore: Set<string>,
  qById: Map<string, Question>,
): Question | null {
  const nec = pack.blueprint.sections.find((s) => s.id === NEC_SECTION_ID);
  const law = pack.blueprint.sections.find((s) => s.id !== NEC_SECTION_ID);
  // Pack without the expected two sections: fall back to plain cross-section.
  if (!nec) {
    return selectNextAcrossSections({
      blueprint: pack.blueprint,
      domains: pack.domains,
      questions: pack.questions,
      mode: "diagnostic",
      mastery,
      usedQuestionIds: drawnThisRun,
      policy: POLICY.selection,
    });
  }

  // Count this run's draws per section, then draw from whichever section is
  // furthest below its target share (largest-remainder scheduler).
  let necDrawn = 0;
  let lawDrawn = 0;
  for (const id of drawnThisRun) {
    const sec = sectionIdOfDomain(pack.domains, qById.get(id)?.domainId ?? "");
    if (sec === NEC_SECTION_ID) necDrawn++;
    else lawDrawn++;
  }
  const necStarve = necDrawn / TARGET_NEC_SHARE;
  const lawStarve = law ? lawDrawn / (1 - TARGET_NEC_SHARE) : Infinity;
  const order = necStarve <= lawStarve ? [nec, law] : [law, nec];

  // Phase 1: prefer unseen (avoid this run's draws AND everything seen before).
  const avoidUnseen = new Set([...drawnThisRun, ...seenBefore]);
  for (const s of order) {
    if (!s) continue;
    const q = pickInSection(pack, s, mastery, avoidUnseen);
    if (q) return q;
  }
  // Phase 2: unseen pool spent — allow repeats (avoid only this run's draws).
  for (const s of order) {
    if (!s) continue;
    const q = pickInSection(pack, s, mastery, drawnThisRun);
    if (q) return q;
  }
  return null;
}

export function useDiagnostic() {
  const { pack, issues } = useMemo(() => loadPackOnce(), []);
  const idx = useMemo(() => indexPack(pack), [pack]);
  const repo = useMemo(() => createLocalProgressRepo(), []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState<StoredProgress>(() => repo.load(pack.examId));
  const [current, setCurrent] = useState<Question | null>(null);
  const [answeredThisRun, setAnsweredThisRun] = useState(0);
  // Answered items this run, in order — powers linear back/forward navigation.
  const [history, setHistory] = useState<FeedbackState[]>([]);
  // Which answered item's explanation is on screen (null = not on explanation).
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  // True when history was opened from an as-yet-unanswered live question, so
  // "Continue" past the newest item resumes that question instead of advancing.
  const liveQuestionPending = useRef(false);

  // Questions used within THIS diagnostic run (independent of long-term history).
  const usedThisRun = useRef<Set<string>>(new Set());
  // Snapshot of everything seen in PAST runs, taken at run start — lets a new run
  // prefer fresh questions instead of repeating the same ones each time.
  const seenBefore = useRef<Set<string>>(new Set());
  // Working mastery for the run starts from persisted state (live-only history).
  const runMastery = useRef<MasteryState>(progress.mastery);

  const start = useCallback(() => {
    usedThisRun.current = new Set();
    seenBefore.current = new Set(progress.seenQuestionIds);
    runMastery.current = progress.mastery;
    liveQuestionPending.current = false;
    setAnsweredThisRun(0);
    setHistory([]);
    setViewIndex(null);
    const q = pickNext(pack, runMastery.current, usedThisRun.current, seenBefore.current, idx.questionById);
    setCurrent(q);
    setPhase(q ? "question" : "results");
  }, [pack, idx, progress.mastery, progress.seenQuestionIds]);

  const submit = useCallback(
    (response: Response) => {
      if (!current) return;
      const correct = grade(current, response);

      // Fold into working mastery + persist to long-term progress.
      const nextMastery = applyResponse(runMastery.current, {
        domainId: current.domainId,
        skillIds: current.skillIds,
        trapIds: current.trapIds,
        correct,
      });
      runMastery.current = nextMastery;
      usedThisRun.current.add(current.id);

      // Keep the "missed" retry set current here too: wrong adds, right removes.
      const missed = new Set(progress.missedQuestionIds);
      if (correct) missed.delete(current.id);
      else missed.add(current.id);

      const persisted: StoredProgress = {
        examId: pack.examId,
        mastery: nextMastery,
        seenQuestionIds: Array.from(new Set([...progress.seenQuestionIds, current.id])),
        missedQuestionIds: Array.from(missed),
        attempts: progress.attempts, // the diagnostic isn't a scored run — preserve history
        updatedAt: Date.now(),
      };
      repo.save(persisted);
      setProgress(persisted);

      const fb: FeedbackState = { question: current, correct, response };
      const newIndex = history.length; // index this item will occupy
      setHistory((h) => [...h, fb]);
      liveQuestionPending.current = false;
      setViewIndex(newIndex);
      setAnsweredThisRun((n) => n + 1);
      setPhase("explanation");
    },
    [
      current,
      history.length,
      pack.examId,
      progress.seenQuestionIds,
      progress.missedQuestionIds,
      progress.attempts,
      repo,
    ],
  );

  // Advance to a brand-new question (or results if the diagnostic is done).
  const advanceToNewQuestion = useCallback(() => {
    const done = diagnosticShouldStop({
      blueprint: pack.blueprint,
      mastery: runMastery.current,
      answered: answeredThisRun,
      stop: POLICY.stop,
    });
    const q = done
      ? null
      : pickNext(pack, runMastery.current, usedThisRun.current, seenBefore.current, idx.questionById);
    setViewIndex(null);
    if (!q) {
      setCurrent(null);
      setPhase("results");
    } else {
      setCurrent(q);
      setPhase("question");
    }
  }, [answeredThisRun, pack, idx]);

  // ---- Linear navigation on the explanation screen -------------------------
  // "Continue": step forward through any reviewed history, then either resume a
  // pending live question or move on to a brand-new question.
  const onContinue = useCallback(() => {
    if (viewIndex != null && viewIndex < history.length - 1) {
      setViewIndex(viewIndex + 1);
      return;
    }
    if (liveQuestionPending.current) {
      liveQuestionPending.current = false;
      setViewIndex(null);
      setPhase("question");
      return;
    }
    advanceToNewQuestion();
  }, [viewIndex, history.length, advanceToNewQuestion]);

  // "Previous question": step back one answered question (read-only).
  const onPreviousQuestion = useCallback(() => {
    setViewIndex((i) => (i != null && i > 0 ? i - 1 : i));
  }, []);

  // From a live (unanswered) question: look back at answers already given.
  const onSeePrevious = useCallback(() => {
    if (history.length === 0) return;
    liveQuestionPending.current = true;
    setViewIndex(history.length - 1);
    setPhase("explanation");
  }, [history.length]);

  // Exit to home. Progress is saved after every answer, so nothing is lost.
  const goHome = useCallback(() => {
    liveQuestionPending.current = false;
    setViewIndex(null);
    setPhase("intro");
  }, []);

  const resetAll = useCallback(() => {
    const fresh = repo.reset(pack.examId);
    setProgress(fresh);
    runMastery.current = fresh.mastery;
    usedThisRun.current = new Set();
    liveQuestionPending.current = false;
    setAnsweredThisRun(0);
    setHistory([]);
    setViewIndex(null);
    setCurrent(null);
    setPhase("intro");
  }, [pack.examId, repo]);

  const section: Section | undefined = current
    ? idx.sectionById.get(sectionIdOfDomain(pack.domains, current.domainId) ?? "")
    : undefined;

  const explanationItem = viewIndex != null ? history[viewIndex] : null;
  const explanationIsLatest =
    viewIndex != null && viewIndex === history.length - 1 && !liveQuestionPending.current;
  // Position within answered history, so the UI can show "2 of 5" while paging
  // back. Reviewing is read-only: the explanation screen exposes no submit path,
  // so stepping through past items never re-grades or changes mastery.
  const explanationPosition = viewIndex != null ? { index: viewIndex, total: history.length } : null;

  return {
    pack,
    idx,
    issues,
    phase,
    progress,
    current,
    currentSection: section,
    answeredThisRun,
    plannedItems: POLICY.stop.maxItems,
    start,
    submit,
    resetAll,
    // Navigation
    onContinue,
    onPreviousQuestion,
    onSeePrevious,
    goHome,
    canReview: history.length > 0,
    explanationItem,
    explanationIsLatest,
    explanationPosition,
    canPreviousExplanation: viewIndex != null && viewIndex > 0,
    // Live mastery for results (working copy reflects this run immediately).
    liveMastery: runMastery.current,
  };
}
