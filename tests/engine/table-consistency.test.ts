// Structural consistency checks on the encoded NEC tables. These catch
// transcription/mis-key errors WITHOUT any external lookup by asserting known
// relationships (monotonicity, and the "460V FLC = half of 230V" relationship
// that holds for the standard motor rows).
import { describe, it, expect } from "vitest";
import {
  AMPACITY_CU,
  BOX_VOLUME_ALLOWANCE,
  CIRCULAR_MILS,
  MOTOR_FLC_1PH,
  MOTOR_FLC_3PH,
  RACEWAY_AREA,
  RANGE_DEMAND_C,
  STANDARD_OCPD,
  THHN_AREA,
} from "../../engine/calc/tables.ts";

const AWG_ORDER = ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0"];

function strictlyIncreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) if (!(values[i] > values[i - 1])) return false;
  return true;
}

describe("ampacity table (310.16) consistency", () => {
  it("each size increases 60 < 75 < 90 °C", () => {
    for (const [size, row] of Object.entries(AMPACITY_CU)) {
      expect(row[60], `${size}`).toBeLessThan(row[75]);
      expect(row[75], `${size}`).toBeLessThan(row[90]);
    }
  });
  it("ampacity increases with conductor size in every column", () => {
    for (const col of [60, 75, 90] as const) {
      const seq = AWG_ORDER.map((s) => AMPACITY_CU[s][col]);
      expect(strictlyIncreasing(seq), `column ${col}`).toBe(true);
    }
  });
});

describe("conductor-property tables increase with size", () => {
  it("THHN area strictly increases 14 → 4/0", () =>
    expect(strictlyIncreasing(AWG_ORDER.map((s) => THHN_AREA[s]))).toBe(true));
  it("circular mils strictly increase 14 → 4/0", () =>
    expect(strictlyIncreasing(AWG_ORDER.map((s) => CIRCULAR_MILS[s]))).toBe(true));
});

describe("box allowance (314.16(B)) increases with size", () => {
  it("18 → 6 AWG strictly increases", () =>
    expect(
      strictlyIncreasing(["18", "16", "14", "12", "10", "8", "6"].map((s) => BOX_VOLUME_ALLOWANCE[s])),
    ).toBe(true));
});

describe("EMT raceway area (Ch.9 Table 4) increases with trade size", () => {
  it("1/2 → 2 in strictly increases", () =>
    expect(
      strictlyIncreasing(["1/2", "3/4", "1", "1-1/4", "1-1/2", "2"].map((s) => RACEWAY_AREA.EMT[s])),
    ).toBe(true));
});

describe("motor FLC tables (430.248/250) consistency", () => {
  it("3φ: 460V FLC is half of 230V (flags any deviating row)", () => {
    for (const [hp, row] of Object.entries(MOTOR_FLC_3PH)) {
      expect(Math.abs(row[460] * 2 - row[230]), `HP ${hp}`).toBeLessThanOrEqual(0.05);
    }
  });
  it("1φ: 230V FLC is half of 115V", () => {
    for (const [hp, row] of Object.entries(MOTOR_FLC_1PH)) {
      expect(Math.abs(row[230] * 2 - row[115]), `HP ${hp}`).toBeLessThanOrEqual(0.05);
    }
  });
  it("3φ 230V FLC increases with HP", () => {
    const order = ["0.5", "0.75", "1", "1.5", "2", "3", "5", "7.5", "10", "15", "20", "25", "30", "40", "50"];
    expect(strictlyIncreasing(order.map((h) => MOTOR_FLC_3PH[h][230]))).toBe(true);
  });
  it("1φ 115V FLC increases with HP", () => {
    const order = ["0.5", "0.75", "1", "1.5", "2", "3", "5"];
    expect(strictlyIncreasing(order.map((h) => MOTOR_FLC_1PH[h][115]))).toBe(true);
  });
});

describe("misc table sanity", () => {
  it("range demand (220.55 C) increases with count", () => {
    const seq = Object.keys(RANGE_DEMAND_C)
      .map(Number)
      .sort((a, b) => a - b)
      .map((n) => RANGE_DEMAND_C[n]);
    expect(strictlyIncreasing(seq)).toBe(true);
  });
  it("standard OCPD list is strictly ascending and positive", () => {
    expect(STANDARD_OCPD[0]).toBeGreaterThan(0);
    expect(strictlyIncreasing(STANDARD_OCPD)).toBe(true);
  });
});
