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

const KEY = (examId: string) => `ec:progress:${examId}`;

export function freshProgress(examId: string): StoredProgress {
  return { examId, mastery: emptyMastery(), seenQuestionIds: [], updatedAt: 0 };
}

export function createLocalProgressRepo(): ProgressRepo {
  return {
    load(examId) {
      try {
        const raw = localStorage.getItem(KEY(examId));
        if (!raw) return freshProgress(examId);
        const parsed = JSON.parse(raw) as StoredProgress;
        // Defensive: ensure shape is intact across version changes.
        return {
          examId,
          mastery: parsed.mastery ?? emptyMastery(),
          seenQuestionIds: parsed.seenQuestionIds ?? [],
          updatedAt: parsed.updatedAt ?? 0,
        };
      } catch {
        return freshProgress(examId);
      }
    },
    save(p) {
      localStorage.setItem(KEY(p.examId), JSON.stringify(p));
    },
    reset(examId) {
      const fresh = freshProgress(examId);
      localStorage.setItem(KEY(examId), JSON.stringify(fresh));
      return fresh;
    },
  };
}
