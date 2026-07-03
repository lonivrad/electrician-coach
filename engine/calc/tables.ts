// =============================================================================
// engine/calc/tables.ts — 2020 NEC table VALUES encoded as data.
//
// These back the answer-recompute guardrail: every numeric question's answer is
// re-derived from these tables + the question's stated inputs, so wrong math
// (and wrong table transcription) fails the build. The VALUES themselves are
// authored from the 2020 NEC and should still get an SME check before `live`;
// the guardrail catches arithmetic/transcription errors, not a mis-keyed cell.
// =============================================================================

/** Table 314.16(B) — free-space volume allowance per conductor size (in³). */
export const BOX_VOLUME_ALLOWANCE: Record<string, number> = {
  "18": 1.5,
  "16": 1.75,
  "14": 2.0,
  "12": 2.25,
  "10": 2.5,
  "8": 3.0,
  "6": 5.0,
};

/** Table 310.16 — copper allowable ampacities by size and temp column (°C). */
export const AMPACITY_CU: Record<string, { 60: number; 75: number; 90: number }> = {
  "14": { 60: 15, 75: 20, 90: 25 },
  "12": { 60: 20, 75: 25, 90: 30 },
  "10": { 60: 30, 75: 35, 90: 40 },
  "8": { 60: 40, 75: 50, 90: 55 },
  "6": { 60: 55, 75: 65, 90: 75 },
  "4": { 60: 70, 75: 85, 90: 95 },
  "3": { 60: 85, 75: 100, 90: 115 },
  "2": { 60: 95, 75: 115, 90: 130 },
  "1": { 60: 110, 75: 130, 90: 145 },
  "1/0": { 60: 125, 75: 150, 90: 170 },
  "2/0": { 60: 145, 75: 175, 90: 195 },
  "3/0": { 60: 165, 75: 200, 90: 225 },
  "4/0": { 60: 195, 75: 230, 90: 260 },
};

/** Table 430.250 — three-phase motor full-load current (A), by HP and volts. */
export const MOTOR_FLC_3PH: Record<string, { 230: number; 460: number }> = {
  "0.5": { 230: 2.2, 460: 1.1 },
  "0.75": { 230: 3.2, 460: 1.6 },
  "1": { 230: 4.2, 460: 2.1 },
  "1.5": { 230: 6.0, 460: 3.0 },
  "2": { 230: 6.8, 460: 3.4 },
  "3": { 230: 9.6, 460: 4.8 },
  "5": { 230: 15.2, 460: 7.6 },
  "7.5": { 230: 22, 460: 11 },
  "10": { 230: 28, 460: 14 },
  "15": { 230: 42, 460: 21 },
  "20": { 230: 54, 460: 27 },
  "25": { 230: 68, 460: 34 },
  "30": { 230: 80, 460: 40 },
  "40": { 230: 104, 460: 52 },
  "50": { 230: 130, 460: 65 },
};

/** Table 430.248 — single-phase motor full-load current (A), by HP and volts. */
export const MOTOR_FLC_1PH: Record<string, { 115: number; 230: number }> = {
  "0.5": { 115: 9.8, 230: 4.9 },
  "0.75": { 115: 13.8, 230: 6.9 },
  "1": { 115: 16, 230: 8 },
  "1.5": { 115: 20, 230: 10 },
  "2": { 115: 24, 230: 12 },
  "3": { 115: 34, 230: 17 },
  "5": { 115: 56, 230: 28 },
};

/** Chapter 9, Table 5 — THHN conductor cross-sectional area (in²). */
export const THHN_AREA: Record<string, number> = {
  "14": 0.0097,
  "12": 0.0133,
  "10": 0.0211,
  "8": 0.0366,
  "6": 0.0507,
  "4": 0.0824,
  "3": 0.0973,
  "2": 0.1158,
  "1": 0.1562,
  "1/0": 0.1855,
  "2/0": 0.2223,
  "3/0": 0.2679,
  "4/0": 0.3237,
};

/** Chapter 9, Table 4 — total internal cross-sectional area of raceway (in²). */
export const RACEWAY_AREA: Record<string, Record<string, number>> = {
  EMT: { "1/2": 0.304, "3/4": 0.533, "1": 0.864, "1-1/4": 1.496, "1-1/2": 2.036, "2": 3.356 },
  RMC: { "1/2": 0.314, "3/4": 0.549, "1": 0.887, "1-1/4": 1.526, "1-1/2": 2.071, "2": 3.408 },
  IMC: { "1/2": 0.342, "3/4": 0.586, "1": 0.959, "1-1/4": 1.647, "1-1/2": 2.225, "2": 3.63 },
  // Rigid PVC — Schedule 40 and Schedule 80.
  PVC40: { "1/2": 0.285, "3/4": 0.508, "1": 0.832, "1-1/4": 1.453, "1-1/2": 1.986, "2": 3.291 },
  PVC80: { "1/2": 0.17, "3/4": 0.297, "1": 0.495, "1-1/4": 0.852, "1-1/2": 1.168, "2": 1.905 },
};

