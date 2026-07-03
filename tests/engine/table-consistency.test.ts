// Structural consistency checks on the encoded NEC tables. These catch
// transcription/mis-key errors WITHOUT any external lookup by asserting known
// relationships (monotonicity, and the "460V FLC = half of 230V" relationship
// that holds for the standard motor rows).
import { describe, it, expect } from "vitest";
import {
  AMPACITY_AL,
  AMPACITY_CU,
  BOX_VOLUME_ALLOWANCE,
  CCC_ADJUSTMENT,
  CIRCULAR_MILS,
  EGC_BY_OCPD,
  GEC_BY_SERVICE,
  SMALL_CONDUCTOR_OCPD,
  MOTOR_FLC_1PH,
  MOTOR_FLC_3PH,
  RACEWAY_AREA,
  RANGE_DEMAND_C,
  STANDARD_OCPD,
  TEMP_CORRECTION,
  THHN_AREA,
} from "../../engine/calc/tables.ts";

const AWG_ORDER = ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0"];

function strictlyIncreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) if (!(values[i] > values[i - 1])) return false;
  return true;
}

describe("ampacity tables (310.16) consistency", () => {
  const check = (
    table: Record<string, { 60: number; 75: number; 90: number }>,
    order: string[],
    name: string,
  ) => {
    for (const size of order) {
      const row = table[size];
      expect(row[60], `${name} ${size}`).toBeLessThan(row[75]);
      expect(row[75], `${name} ${size}`).toBeLessThan(row[90]);
    }
    for (const col of [60, 75, 90] as const) {
      expect(strictlyIncreasing(order.map((s) => table[s][col])), `${name} column ${col}`).toBe(true);
    }
  };
  it("copper: columns 60<75<90 and ampacity rises with size", () => check(AMPACITY_CU, AWG_ORDER, "Cu"));
  it("aluminum: columns 60<75<90 and ampacity rises with size", () =>
    check(
      AMPACITY_AL,
      AWG_ORDER.filter((s) => s !== "14"),
      "Al",
    ));
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

describe("raceway area (Ch.9 Table 4) increases with trade size", () => {
  it("every raceway type increases 1/2 → 2 in", () => {
    const sizes = ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2"];
    for (const [type, areas] of Object.entries(RACEWAY_AREA)) {
      expect(strictlyIncreasing(sizes.map((s) => areas[s])), type).toBe(true);
    }
  });
});

describe("temperature correction (Table 310.15(B)(1)) consistency", () => {
  it("90°C column strictly decreases as ambient rises", () => {
    const f90 = TEMP_CORRECTION.map((r) => r.f90).filter((x): x is number => x !== null);
    for (let i = 1; i < f90.length; i++) expect(f90[i]).toBeLessThan(f90[i - 1]);
  });
  it("30°C row is exactly 1.00 in every column", () => {
    const base = TEMP_CORRECTION.find((r) => r.maxAmbientC === 30);
    expect(base?.f60).toBe(1);
    expect(base?.f75).toBe(1);
    expect(base?.f90).toBe(1);
  });
});

describe("adjustment factors (Table 310.15(C)(1)) decrease with count", () => {
  it("factor strictly decreases as conductor count rises", () => {
    for (let i = 1; i < CCC_ADJUSTMENT.length; i++)
      expect(CCC_ADJUSTMENT[i].factor).toBeLessThan(CCC_ADJUSTMENT[i - 1].factor);
  });
});

describe("grounding tables (250.122 / 250.66) grow monotonically", () => {
  const cmilOf = (s: string) => (s.includes("kcmil") ? parseInt(s, 10) * 1000 : CIRCULAR_MILS[s]);
  it("EGC: OCPD ratings ascend and the EGC size never shrinks", () => {
    let prevRating = 0;
    let prevCmil = 0;
    for (const r of EGC_BY_OCPD) {
      expect(r.maxRating, `rating ${r.maxRating}`).toBeGreaterThan(prevRating);
      const c = cmilOf(r.size);
      expect(c, `EGC ${r.size}`).toBeGreaterThanOrEqual(prevCmil);
      prevRating = r.maxRating;
      prevCmil = c;
    }
  });
  it("GEC: service-size boundaries ascend and the GEC size never shrinks", () => {
    let prevMax = 0;
    let prevCmil = 0;
    for (const r of GEC_BY_SERVICE) {
      expect(r.maxCmil, `maxCmil ${r.maxCmil}`).toBeGreaterThan(prevMax);
      const c = cmilOf(r.size);
      expect(c, `GEC ${r.size}`).toBeGreaterThanOrEqual(prevCmil);
      prevMax = r.maxCmil;
      prevCmil = c;
    }
  });
  it("240.4(D): the small-conductor OCPD limit grows with conductor size", () => {
    const order = ["18", "16", "14", "12", "10"];
    let prev = 0;
    for (const s of order) {
      const cu = SMALL_CONDUCTOR_OCPD[s].cu;
      expect(cu, `Cu ${s}`).toBeDefined();
      expect(cu as number, `Cu ${s} vs prev`).toBeGreaterThan(prev);
      prev = cu as number;
    }
    // Aluminum is always more restrictive than copper at the same size.
    for (const s of ["12", "10"]) {
      expect(SMALL_CONDUCTOR_OCPD[s].al as number).toBeLessThan(SMALL_CONDUCTOR_OCPD[s].cu as number);
    }
  });
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
