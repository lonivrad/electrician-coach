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
  EMT: {
    "1/2": 0.304,
    "3/4": 0.533,
    "1": 0.864,
    "1-1/4": 1.496,
    "1-1/2": 2.036,
    "2": 3.356,
  },
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
