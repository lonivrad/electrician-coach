// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDiagnostic } from "../../src/state/useDiagnostic.ts";
import { createLocalProgressRepo } from "../../src/data/progressRepo.ts";
import { sectionIdOfDomain, type Question, type Response } from "../../engine/index.ts";

const EXAM_ID = "wa-electrician-01";

function correctResponse(q: Question): Response {
  if (q.type === "numeric" && q.answer.kind === "numeric") {
    return { kind: "numeric", value: q.answer.value };
  }
  return { kind: "single", optionId: q.options!.find((o) => o.isCorrect)!.id };
}

describe("useDiagnostic", () => {
  beforeEach(() => localStorage.clear());

  it("starts in intro with a 30-item budget", () => {
    const { result } = renderHook(() => useDiagnostic());
    expect(result.current.phase).toBe("intro");
    expect(result.current.current).toBeNull();
    expect(result.current.answeredThisRun).toBe(0);
    expect(result.current.canReview).toBe(false);
    expect(result.current.plannedItems).toBe(30);
  });

  it("start() serves a first NEC question", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    expect(result.current.phase).toBe("question");
    expect(result.current.current).not.toBeNull();
    const secId = sectionIdOfDomain(result.current.pack.domains, result.current.current!.domainId);
    expect(secId).toBe("nec-theory"); // NEC-first scheduler
    expect(result.current.currentSection?.id).toBe("nec-theory");
  });

  it("submit() grades, advances to explanation, folds mastery, and persists", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    const q = result.current.current!;
    act(() => result.current.submit(correctResponse(q)));

    expect(result.current.phase).toBe("explanation");
    expect(result.current.answeredThisRun).toBe(1);
    expect(result.current.canReview).toBe(true);
    expect(result.current.explanationItem?.correct).toBe(true);
    // liveMastery reflects the answered domain immediately.
    expect(result.current.liveMastery.byDomain[q.domainId]?.seen).toBe(1);
    // Persisted to storage; a diagnostic isn't a scored run, so no attempt is logged.
    const stored = createLocalProgressRepo().load(EXAM_ID);
    expect(stored.seenQuestionIds).toContain(q.id);
    expect(stored.mastery.byDomain[q.domainId]?.seen).toBe(1);
    expect(stored.attempts).toHaveLength(0);
  });

  it("runs a full diagnostic, weighting ~85% to NEC, and ends in results", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    let nec = 0;
    let total = 0;
    for (let i = 0; i < 40 && result.current.phase === "question"; i++) {
      const q = result.current.current!;
      if (sectionIdOfDomain(result.current.pack.domains, q.domainId) === "nec-theory") nec++;
      total++;
      act(() => result.current.submit(correctResponse(q)));
      act(() => result.current.onContinue());
    }
    expect(result.current.phase).toBe("results");
    expect(total).toBeGreaterThanOrEqual(20);
    expect(total).toBeLessThanOrEqual(30);
    expect(nec / total).toBeGreaterThanOrEqual(0.75); // NEC emphasis (~85% target)
    // liveMastery has evidence across multiple domains for the weakness map.
    expect(Object.keys(result.current.liveMastery.byDomain).length).toBeGreaterThan(1);
  });

  it("review navigation steps back through answered items read-only", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    for (let i = 0; i < 2; i++) {
      const q = result.current.current!;
      act(() => result.current.submit(correctResponse(q)));
      if (i === 0) act(() => result.current.onContinue());
    }
    // On the explanation of the 2nd answer.
    expect(result.current.explanationPosition).toEqual({ index: 1, total: 2 });
    expect(result.current.canPreviousExplanation).toBe(true);
    act(() => result.current.onPreviousQuestion());
    expect(result.current.explanationPosition?.index).toBe(0);
    expect(result.current.canPreviousExplanation).toBe(false);
  });

  it("goHome() returns to intro but preserves progress", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    const q = result.current.current!;
    act(() => result.current.submit(correctResponse(q)));
    act(() => result.current.goHome());
    expect(result.current.phase).toBe("intro");
    expect(result.current.progress.mastery.byDomain[q.domainId]?.seen).toBe(1); // preserved
  });

  it("resetAll() erases mastery + history and returns to intro", () => {
    const { result } = renderHook(() => useDiagnostic());
    act(() => result.current.start());
    act(() => result.current.submit(correctResponse(result.current.current!)));
    act(() => result.current.resetAll());

    expect(result.current.phase).toBe("intro");
    expect(result.current.answeredThisRun).toBe(0);
    expect(result.current.canReview).toBe(false);
    expect(result.current.current).toBeNull();
    expect(Object.keys(result.current.progress.mastery.byDomain)).toHaveLength(0);
    // Storage cleared too.
    const stored = createLocalProgressRepo().load(EXAM_ID);
    expect(Object.keys(stored.mastery.byDomain)).toHaveLength(0);
    expect(stored.seenQuestionIds).toHaveLength(0);
  });
});
