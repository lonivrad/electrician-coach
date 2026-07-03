# Electrician Coach

Mobile-first adaptive diagnostic tutor for licensing exams. An **exam-agnostic
engine** drives **pluggable content packs**; the first pack is the Washington
**01 General Journeyman** electrician exam. Goal: make the real exam feel easy.

> Phase 1 (this build): Baseline Diagnostic + weighted weakness map. Board
> Simulator and Overtraining modes are Phase 2.

## Run

```bash
npm install
npm run dev            # http://localhost:5173  (open on your phone via --host)
npm test              # engine + pack unit tests
npm run validate:pack # CI gate: invariants + engine/content decoupling
npm run build         # typecheck + production bundle
```

## Architecture

Two independently-versioned halves joined by one contract
(`engine/contracts/contentPack.ts`):

- **`engine/`** — knows nothing about electricians, the NEC, or WA law. Sessions,
  timing, the shrinkage Mastery estimator, the weighted scoring model, item
  selection, mode policies. **No domain enums.** Adding a future exam requires
  zero engine changes (enforced by `validate:pack`).
- **`content-packs/wa-electrician-01/`** — the exam as data: `pack.yaml`
  (edition), `blueprint.yaml`, `domains.yaml`, `traps.yaml`, `questions/**`.

```
engine/            adaptive/ (mastery, itemSelection) · scoring/ · modes/ · contracts/
content-packs/     wa-electrician-01/{pack,blueprint,domains,traps}.yaml + questions/
src/               data/ (packLoader, progressRepo) · state/ (useDiagnostic) · ui/
scripts/           validate-pack.ts · smoke-diagnostic.ts
tests/             engine/ · packs/
```

## Locked design decisions

- **Exam:** WA 01 General Journeyman — NEC & Theory (60 q / 3 h) + WA Laws &
  Rules (17 q / 1 h), open book, PSI, computer-based.
- **Passing:** **70% per section, independently.** A strong section never masks
  a failing one.
- **Edition:** 2020 NEC (confirmed by project owner), stored as a config field.
  Questions stay `draft` until per-item SME review + WAC amendment reconciliation
  (validator gates `live` promotion).
- **Weighted learning model (not raw %):**
  - `PracticePriority(d) = OfficialExamWeight(d) × (1 − Mastery(d))`
  - `ExpectedSectionScore(s) = Σ weight·Mastery / totalQuestions`
  - A low-frequency topic can't jump the study queue on one miss.
- **Mastery is live-only** — a Beta shrinkage estimate starting from a neutral
  prior. Nothing is seeded from the candidate's past exam report.
- **WA Laws weighting is provisional** — split across licensing / permits /
  inspections / admin-rules / enforcement, **each individually flagged
  `NEEDS_VERIFICATION`**, and editable in one place: `blueprint.yaml`.

## Content status

All seed questions are `status: draft`, authored to 2020 NEC values pending
per-item SME review. They are study drafts, not official exam items.
