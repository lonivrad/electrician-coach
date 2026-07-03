import { describe, it, expect } from "vitest";
import { runCalc, correctionFactor, adjustmentFactor } from "../../engine/index.ts";

const approx = (v: number, e: number, tol = 0.01) => expect(Math.abs(v - e)).toBeLessThanOrEqual(tol);

describe("correctionFactor (Table 310.15(B)(1))", () => {
  it("50°C, 90°C column = 0.82", () => expect(correctionFactor(50, 90)).toBe(0.82));
  it("38°C (36-40 band), 90°C = 0.91", () => expect(correctionFactor(38, 90)).toBe(0.91));
  it("30°C baseline = 1.00", () => expect(correctionFactor(30, 90)).toBe(1.0));
  it("25°C, 60°C column = 1.08", () => expect(correctionFactor(25, 60)).toBe(1.08));
  it("throws where a rating is not permitted (60°C conductor at 60°C ambient)", () =>
    expect(() => correctionFactor(60, 60)).toThrow());
});

describe("adjustmentFactor (Table 310.15(C)(1), 2020)", () => {
  it("3 → 1.0", () => expect(adjustmentFactor(3)).toBe(1.0));
  it("6 → 0.80", () => expect(adjustmentFactor(6)).toBe(0.8));
  it("9 → 0.70 (2020, not the 2026 0.65)", () => expect(adjustmentFactor(9)).toBe(0.7));
  it("20 → 0.50", () => expect(adjustmentFactor(20)).toBe(0.5));
  it("25 → 0.45", () => expect(adjustmentFactor(25)).toBe(0.45));
  it("50 → 0.35", () => expect(adjustmentFactor(50)).toBe(0.35));
});

describe("ampacityDerating — aluminum", () => {
  it("2 AWG Al @75°C = 90 A", () =>
    expect(runCalc("ampacityDerating", { material: "al", size: "2", tempColumn: 75 })).toBe(90));
  it("4/0 Al @90°C = 205 A", () =>
    expect(runCalc("ampacityDerating", { material: "al", size: "4/0", tempColumn: 90 })).toBe(205));
});

describe("ampacityDerating — factors derived from ambient/ccc", () => {
  it("derives 0.82 × 0.80 from ambientC 46 + ccc 6 (matches the explicit-factor question)", () =>
    approx(runCalc("ampacityDerating", { size: "6", tempColumn: 90, ambientC: 46, ccc: 6 }), 49.2, 0.1));
  it("still honors explicit factors when given", () =>
    approx(runCalc("ampacityDerating", { size: "8", tempColumn: 90, ambientCorrection: 0.82 }), 45.1, 0.1));
});

describe("conduit fill uses the new raceway types", () => {
  it("max 12 THHN in 3/4 RMC", () =>
    expect(
      runCalc("conduitMaxSameSize", { raceway: "RMC", tradeSize: "3/4", wireType: "THHN", size: "12" }),
    ).toBeGreaterThan(0));
  it("max 12 THHN in 1 PVC40", () =>
    expect(
      runCalc("conduitMaxSameSize", { raceway: "PVC40", tradeSize: "1", wireType: "THHN", size: "12" }),
    ).toBeGreaterThan(0));
});
