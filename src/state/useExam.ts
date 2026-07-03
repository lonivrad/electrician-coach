// =============================================================================
// src/state/useExam.ts — timed, full-run exam flow (Board Simulator; extended
// by Overtraining). No feedback until the end, then a scored report.
//
// Reuses the engine's selection (selectSectionSet) and grading. Only ATTEMPTED
// questions fold into long-term mastery; the exam SCORE counts unanswered as
// wrong (as a real exam does).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyResponse,
  boardPolicy,
  grade,
  selectSectionSet,
  sectionIdOfDomain,
  type Question,
  type Response,
  type Section,
  type SelectionPolicy,
  type Mode,
} from "@engine/index.ts";
import { loadPackOnce } from "../data/packLoader.ts";
import { createLocalProgressRepo } from "../data/progressRepo.ts";

export type ExamMode = "board" | "overtrain";
export type ExamPhase = "config" | "running" | "results";

export interface DomainResult {
  domainId: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
  priority: number; // exam weight × miss-rate, for worst-first sorting
}

export interface ExamReport {
  sectionName: string;
  total: number;
  answered: number;
  correct: number;
  scorePct: number;
  cutPct: number;
  passed: boolean;
  allottedSec: number;
  timeUsedSec: number;
  timedOut: boolean;
  domains: DomainResult[];
}

interface RunConfig {
  eligibility: Mode;
  policy: SelectionPolicy;
  count: number;
  perQuestionSec: number;
  poolFilter: (q: Question) => boolean;
}

function runConfigFor(mode: ExamMode, section: Section): RunConfig {
  const realPace = section.totalTimeSec / section.totalQuestions; // 180s NEC, ~212s law
  if (mode === "board") {
    return {
      eligibility: "board",
      policy: boardPolicy().selection,
      count: section.totalQuestions,
      perQuestionSec: Math.round(realPace),
      poolFilter: () => true,
    };
  }
  // "overtrain" is wired in the Overtraining commit.
  throw new Error(`Exam mode "${mode}" is not configured yet.`);
}

export interface SectionOption {
  id: string;
  name: string;
  available: number; // questions we can actually serve for this mode
  perQuestionSec: number;
}

