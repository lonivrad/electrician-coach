import { describe, it, expect } from "vitest";
import { runCalc, runSizeCalc, correctionFactor, adjustmentFactor } from "../../engine/index.ts";

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

describe("grounding size calculators (250.122 / 250.66)", () => {
  it("EGC: 30 A → 10 AWG (uses the 'not exceeding 60' row)", () =>
    expect(runSizeCalc("egcSize", { ocpd: 30 })).toBe("10"));
  it("EGC: 100 A → 8 AWG", () => expect(runSizeCalc("egcSize", { ocpd: 100 })).toBe("8"));
  it("EGC: 400 A → 3 AWG", () => expect(runSizeCalc("egcSize", { ocpd: 400 })).toBe("3"));
  it("GEC: 2 AWG service → 8 AWG", () => expect(runSizeCalc("gecSize", { serviceSize: "2" })).toBe("8"));
  it("GEC: 3/0 service → 4 AWG (not 2 — verified)", () =>
    expect(runSizeCalc("gecSize", { serviceSize: "3/0" })).toBe("4"));
  it("GEC: 4/0 service → 2 AWG", () => expect(runSizeCalc("gecSize", { serviceSize: "4/0" })).toBe("2"));
  it("GEC: 250 kcmil service → 2 AWG", () => expect(runSizeCalc("gecSize", { serviceKcmil: 250 })).toBe("2"));
  it("GEC: 500 kcmil service → 1/0", () => expect(runSizeCalc("gecSize", { serviceKcmil: 500 })).toBe("1/0"));
  it("throws on unknown size calculator", () => expect(() => runSizeCalc("nope", {})).toThrow());
});

describe("overcurrent calculators (240.6 / 240.4)", () => {
  it("next standard size ≥ 83 A → 90 A (240.4(B))", () =>
    expect(runCalc("nextStandardSize", { value: 83 })).toBe(90));
  it("next standard size ≥ 115 A → 125 A", () =>
    expect(runCalc("nextStandardSize", { value: 115 })).toBe(125));
  it("next standard size ≥ 46 A → 50 A", () => expect(runCalc("nextStandardSize", { value: 46 })).toBe(50));
  it("small conductor: 12 AWG Cu → 20 A", () =>
    expect(runCalc("smallConductorMaxOCPD", { size: "12" })).toBe(20));
  it("small conductor: 10 AWG Cu → 30 A", () =>
    expect(runCalc("smallConductorMaxOCPD", { size: "10" })).toBe(30));
  it("small conductor: 12 AWG Al → 15 A", () =>
    expect(runCalc("smallConductorMaxOCPD", { size: "12", material: "al" })).toBe(15));
  it("small conductor: 10 AWG Al → 25 A", () =>
    expect(runCalc("smallConductorMaxOCPD", { size: "10", material: "al" })).toBe(25));
  it("throws when a size has no rule for that material", () =>
    expect(() => runCalc("smallConductorMaxOCPD", { size: "14", material: "al" })).toThrow());
});

describe("burial depth (Table 300.5)", () => {
  it("direct burial → 24 in", () => expect(runCalc("burialDepth", { method: "directBurial" })).toBe(24));
  it("RMC/IMC → 6 in", () => expect(runCalc("burialDepth", { method: "rmcImc" })).toBe(6));
  it("nonmetallic raceway → 18 in", () =>
    expect(runCalc("burialDepth", { method: "nonmetallicRaceway" })).toBe(18));
  it("residential GFCI branch → 12 in", () =>
    expect(runCalc("burialDepth", { method: "residentialGFCI" })).toBe(12));
  it("throws on unknown method", () =>
    expect(() => runCalc("burialDepth", { method: "nope" })).toThrow());
});

describe("transformer primary-only OCP factor auto-select (450.3(B))", () => {
  // <2 A → 300% (ceiling): 0.5 kVA / 480 V / 1φ → FLC 1.04 A → 3.13 A.
  it("<2 A primary → 300%", () =>
    approx(runCalc("transformerPrimaryMaxOCP", { kva: 0.5, volts: 480, phase: 1 }), 3.13, 0.05));
  // 2–9 A → 167% (ceiling): 3 kVA / 480 V / 1φ → FLC 6.25 A → 10.44 A.
  it("2–9 A primary → 167%", () =>
    approx(runCalc("transformerPrimaryMaxOCP", { kva: 3, volts: 480, phase: 1 }), 10.44, 0.05));
  // ≥9 A → 125% rounded up to a standard size (Note 1): 45 kVA / 480 V / 3φ → 70 A.
  it("≥9 A primary → 125% → next standard", () =>
    expect(runCalc("transformerPrimaryMaxOCP", { kva: 45, volts: 480, phase: 3 })).toBe(70));
});

describe("motor overload at 115% for SF < 1.15 (430.32(A)(1))", () => {
  it("20 A nameplate × 115% = 23 A", () =>
    approx(runCalc("motorOverload", { nameplateFLA: 20, factor: 1.15 }), 23, 0.01));
  it("34 A nameplate × 115% = 39.1 A", () =>
    approx(runCalc("motorOverload", { nameplateFLA: 34, factor: 1.15 }), 39.1, 0.01));
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
