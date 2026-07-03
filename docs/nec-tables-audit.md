# NEC table-value audit — `engine/calc/tables.ts`

Verification of every value the answer-recompute guardrail depends on, against
authoritative public sources for the **2020 NEC**. The guardrail catches
arithmetic/transcription errors in questions; it cannot catch a mis-keyed table
cell — this audit closes that gap.

**Bottom line: every flagged value was confirmed. Zero corrections were needed.**
Automated consistency checks (`tests/engine/table-consistency.test.ts`) now guard
the relationships that catch a future mis-key without any lookup.

Date of verification: 2026-07. Values that were already high-confidence in the
first pass (standard/stable) are marked ✅ standard; values web-verified this
pass are marked ✅ verified with the source.

---

## Motor full-load current — Table 430.250 (3φ) and 430.248 (1φ)

**Every row confirmed exactly.** These were the highest mis-key risk.

- **430.250 (three-phase), 230 V & 460 V, HP 0.5–50:** every value matches the
  full table reproduction. 0.5→2.2/1.1, 0.75→3.2/1.6, 1→4.2/2.1, 1.5→6.0/3.0,
  2→6.8/3.4, 3→9.6/4.8, 5→15.2/7.6, 7.5→22/11, 10→28/14, 15→42/21, 20→54/27,
  25→68/34, 30→80/40, 40→104/52, 50→130/65. ✅ verified.
  Source: buildmyowncabin.com (Table 430.250; values unchanged 2014→2020),
  cross-checked with VoltageLab and a senvainc reprint.
- **430.248 (single-phase), 115 V & 230 V, HP 0.5–5:** 0.5→9.8/4.9, 0.75→13.8/6.9,
  1→16/8, 1.5→20/10, 2→24/12, 3→34/17, 5→56/28. ✅ verified.
  Source: electricalhelper.org and Elliott Electric Supply reference tables.
- **Consistency check added:** 460 V column = ½ of 230 V (3φ) and 230 V = ½ of
  115 V (1φ) for every row — passes, so no row is transcribed inconsistently.

Not encoded (add + audit if Phase 1 needs them): 200 V / 208 V / 575 V motor
columns; HP above 50.

## Conduit — Chapter 9, Table 4 (EMT total area, in²)

All six sizes confirmed exactly: 1/2→0.304, 3/4→0.533, 1→0.864, 1-1/4→1.496,
1-1/2→2.036, 2→3.356. ✅ verified. Source: conduit.site Chapter 9 Table 4 (EMT).
_(A secondary source showed 0.305 for 1/2″; the authoritative Table 4 value is
0.304, which is what we have.)_
Not encoded: RMC, IMC, PVC (Sch 40/80), ENT, FMC — different areas; add for
Phase 1 conduit variety.

## Wire — Chapter 9, Table 5 (THHN/THWN-2 area, in²)

Confirmed against sources: 14→0.0097, 12→0.0133, 10→0.0211, 8→0.0366, 6→0.0507,
4→0.0824, 2→0.1158, 1/0→0.1855, 2/0→0.2223, 4/0→0.3237. ✅ verified
(conduitfill-calculator.com wire-area table; conduit-fill-calculator.com Ch.9
guide; aggregated Table 5 reprints).
**Not echoed by an explicit source this pass — high confidence by consistency:**
3 AWG→0.0973, 1 AWG→0.1562, 3/0→0.2679. They sit monotonically between confirmed
neighbors (6→4→**3**→2→1/0 and 2/0→**3/0**→4/0), and the monotonic-increase check
passes. Give these a final glance if a Phase 1 question uses 3, 1, or 3/0 THHN.

## Ampacity — Table 310.16 (copper, 60/75/90 °C)

✅ standard (classic, stable values; renumbered from 310.15(B)(16) in 2020).
Consistency checks added: each size increases 60<75<90 °C, and ampacity increases
with conductor size in every column — both pass. Aluminum columns not encoded.

