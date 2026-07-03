// =============================================================================
// src/data/progressRepo.ts — persistence behind a swappable interface.
//
// Phase 1: single-user, localStorage. The interface is deliberately minimal so
// Phase 3 can drop in a Supabase-backed implementation without touching the UI
// or engine. Mastery is persisted here; it is NEVER seeded from any prior exam
// report — it accrues from live in-app answers only.
// =============================================================================

import { emptyMastery, type MasteryState } from "@engine/index.ts";

export interface StoredProgress {
  examId: string;
  mastery: MasteryState;
  /** Question ids the user has already answered (avoid immediate repeats). */
  seenQuestionIds: string[];
  updatedAt: number;
}

export interface ProgressRepo {
  load(examId: string): StoredProgress;
  save(p: StoredProgress): void;
  reset(examId: string): StoredProgress;
}

const PREFIX = "ec:";
const KEY = (examId: string) => `${PREFIX}progress:${examId}`;

export function freshProgress(examId: string): StoredProgress {
  return { examId, mastery: emptyMastery(), seenQuestionIds: [], updatedAt: 0 };
}

/** True only if the object looks like a real MasteryState (guards corrupt data). */
function isMasteryShaped(m: unknown): m is MasteryState {
  if (typeof m !== "object" || m === null) return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.byDomain === "object" &&
    o.byDomain !== null &&
    typeof o.bySkill === "object" &&
    o.bySkill !== null &&
    typeof o.trapAccuracy === "object" &&
    o.trapAccuracy !== null
  );
}

/**
 * Write guard: localStorage.setItem throws on a full quota or in Safari Private
 * Mode. A non-technical user must never see that crash — the session keeps
 * working in memory; we just lose durability. Returns whether the write stuck.
 */
function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn("Progress could not be saved (storage full or unavailable).", e);
    return false;
  }
}

/** Recovery hook for the error boundary: wipe our keys and swallow any failure. */
export function clearAllProgress(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch (e) {
    console.warn("Could not clear saved data.", e);
  }
}

export function createLocalProgressRepo(): ProgressRepo {
  return {
    load(examId) {
      try {
        const raw = localStorage.getItem(KEY(examId));
        if (!raw) return freshProgress(examId);
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return freshProgress(examId);
        const o = parsed as Partial<StoredProgress>;
        // Corrupt/partial data must never crash the engine downstream: fall back
        // to a fresh, well-shaped record rather than trusting bad fields.
        return {
          examId,
          mastery: isMasteryShaped(o.mastery) ? o.mastery : emptyMastery(),
          seenQuestionIds: Array.isArray(o.seenQuestionIds) ? o.seenQuestionIds : [],
          updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : 0,
        };
      } catch {
        return freshProgress(examId);
      }
    },
    save(p) {
      safeSet(KEY(p.examId), JSON.stringify(p));
    },
    reset(examId) {
      const fresh = freshProgress(examId);
      safeSet(KEY(examId), JSON.stringify(fresh));
      return fresh;
    },
  };
}