/** Chapter 9, Table 8 — conductor area in circular mils. */
export const CIRCULAR_MILS: Record<string, number> = {
  "14": 4110,
  "12": 6530,
  "10": 10380,
  "8": 16510,
  "6": 26240,
  "4": 41740,
  "3": 52620,
  "2": 66360,
  "1": 83690,
  "1/0": 105600,
  "2/0": 133100,
  "3/0": 167800,
  "4/0": 211600,
};

/** Table 220.55, Column C — demand (kW) for N household ranges ≤12 kW. */
export const RANGE_DEMAND_C: Record<number, number> = {
  1: 8,
  2: 11,
  3: 14,
  4: 17,
  5: 20,
  6: 21,
  7: 22,
  8: 23,
  9: 24,
  10: 25,
};

/** 240.6(A) — standard overcurrent device ampere ratings. */
export const STANDARD_OCPD = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450,
  500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000,
];

/** Table 310.16 — aluminum / copper-clad aluminum ampacities by size and column. */
export const AMPACITY_AL: Record<string, { 60: number; 75: number; 90: number }> = {
  "12": { 60: 15, 75: 20, 90: 25 },
  "10": { 60: 25, 75: 30, 90: 35 },
  "8": { 60: 35, 75: 40, 90: 45 },
  "6": { 60: 40, 75: 50, 90: 55 },
  "4": { 60: 55, 75: 65, 90: 75 },
  "3": { 60: 65, 75: 75, 90: 85 },
  "2": { 60: 75, 75: 90, 90: 100 },
  "1": { 60: 85, 75: 100, 90: 115 },
  "1/0": { 60: 100, 75: 120, 90: 135 },
  "2/0": { 60: 115, 75: 135, 90: 150 },
  "3/0": { 60: 130, 75: 155, 90: 175 },
  "4/0": { 60: 150, 75: 180, 90: 205 },
};

/**
 * Table 310.15(B)(1) — ambient-temperature correction factors (based on 30 °C).
 * Each row applies for ambient ≤ maxAmbientC (and above the previous row's max).
 * A null column means that conductor rating is not permitted at that ambient.
 */
export const TEMP_CORRECTION: {
  maxAmbientC: number;
  f60: number | null;
  f75: number | null;
  f90: number | null;
}[] = [
  { maxAmbientC: 10, f60: 1.29, f75: 1.2, f90: 1.15 },
  { maxAmbientC: 15, f60: 1.22, f75: 1.15, f90: 1.12 },
  { maxAmbientC: 20, f60: 1.15, f75: 1.11, f90: 1.08 },
  { maxAmbientC: 25, f60: 1.08, f75: 1.05, f90: 1.04 },
  { maxAmbientC: 30, f60: 1.0, f75: 1.0, f90: 1.0 },
  { maxAmbientC: 35, f60: 0.91, f75: 0.94, f90: 0.96 },
  { maxAmbientC: 40, f60: 0.82, f75: 0.88, f90: 0.91 },
  { maxAmbientC: 45, f60: 0.71, f75: 0.82, f90: 0.87 },
  { maxAmbientC: 50, f60: 0.58, f75: 0.75, f90: 0.82 },
  { maxAmbientC: 55, f60: 0.41, f75: 0.67, f90: 0.76 },
  { maxAmbientC: 60, f60: null, f75: 0.58, f90: 0.71 },
  { maxAmbientC: 65, f60: null, f75: 0.47, f90: 0.65 },
  { maxAmbientC: 70, f60: null, f75: 0.33, f90: 0.58 },
  { maxAmbientC: 75, f60: null, f75: null, f90: 0.5 },
  { maxAmbientC: 80, f60: null, f75: null, f90: 0.41 },
  { maxAmbientC: 85, f60: null, f75: null, f90: 0.29 },
];

/**
 * Table 310.15(C)(1) — adjustment factors for >3 current-carrying conductors
 * (2020 NEC). Each row applies for count ≤ maxCount.
 * NOTE: 2026 NEC changes the 7–9 factor to 0.65; we are on 2020 (0.70).
 */
export const CCC_ADJUSTMENT: { maxCount: number; factor: number }[] = [
  { maxCount: 3, factor: 1.0 },
  { maxCount: 6, factor: 0.8 },
  { maxCount: 9, factor: 0.7 },
  { maxCount: 20, factor: 0.5 },
  { maxCount: 30, factor: 0.45 },
  { maxCount: 40, factor: 0.4 },
  { maxCount: Infinity, factor: 0.35 },
];
