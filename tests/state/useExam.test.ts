// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExam } from "../../src/state/useExam.ts";
import { createLocalProgressRepo, type AttemptRecord } from "../../src/data/progressRepo.ts";

const EXAM_ID = "wa-electrician-01";
type Hook = { current: ReturnType<typeof useExam> };

// Set the answer for every question in the current run to correct/incorrect.
function fillAnswers(result: Hook, correct: boolean, limit = Infinity) {
  const qs = result.current.questions.slice(0, limit === Infinity ? undefined : limit);
  act(() => {
    for (const q of qs) {
      if (q.type === "numeric" && q.answer.kind === "numeric") {
        const v = correct ? q.answer.value : q.answer.value + 1000;
        result.current.setNumeric(q.id, String(v), v);
      } else if (q.options && q.options.length) {
        const pick = correct
          ? q.options.find((o) => o.isCorrect)
          : q.options.find((o) => !o.isCorrect);
        if (pick) result.current.setSingle(q.id, pick.id);
      }
    }
  });
}

const repo = () => createLocalProgressRepo();

describe("useExam", () => {
  beforeEach(() => {
    localStorage.clear();
    // Fake only the interval so no real timers tick between tests; Date stays real.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts in config with both sections available", () => {
    const { result } = renderHook(() => useExam("board"));
    expect(result.current.phase).toBe("config");
    expect(result.current.questions).toHaveLength(0);
    expect(result.current.total).toBe(0);
    expect(result.current.current).toBeNull();
    const ids = result.current.sectionOptions.map((s) => s.id).sort();
    expect(ids).toEqual(["nec-theory", "wa-laws"]);
    for (const s of result.current.sectionOptions) expect(s.available).toBeGreaterThan(0);
  });

  it("start() draws a blueprint-sized run and wires the section + clock", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    expect(result.current.phase).toBe("running");
    expect(result.current.section?.id).toBe("nec-theory");
    expect(result.current.questions).toHaveLength(60); // section.totalQuestions
    expect(result.current.index).toBe(0);
    expect(result.current.current).toBe(result.current.questions[0]);
    expect(result.current.isLast).toBe(false);
    // allotted = 60 questions × 180s/question (10800s section / 60)
    expect(result.current.allottedSec).toBe(10800);
    expect(result.current.remainingSec).toBe(10800);
  });

  it("start() with an unknown section id is a no-op", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("does-not-exist"));
    expect(result.current.phase).toBe("config");
    expect(result.current.questions).toHaveLength(0);
  });

  it("records answers and navigates between questions", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const first = result.current.questions[0];

    act(() => {
      if (first.type === "numeric") result.current.setNumeric(first.id, "12", 12);
      else result.current.setSingle(first.id, first.options![0].id);
    });
    expect(result.current.answers[first.id]).toBeDefined();

    act(() => result.current.goNext());
    expect(result.current.index).toBe(1);
    act(() => result.current.goPrev());
    expect(result.current.index).toBe(0);
    // goPrev at the start is clamped
    act(() => result.current.goPrev());
    expect(result.current.index).toBe(0);
  });

  it("all-correct → 100%, passes, and writes an attempt + mastery + seen ids", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const drawnIds = result.current.questions.map((q) => q.id);
    fillAnswers(result, true);
    act(() => result.current.finish(false));

    const r = result.current.report!;
    expect(result.current.phase).toBe("results");
    expect(r.total).toBe(60);
    expect(r.answered).toBe(60);
    expect(r.correct).toBe(60);
    expect(r.scorePct).toBe(1);
    expect(r.cutPct).toBe(0.7);
    expect(r.passed).toBe(true);
    expect(r.reviewItems).toHaveLength(60);
    expect(r.reviewItems.every((i) => i.correct)).toBe(true);

    // Persistence side effects.
    const stored = repo().load(EXAM_ID);
    expect(stored.attempts).toHaveLength(1);
    expect(stored.attempts[0]).toMatchObject({ kind: "board", section: "NEC & Theory", correct: 60 });
    expect(stored.missedQuestionIds).toHaveLength(0);
    expect(drawnIds.every((id) => stored.seenQuestionIds.includes(id))).toBe(true);
    expect(Object.keys(stored.mastery.byDomain).length).toBeGreaterThan(0);
  });

  it("all-wrong → 0%, fails, and every answered id lands in the missed set", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const drawnIds = result.current.questions.map((q) => q.id);
    fillAnswers(result, false);
    act(() => result.current.finish(false));

    const r = result.current.report!;
    expect(r.scorePct).toBe(0);
    expect(r.passed).toBe(false);
    const stored = repo().load(EXAM_ID);
    expect([...stored.missedQuestionIds].sort()).toEqual([...drawnIds].sort());
    expect(result.current.missedCount).toBe(60);
  });

  it("flagging is captured at the end and never changes the score", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const [q0, q1] = result.current.questions;
    act(() => {
      result.current.toggleFlag(q0.id);
      result.current.toggleFlag(q1.id);
    });
    fillAnswers(result, true);
    act(() => result.current.finish(false));

    const r = result.current.report!;
    const flagged = r.reviewItems.filter((i) => i.flagged).map((i) => i.question.id).sort();
    expect(flagged).toEqual([q0.id, q1.id].sort());
    expect(r.passed).toBe(true); // flag didn't affect scoring
    expect(r.scorePct).toBe(1);
  });

  it("mastery is live-only: only attempted questions fold in", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    fillAnswers(result, true, 5); // answer 5, leave 55 blank
    act(() => result.current.finish(false));

    expect(result.current.report!.answered).toBe(5);
    const mastery = repo().load(EXAM_ID).mastery;
    const totalSeen = Object.values(mastery.byDomain).reduce((n, est) => n + est.seen, 0);
    expect(totalSeen).toBe(5); // exactly the 5 attempted, not the 55 blanks
  });

  it("the missed set self-maintains across runs (wrong adds, right removes, blank leaves)", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const [q0, q1] = result.current.questions;
    // q0 wrong, q1 right, everything else blank.
    act(() => {
      const w = q0.type === "numeric" ? undefined : q0.options!.find((o) => !o.isCorrect);
      if (q0.type === "numeric" && q0.answer.kind === "numeric")
        result.current.setNumeric(q0.id, "-999", -999);
      else if (w) result.current.setSingle(q0.id, w.id);
      if (q1.type === "numeric" && q1.answer.kind === "numeric")
        result.current.setNumeric(q1.id, String(q1.answer.value), q1.answer.value);
      else result.current.setSingle(q1.id, q1.options!.find((o) => o.isCorrect)!.id);
    });
    act(() => result.current.finish(false));
    // Only q0 (wrong) is missed; q1 (right) and the blanks are not.
    expect(repo().load(EXAM_ID).missedQuestionIds).toEqual([q0.id]);

    // Retry that missed question and get it right → it leaves the set.
    act(() => result.current.startRetry());
    expect(result.current.questions.map((q) => q.id)).toEqual([q0.id]);
    fillAnswers(result, true);
    act(() => result.current.finish(false));
    expect(repo().load(EXAM_ID).missedQuestionIds).toHaveLength(0);
  });

  it("startRetry with no missed questions is a no-op", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.startRetry());
    expect(result.current.phase).toBe("config");
    expect(result.current.questions).toHaveLength(0);
  });

  it("keeps only the most recent 50 attempts", () => {
    // Seed 50 old attempts, then finish one run → oldest drops, newest kept.
    const old: AttemptRecord[] = Array.from({ length: 50 }, (_, i) => ({
      at: i,
      kind: "board",
      section: "NEC & Theory",
      correct: 0,
      total: 60,
      scorePct: 0,
    }));
    const r0 = repo();
    r0.save({ ...r0.load(EXAM_ID), attempts: old });

    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    fillAnswers(result, true);
    act(() => result.current.finish(false));

    const stored = repo().load(EXAM_ID);
    expect(stored.attempts).toHaveLength(50);
    expect(stored.attempts[49].correct).toBe(60); // newest run at the end
    expect(stored.attempts[0].at).toBe(1); // the at:0 record was dropped
  });

  it("counts down and auto-submits a timed-out run when the clock expires", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    const allotted = result.current.allottedSec;
    expect(result.current.remainingSec).toBe(allotted);

    // Advance the wall clock 5s and let one tick run.
    (Date.now as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1_000_000 + 5_000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSec).toBe(allotted - 5);

    // Jump past the deadline → next tick auto-submits.
    (Date.now as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1_000_000 + allotted * 1000 + 2000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.phase).toBe("results");
    expect(result.current.report?.timedOut).toBe(true);
    expect(result.current.report?.answered).toBe(0); // nothing answered before expiry
  });

  it("restart() returns to config and clears the run", () => {
    const { result } = renderHook(() => useExam("board"));
    act(() => result.current.start("nec-theory"));
    fillAnswers(result, true);
    act(() => result.current.finish(false));
    expect(result.current.phase).toBe("results");

    act(() => result.current.restart());
    expect(result.current.phase).toBe("config");
    expect(result.current.report).toBeNull();
    expect(result.current.questions).toHaveLength(0);
  });

  it("Hard Mode draws a smaller, capped subset run", () => {
    const { result } = renderHook(() => useExam("overtrain"));
    act(() => result.current.start("nec-theory"));
    expect(result.current.phase).toBe("running");
    // Overtraining caps at 30 items.
    expect(result.current.questions.length).toBeGreaterThan(0);
    expect(result.current.questions.length).toBeLessThanOrEqual(30);
  });
});