## Circular mils — Chapter 9, Table 8

✅ standard AWG areas (14→4,110 … 4/0→211,600). Monotonic check passes.

## Box fill — Table 314.16(B)

✅ standard (18→1.50 … 6→5.00 in³). Monotonic check passes.

## Standard OCPD — 240.6(A)

✅ standard main list 15…6000 A; strictly-ascending check passes.
Intentional omission: fuse-only additional ratings 1, 3, 6, 10, 601 A.

## Range demand — Table 220.55, Column C (1–10 ranges ≤12 kW)

✅ standard (1→8 … 10→25 kW). Monotonic check passes. Coverage limited to 1–10
ranges, ≤12 kW; the >12 kW footnote and Columns A/B are not implemented.

---

## Percentages embedded in `calculators.ts` (also verified)

- **220.42 standard demand tiers** — first 3,000 VA @100%, 3,001–120,000 @35%,
  remainder @25%. ✅ verified (EC&M / ECMag / expertce references).
- **220.82(B) optional method** — first 10,000 VA @100%, remainder @40%.
  ✅ verified.
- **450.3(B) transformer primary-only OCP** — 125% of primary FLC for ≥9 A,
  round **up** to next standard size (Note 1). ✅ verified (electrical-engineering-portal,
  fasttraxsystem, Mike Holt forum). **Not implemented:** the <9 A cases (167% for
  2–9 A, 300% below 2 A) — add before authoring transformer questions in that range.
- **Motor factors** — conductor 125% (430.22), overload 125% for SF ≥1.15
  (430.32(A)(1); the 115% case is not modeled), feeder 125% of largest (430.24),
  branch protection % passed per question (430.52). ✅ standard.
- **Continuous load 125%** (210.19/210.20/215) ✅; **√3** for 3φ ✅; voltage-drop
  **K = 12.9** Cu is an accepted estimate, passed per question.

**Not encoded at all** (supplied per-question today): Table 310.15(B)(1) ambient
temperature-correction factors and 310.15(C)(1) >3-conductor adjustment factors.
If Phase 1 derives these instead of stating them, encode + audit them first.

---

## Second pass (2026-07): added tables — aluminum, factors, extra raceways

All web-verified against authoritative 2020 NEC reproductions before encoding.

- **Aluminum ampacity — Table 310.16 (Al), 12 AWG–4/0:** ✅ verified (lugsdirect
  full table). 12→15/20/25 … 2→75/90/100 … 4/0→150/180/205. `AMPACITY_AL`;
  `ampacityDerating` now accepts `material: "al"`.
- **Ambient correction — Table 310.15(B)(1) (30 °C base):** ✅ verified
  (conduit.site full table). Rows 10–85 °C for 60/75/90 columns; "not permitted"
  cells encoded as null. `TEMP_CORRECTION` + `correctionFactor()`. Cross-check:
  `correctionFactor(46, 90) = 0.82` and `(38, 90) = 0.91` match the factors already
  stated in the ampacity questions.
- **>3-conductor adjustment — Table 310.15(C)(1) (2020):** ✅ verified (ecalpro,
  electricallicenserenewal). 4–6→0.80, 7–9→**0.70**, 10–20→0.50, 21–30→0.45,
  31–40→0.40, 41+→0.35. `CCC_ADJUSTMENT` + `adjustmentFactor()`. **Edition note:**
  2026 NEC changes 7–9 to 0.65 — we intentionally encode the **2020** value (0.70).
- **Extra raceways — Table 4 total areas:** ✅ verified.
  RMC 0.314/0.549/0.887/1.526/2.071/3.408 and IMC 0.342/0.586/0.959/1.647/2.225/3.630
  (conduit.site ?option=RMC/IMC); PVC Sch 40 0.285/0.508/0.832/1.453/1.986/3.291 and
  PVC Sch 80 0.170/0.297/0.495/0.852/1.168/1.905 (zing2).
  **Caught before encoding:** my first-draft mental PVC Sch 80 values were wrong
  (≈0.217/0.409/…); verification replaced them with the table values above — exactly
  the failure this pass exists to catch.