export function useExam(mode: ExamMode) {
  const { pack } = useMemo(() => loadPackOnce(), []);
  const repo = useMemo(() => createLocalProgressRepo(), []);

  const [phase, setPhase] = useState<ExamPhase>("config");
  const [section, setSection] = useState<Section | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Response>>({});
  const [numericRaw, setNumericRaw] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [allottedSec, setAllottedSec] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [report, setReport] = useState<ExamReport | null>(null);
  const deadlineRef = useRef<number | null>(null);

  // Sections the user can choose, with the count we can actually serve.
  const sectionOptions: SectionOption[] = useMemo(
    () =>
      pack.blueprint.sections.map((s) => {
        const cfg = runConfigFor(mode, s);
        const pool = pack.questions.filter(
          (q) =>
            q.modes.includes(cfg.eligibility) &&
            sectionIdOfDomain(pack.domains, q.domainId) === s.id &&
            cfg.poolFilter(q),
        );
        return {
          id: s.id,
          name: s.name,
          available: Math.min(cfg.count, pool.length),
          perQuestionSec: cfg.perQuestionSec,
        };
      }),
    [pack, mode],
  );

  const domainName = useCallback((id: string) => pack.domains.find((d) => d.id === id)?.name ?? id, [pack]);

  const finish = useCallback(
    (timedOut: boolean) => {
      let correct = 0;
      let answered = 0;
      const perDomain = new Map<string, { total: number; correct: number }>();
      let mastery = repo.load(pack.examId).mastery;

      for (const q of questions) {
        const resp = answers[q.id];
        const isRight = resp ? grade(q, resp) : false;
        if (resp) answered++;
        if (isRight) correct++;
        const d = perDomain.get(q.domainId) ?? { total: 0, correct: 0 };
        d.total++;
        if (isRight) d.correct++;
        perDomain.set(q.domainId, d);
        // Only fold ACTUAL attempts into long-term mastery — skipping shouldn't
        // punish the learning model the way it punishes the exam score.
        if (resp) {
          mastery = applyResponse(mastery, {
            domainId: q.domainId,
            skillIds: q.skillIds,
            trapIds: q.trapIds,
            correct: isRight,
          });
        }
      }

      const prev = repo.load(pack.examId);
      repo.save({
        examId: pack.examId,
        mastery,
        seenQuestionIds: Array.from(new Set([...prev.seenQuestionIds, ...questions.map((q) => q.id)])),
        updatedAt: Date.now(),
      });

      const cutPct = section?.cutScorePct ?? 0.7;
      const scorePct = questions.length ? correct / questions.length : 0;
      const domains: DomainResult[] = [...perDomain.entries()]
        .map(([domainId, d]) => {
          const weight = weightOf(pack, domainId);
          const accuracy = d.total ? d.correct / d.total : 0;
          return {
            domainId,
            name: domainName(domainId),
            total: d.total,
            correct: d.correct,
            accuracy,
            priority: weight * (1 - accuracy),
          };
        })
        .sort((a, b) => b.priority - a.priority);

      setReport({
        sectionName: section?.name ?? "",
        total: questions.length,
        answered,
        correct,
        scorePct,
        cutPct,
        passed: scorePct >= cutPct,
        allottedSec,
        timeUsedSec: timedOut ? allottedSec : allottedSec - remainingSec,
        timedOut,
        domains,
      });
      setPhase("results");
    },
    [questions, answers, repo, pack, section, allottedSec, remainingSec, domainName],
  );

  // Keep a fresh finish for the interval to call on timeout.
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      const dl = deadlineRef.current;
      if (dl == null) return;
      const rem = Math.max(0, Math.round((dl - Date.now()) / 1000));
      setRemainingSec(rem);
      if (rem <= 0) finishRef.current(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(
    (sectionId: string) => {
      const s = pack.blueprint.sections.find((x) => x.id === sectionId);
      if (!s) return;
      const cfg = runConfigFor(mode, s);
      const set = selectSectionSet({
        section: s,
        domains: pack.domains,
        questions: pack.questions.filter(cfg.poolFilter),
        mode: cfg.eligibility,
        count: cfg.count,
        policy: cfg.policy,
      });
      const allotted = set.length * cfg.perQuestionSec;
      setSection(s);
      setQuestions(set);
      setAnswers({});
      setNumericRaw({});
      setIndex(0);
      setAllottedSec(allotted);
      setRemainingSec(allotted);
      deadlineRef.current = Date.now() + allotted * 1000;
      setPhase("running");
    },
    [pack, mode],
  );

  const setSingle = useCallback((qid: string, optionId: string) => {
    setAnswers((a) => ({ ...a, [qid]: { kind: "single", optionId } }));
  }, []);

  const setNumeric = useCallback((qid: string, raw: string, value: number | null) => {
    setNumericRaw((r) => ({ ...r, [qid]: raw }));
    setAnswers((a) => {
      const next = { ...a };
      if (value == null) delete next[qid];
      else next[qid] = { kind: "numeric", value };
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i < questions.length - 1 ? i + 1 : i));
  }, [questions.length]);
  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), []);

  const restart = useCallback(() => {
    setPhase("config");
    setReport(null);
    setSection(null);
    setQuestions([]);
    deadlineRef.current = null;
  }, []);

  return {
    pack,
    phase,
    section,
    sectionOptions,
    questions,
    current: questions[index] ?? null,
    index,
    total: questions.length,
    isLast: index === questions.length - 1,
    remainingSec,
    allottedSec,
    answers,
    numericRaw,
    report,
    domainName,
    start,
    setSingle,
    setNumeric,
    goNext,
    goPrev,
    finish,
    restart,
  };
}

function weightOf(pack: ReturnType<typeof loadPackOnce>["pack"], domainId: string): number {
  for (const s of pack.blueprint.sections) {
    const w = s.domainWeights.find((x) => x.domainId === domainId);
    if (w) return w.officialExamWeight;
  }
  return 0;
}
