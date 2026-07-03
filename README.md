# Electrician Coach

A mobile-first study app for the **Washington 01 General Journeyman** electrician
exam. It finds your weak spots, drills them, and lets you take realistic timed
practice exams — so the real test feels easier.

---

## For the person studying — how to use it on your phone

The app runs on a computer and you open it on your phone over the **same Wi‑Fi**.
No login, no account, no internet needed after it's running. Your progress saves
on your phone automatically.

1. On a computer that's on the **same Wi‑Fi** as your phone, open the project
   folder in a terminal.
2. **First time only**, install it:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run dev -- --host
   ```
4. It prints two web addresses. Find the **Network** one — it looks like:
   ```
   ➜  Network: http://10.0.0.124:5173/
   ```
5. On your **phone** (same Wi‑Fi), open Safari or Chrome and type that **Network**
   address. The app opens.
6. _(Optional, iPhone)_ Tap the **Share** button → **Add to Home Screen** to get a
   tappable app icon.

> The computer needs to stay on and running `npm run dev` while you use the app on
> your phone. To have it available anytime without a computer, it can later be put
> on a free web host (see the developer notes below) — that's an optional next step.

### The three practice modes

- **Find My Weak Spots** — a relaxed, untimed quiz that shows which topics to
  focus on. Start here.
- **Practice Exam** — a full, timed run of one exam part (NEC & Theory or
  Washington Laws & Rules) at real exam pace. No answers until the end, then a
  score with pass/fail at 70%.
- **Hard Mode** — tougher questions and a tighter clock than the real exam, to
  build a cushion.

Each timed mode starts by asking which part you want: **NEC & Theory** or
**Washington Laws & Rules**. They are two separate real exams, so you practice
them separately.

---

## Important: content status (please read)

These are **study drafts to practice with — not official exam questions.**

- **Washington Laws & Rules questions are still `draft`, pending verification.**
  They're cited to specific RCW 19.28 / WAC 296‑46B sections, but the legal
  specifics (supervision ratios, continuing-education hours, penalty amounts,
  scope wording) have **not yet been confirmed against the current code**. Use
  them to practice the concepts, but verify details against the official RCW/WAC
  and the PSI candidate bulletin.
- **NEC & Theory questions** are authored to the **2020 NEC** and are also `draft`,
  pending a subject-matter review.
- Always defer to the official code book and PSI bulletin over this app.

---

## For developers

### Setup & scripts

```bash
npm install
npm run dev            # dev server (add -- --host to open on a phone)
npm run build          # typecheck + production bundle (outputs to dist/)
npm run preview        # serve the production build locally
npm test               # engine + pack + data unit tests (50)
npm run test:coverage  # tests with coverage report
npm run lint           # ESLint (strict)
npm run validate:pack  # content-pack invariants + engine/content decoupling
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, validate:pack, test, and
build on pushes to `main` and all PRs.

### Architecture

An **exam-agnostic engine** drives a **pluggable content pack**, joined by one
contract (`engine/contracts/contentPack.ts`). Adding a future exam is a new pack
folder with **zero engine changes** — enforced by `validate:pack`.

```
engine/          adaptive/ (mastery, itemSelection) · scoring/ · modes/ · contracts/ · grade
content-packs/   wa-electrician-01/{pack,blueprint,domains,traps}.yaml + questions/**
src/             data/ (packLoader, progressRepo) · state/ (useDiagnostic, useExam) · ui/
scripts/         validate-pack.ts · smoke-diagnostic.ts
tests/           engine/ · packs/ · data/
```

### Design decisions

- **Passing:** 70% **per section, independently** — a strong section never masks a
  failing one.
- **Edition:** 2020 NEC, a config field on the pack; questions stay `draft` until
  per-item review (validator gates `live` promotion).
- **Weighted learning model (not raw %):**
  `PracticePriority = OfficialExamWeight × (1 − Mastery)`;
  a low-frequency topic can't jump the study queue on one miss.
- **Mastery is live-only** — a Beta shrinkage estimate from a neutral prior;
  nothing is seeded from a past exam report. Only _attempted_ questions update it.
- **Provisional data is flagged** — WA-law blueprint weights and unverified
  questions carry `NEEDS_VERIFICATION` / `needsReview`, surfaced by the validator.

### Deploying for anytime phone access (optional)

The app is a static, self-contained bundle with no backend (progress lives in the
phone's local storage). `npm run build` produces `dist/`, which can be dropped on
any free static host (e.g. Netlify, Vercel, GitHub Pages) to get a permanent URL
the studying user can open anytime — no computer required.