## Third pass (2026-07): grounding tables — 250.122 & 250.66

Encoded for calculator-backed EGC/GEC questions and web-verified.

- **Table 250.122 — copper EGC by OCPD rating:** ✅ verified (zing2). 15→14,
  20→12, 60→10, 100→8, 200→6, 300→4, 400→3, 500→2, 600→1, 800→1/0, 1000→2/0,
  1200→3/0, 1600→4/0, 2000→250 kcmil. `EGC_BY_OCPD` + `egcSize()` (returns the
  size for the smallest listed rating ≥ the OCPD, e.g. 30 A → the 60 A row → 10).
- **Table 250.66 — copper GEC by service-entrance conductor:** ✅ verified (zing2).
  ≤2 AWG→8, 1–1/0→6, 2/0–3/0→**4**, >3/0–350 kcmil→2, >350–600→1/0, >600–1100→2/0,
  > 1100→3/0. `GEC_BY_SERVICE` + `gecSize()`. Does not model the 6 AWG ground-rod
  > cap (250.66(A)).
  > **Caught a bad source:** one search result claimed 3/0 → 2 AWG; the authoritative
  > table (and our existing questions) is 3/0 → **4 AWG**. Verified against zing2's
  > full table.

These are conductor-size lookups (string answers), so the recompute guardrail was
extended: a single-choice question may carry a `recompute` naming a size calculator
(`egcSize`/`gecSize`), and the test asserts the keyed correct option matches the
calculator's size. Consistency checks: EGC size never shrinks as the OCPD rating
rises; GEC size never shrinks as the service conductor grows.

## Fourth pass (2026-07): overcurrent — 240.4(D) small-conductor rule

- **240.4(D) — maximum OCPD by small-conductor size:** ✅ verified (nassaunationalcable,
  ecmag, eepower/SparkShift). Copper 18→7, 16→10, 14→15, 12→20, 10→30; aluminum
  12→15, 10→25. `SMALL_CONDUCTOR_OCPD` + `smallConductorMaxOCPD()`. Consistency
  check: the Cu limit grows with size, and Al is always more restrictive than Cu
  at the same size.
- **Next-standard-size (240.6 / 240.4(B)):** `nextStandardSize()` wraps the already
  -verified `STANDARD_OCPD` list — no new data, just exposed as a calculator for
  next-size-up questions.

## Corrections made

None to previously-committed data — every value already in `tables.ts` matched an
authoritative source. (The PVC Sch 80 mis-remembering was caught during the second
pass, before it was committed.)

## Consistency guardrails added

`tests/engine/table-consistency.test.ts` (now 15 checks): ampacity column/size
monotonicity (copper **and aluminum**), THHN-area / circular-mil / box-allowance /
raceway-area monotonicity (**all raceway types**), motor-FLC half-relationship
(3φ & 1φ) and HP monotonicity, range-demand and OCPD ordering, **310.15(B)(1) 90 °C
column strictly decreasing with a 30 °C = 1.00 baseline, and 310.15(C)(1) factors
strictly decreasing**. Plus `tests/engine/calc-derivation.test.ts` for the aluminum
and factor-derivation paths. These fail the build on a future mis-key.

## Remaining before / during Phase 1 (data completeness, not corrections)

- ✅ Done: aluminum ampacity, extra raceways (RMC/IMC/PVC 40/80), temperature-
  correction and adjustment factor tables.
- Still open: transformer <9 A OCP cases (167% / 300%); the motor 115% overload
  case (SF <1.15); non-THHN conductor areas (XHHW/RHW) if a question needs them;
  200/208/575 V motor columns and HP >50.
