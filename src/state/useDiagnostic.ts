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

/** Thin adapter over the engine's cross-section selection for this pack + mode. */
function pickNext(pack: ContentPack, mastery: MasteryState, used: Set<string>): Question | null {
  return selectNextAcrossSections({
    blueprint: pack.blueprint,
    domains: pack.domains,
    questions: pack.questions,
    mode: "diagnostic",
    mastery,
    usedQuestionIds: used,
    policy: POLICY.selection,
  });
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
  // Working mastery for the run starts from persisted state (live-only history).
  const runMastery = useRef<MasteryState>(progress.mastery);

  const start = useCallback(() => {
    usedThisRun.current = new Set();
    runMastery.current = progress.mastery;
    liveQuestionPending.current = false;
    setAnsweredThisRun(0);
    setHistory([]);
    setViewIndex(null);
    const q = pickNext(pack, runMastery.current, usedThisRun.current);
    setCurrent(q);
    setPhase(q ? "question" : "results");
  }, [pack, progress.mastery]);

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
    [current, history.length, pack.examId, progress.seenQuestionIds, progress.missedQuestionIds, repo],
  );

  // Advance to a brand-new question (or results if the diagnostic is done).
  const advanceToNewQuestion = useCallback(() => {
    const done = diagnosticShouldStop({
      blueprint: pack.blueprint,
      mastery: runMastery.current,
      answered: answeredThisRun,
      stop: POLICY.stop,
    });
    const q = done ? null : pickNext(pack, runMastery.current, usedThisRun.current);
    setViewIndex(null);
    if (!q) {
      setCurrent(null);
      setPhase("results");
    } else {
      setCurrent(q);
      setPhase("question");
    }
  }, [answeredThisRun, pack]);

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
