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
  domainMastery,
  grade,
  selectNext,
  type ContentPack,
  type MasteryState,
  type Question,
  type Response,
  type Section,
} from "@engine/index.ts";
import { loadWaElectrician01, indexPack } from "../data/packLoader.ts";
import { createLocalProgressRepo, type StoredProgress } from "../data/progressRepo.ts";

export type Phase = "intro" | "question" | "feedback" | "review" | "results";

export interface FeedbackState {
  question: Question;
  correct: boolean;
  response: Response;
}

const POLICY = diagnosticPolicy(30);

/** Pick the most informative next diagnostic item across all sections. */
function pickNext(pack: ContentPack, mastery: MasteryState, used: Set<string>): Question | null {
  const candidates: Question[] = [];
  for (const section of pack.blueprint.sections) {
    const pool = pack.questions.filter(
      (q) => q.modes.includes("diagnostic") && sectionOf(pack, q.domainId) === section.id,
    );
    const c = selectNext({ section, pool, mastery, usedQuestionIds: used, policy: POLICY.selection });
    if (c) candidates.push(c);
  }
  if (candidates.length === 0) return null;

  // Choose the candidate whose domain we know least about (highest uncertainty),
  // weighted by how much the exam cares about that domain.
  let best = candidates[0];
  let bestNeed = -Infinity;
  for (const q of candidates) {
    const est = domainMastery(mastery, q.domainId);
    const uncertainty = est.variance / 0.25;
    const weightFrac = weightFractionOf(pack, q.domainId);
    const need = 0.4 * weightFrac + 0.6 * uncertainty;
    if (need > bestNeed) {
      bestNeed = need;
      best = q;
    }
  }
  return best;
}

function sectionOf(pack: ContentPack, domainId: string): string | undefined {
  return pack.domains.find((d) => d.id === domainId)?.sectionId;
}

function weightFractionOf(pack: ContentPack, domainId: string): number {
  for (const s of pack.blueprint.sections) {
    const w = s.domainWeights.find((x) => x.domainId === domainId);
    if (w) return w.officialExamWeight / s.totalQuestions;
  }
  return 0;
}

export function useDiagnostic() {
  const { pack, issues } = useMemo(() => loadWaElectrician01(), []);
  const idx = useMemo(() => indexPack(pack), [pack]);
  const repo = useMemo(() => createLocalProgressRepo(), []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [progress, setProgress] = useState<StoredProgress>(() => repo.load(pack.examId));
  const [current, setCurrent] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [answeredThisRun, setAnsweredThisRun] = useState(0);
  // Answered items this run, in order — powers the "see previous" review nav.
  const [history, setHistory] = useState<FeedbackState[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  // Where to return to when leaving review (always the live question).
  const returnPhase = useRef<Phase>("question");

  // Questions used within THIS diagnostic run (independent of long-term history).
  const usedThisRun = useRef<Set<string>>(new Set());
  // Working mastery for the run starts from persisted state (live-only history).
  const runMastery = useRef<MasteryState>(progress.mastery);

  const start = useCallback(() => {
    usedThisRun.current = new Set();
    runMastery.current = progress.mastery;
    setAnsweredThisRun(0);
    setHistory([]);
    setReviewIndex(null);
    const q = pickNext(pack, runMastery.current, usedThisRun.current);
    setCurrent(q);
    setFeedback(null);
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

      const persisted: StoredProgress = {
        examId: pack.examId,
        mastery: nextMastery,
        seenQuestionIds: Array.from(new Set([...progress.seenQuestionIds, current.id])),
        updatedAt: Date.now(),
      };
      repo.save(persisted);
      setProgress(persisted);

      const fb: FeedbackState = { question: current, correct, response };
      setFeedback(fb);
      setHistory((h) => [...h, fb]);
      setAnsweredThisRun((n) => n + 1);
      setPhase("feedback");
    },
    [current, pack.examId, progress.seenQuestionIds, repo],
  );

  const next = useCallback(() => {
    const answered = answeredThisRun;
    const done = diagnosticShouldStop({
      blueprint: pack.blueprint,
      mastery: runMastery.current,
      answered,
      stop: POLICY.stop,
    });
    if (done) {
      setPhase("results");
      setCurrent(null);
      setFeedback(null);
      return;
    }
    const q = pickNext(pack, runMastery.current, usedThisRun.current);
    if (!q) {
      setPhase("results");
      setCurrent(null);
    } else {
      setCurrent(q);
      setFeedback(null);
      setPhase("question");
    }
  }, [answeredThisRun, pack]);

  // ---- Navigation ----------------------------------------------------------
  // Exit to the home screen. Progress is already saved after every answer, so
  // leaving mid-question only discards the current unanswered item.
  const goHome = useCallback(() => {
    setReviewIndex(null);
    setPhase("intro");
  }, []);

  // Look back at earlier answered questions (read-only) without disturbing the
  // adaptive state, then resume where you left off.
  const enterReview = useCallback(() => {
    if (history.length === 0) return;
    returnPhase.current = "question";
    setReviewIndex(history.length - 1);
    setPhase("review");
  }, [history.length]);

  const reviewStep = useCallback(
    (delta: number) => {
      setReviewIndex((i) => {
        const base = i ?? 0;
        return Math.min(history.length - 1, Math.max(0, base + delta));
      });
    },
    [history.length],
  );

  const exitReview = useCallback(() => {
    setReviewIndex(null);
    setPhase(returnPhase.current);
  }, []);

  const resetAll = useCallback(() => {
    const fresh = repo.reset(pack.examId);
    setProgress(fresh);
    runMastery.current = fresh.mastery;
    usedThisRun.current = new Set();
    setAnsweredThisRun(0);
    setHistory([]);
    setReviewIndex(null);
    setCurrent(null);
    setFeedback(null);
    setPhase("intro");
  }, [pack.examId, repo]);

  const section: Section | undefined = current
    ? idx.sectionById.get(sectionOf(pack, current.domainId) ?? "")
    : undefined;

  return {
    pack,
    idx,
    issues,
    phase,
    progress,
    current,
    currentSection: section,
    feedback,
    answeredThisRun,
    plannedItems: POLICY.stop.maxItems,
    start,
    submit,
    next,
    resetAll,
    // Navigation
    goHome,
    enterReview,
    reviewStep,
    exitReview,
    canReview: history.length > 0,
    reviewItem: reviewIndex != null ? history[reviewIndex] : null,
    reviewPosition: reviewIndex != null ? { index: reviewIndex, total: history.length } : null,
    // Live mastery for results (working copy reflects this run immediately).
    liveMastery: runMastery.current,
  };
}
