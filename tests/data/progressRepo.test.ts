// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { createLocalProgressRepo, clearAllProgress, freshProgress } from "../../src/data/progressRepo.ts";

const EXAM = "test-exam";
const KEY = `ec:progress:${EXAM}`;

beforeEach(() => localStorage.clear());

describe("progressRepo resilience", () => {
  it("returns fresh progress when nothing is stored", () => {
    const repo = createLocalProgressRepo();
    expect(repo.load(EXAM).mastery.byDomain).toEqual({});
  });

  it("round-trips a saved record", () => {
    const repo = createLocalProgressRepo();
    const p = freshProgress(EXAM);
    p.mastery.byDomain["d"] = { mastery: 0.7, seen: 3, correct: 2, variance: 0.01 };
    p.seenQuestionIds = ["q1"];
    repo.save(p);
    const loaded = repo.load(EXAM);
    expect(loaded.mastery.byDomain["d"].mastery).toBeCloseTo(0.7);
    expect(loaded.seenQuestionIds).toEqual(["q1"]);
  });

  it("falls back to fresh (no throw) on unparseable JSON", () => {
    localStorage.setItem(KEY, "{ this is not json");
    const repo = createLocalProgressRepo();
    expect(() => repo.load(EXAM)).not.toThrow();
    expect(repo.load(EXAM).mastery.byDomain).toEqual({});
  });

  it("falls back to fresh, well-shaped data on wrong-shaped saved data", () => {
    // Parseable JSON but every field is the wrong type — must not crash the engine.
    localStorage.setItem(
      KEY,
      JSON.stringify({ examId: EXAM, mastery: { nope: 1 }, seenQuestionIds: "bad", updatedAt: "x" }),
    );
    const repo = createLocalProgressRepo();
    const loaded = repo.load(EXAM);
    expect(loaded.mastery).toEqual({ byDomain: {}, bySkill: {}, trapAccuracy: {} });
    expect(loaded.seenQuestionIds).toEqual([]);
    expect(loaded.updatedAt).toBe(0);
  });

  it("does not throw when a write fails (quota full / private mode)", () => {
    const repo = createLocalProgressRepo();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => repo.save(freshProgress(EXAM))).not.toThrow();
    expect(() => repo.reset(EXAM)).not.toThrow();
    spy.mockRestore();
  });

  it("clearAllProgress removes only our keys", () => {
    localStorage.setItem("ec:progress:a", "1");
    localStorage.setItem("ec:progress:b", "2");
    localStorage.setItem("unrelated", "keep");
    clearAllProgress();
    expect(localStorage.getItem("ec:progress:a")).toBeNull();
    expect(localStorage.getItem("ec:progress:b")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
