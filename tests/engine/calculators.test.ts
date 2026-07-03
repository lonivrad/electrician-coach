import { describe, it, expect } from "vitest";
import { runCalc, nextStandardOCPD } from "../../engine/index.ts";

const approx = (v: number, expected: number, tol = 0.01) =>
  expect(Math.abs(v - expected)).toBeLessThanOrEqual(tol);

describe("nextStandardOCPD (240.6)", () => {
  it("returns the value when it is already standard", () => expect(nextStandardOCPD(70)).toBe(70));
  it("rounds up to the next standard size", () => expect(nextStandardOCPD(67.6)).toBe(70));
  it("83 A -> 90 A", () => expect(nextStandardOCPD(83)).toBe(90));
});

describe("boxFill (314.16)", () => {
  it("six 12 AWG conductors", () => approx(runCalc("boxFill", { conductors: { "12": 6 } }), 13.5));
  it("conductors + clamp + device + EGC (all 14 AWG)", () =>
    approx(
      runCalc("boxFill", {
        conductors: { "14": 8 },
        clampSize: "14",
        deviceCount: 1,
        deviceSize: "14",
        egcSize: "14",
      }),
      24,
    ));
  it("mixed sizes, largest governs clamp/device", () =>
    approx(
      runCalc("boxFill", {
        conductors: { "12": 3, "14": 4 },
        clampSize: "12",
        deviceCount: 1,
        deviceSize: "12",
      }),
      21.5,
    ));
});

describe("conduit fill (Ch.9)", () => {
  it("max 12 THHN in 3/4 EMT = 16", () =>
    expect(
      runCalc("conduitMaxSameSize", { raceway: "EMT", tradeSize: "3/4", wireType: "THHN", size: "12" }),
    ).toBe(16));
  it("max 10 THHN in 1/2 EMT = 5", () =>
    expect(
      runCalc("conduitMaxSameSize", { raceway: "EMT", tradeSize: "1/2", wireType: "THHN", size: "10" }),
    ).toBe(5));
  it("area used for 3x12 + 2x10 THHN", () =>
    approx(
      runCalc("conduitAreaUsed", {
        conductors: [
          { size: "12", count: 3 },
          { size: "10", count: 2 },
        ],
      }),
      0.0821,
      0.0005,
    ));
});

describe("ampacityDerating (310.16 / 310.15)", () => {
  it("8 AWG @90 x 0.82", () =>
    approx(runCalc("ampacityDerating", { size: "8", tempColumn: 90, ambientCorrection: 0.82 }), 45.1, 0.1));
  it("12 AWG @90 x 0.80 adjustment", () =>
    approx(runCalc("ampacityDerating", { size: "12", tempColumn: 90, adjustment: 0.8 }), 24));
  it("6 AWG @90 combined", () =>
    approx(
      runCalc("ampacityDerating", { size: "6", tempColumn: 90, ambientCorrection: 0.82, adjustment: 0.8 }),
      49.2,
      0.1,
    ));
  it("3 AWG derate governed by 75C termination", () =>
    approx(
      runCalc("ampacityDerating", {
        size: "3",
        tempColumn: 90,
        ambientCorrection: 0.91,
        adjustment: 0.8,
        terminationColumn: 75,
      }),
      83.7,
      0.2,
    ));
});

describe("load calc (Art. 220)", () => {
  it("general lighting 2000 ft²", () => approx(runCalc("generalLighting", { areaFt2: 2000 }), 6000));
  it("standard demand on 9000 VA", () => approx(runCalc("demandFactorStandard", { totalVA: 9000 }), 5100));
  it("standard demand on 10500 VA", () => approx(runCalc("demandFactorStandard", { totalVA: 10500 }), 5625));
  it("optional method 40 kVA", () => approx(runCalc("optionalMethod", { totalKVA: 40 }), 22));
  it("range demand, one range", () => expect(runCalc("rangeDemandC", { count: 1 })).toBe(8));
});

describe("motors (Art. 430)", () => {
  it("10 HP 230V 3φ FLC = 28", () =>
    expect(runCalc("motorFLC", { hp: "10", volts: 230, phase: 3 })).toBe(28));
  it("conductor at 125%", () => approx(runCalc("motorConductor", { flc: 28 }), 35));
  it("branch OCPD 250% -> 70", () => expect(runCalc("motorBranchOCPD", { flc: 28, pct: 2.5 })).toBe(70));
  it("overload from nameplate", () => approx(runCalc("motorOverload", { nameplateFLA: 26 }), 32.5));
  it("feeder for two motors", () => approx(runCalc("motorFeeder", { largestFLC: 28, otherSum: 16 }), 51));
});

describe("transformer + theory", () => {
  it("45 kVA 3φ 208V secondary", () =>
    approx(runCalc("transformerCurrent", { kva: 45, volts: 208, phase: 3 }), 124.9, 0.2));
  it("30 kVA 3φ 480V primary", () =>
    approx(runCalc("transformerCurrent", { kva: 30, volts: 480, phase: 3 }), 36.1, 0.2));
  it("primary OCP 45kVA 480V -> 70", () =>
    expect(runCalc("transformerPrimaryOCP", { kva: 45, volts: 480, phase: 3 })).toBe(70));
  it("voltage drop 1φ", () =>
    approx(runCalc("voltageDrop", { k: 12.9, current: 20, oneWayFt: 100, cmil: 6530, phase: 1 }), 7.9, 0.1));
  it("ohms law", () => expect(runCalc("ohmsCurrent", { volts: 240, ohms: 20 })).toBe(12));
  it("3φ power", () => approx(runCalc("power3ph", { volts: 480, amps: 20 }), 16628, 2));
  it("cmil ratio 8->6 AWG", () => approx(runCalc("cmilRatio", { newSize: "6", origSize: "8" }), 1.59, 0.01));
  it("mixed-load OCPD", () => approx(runCalc("ocpdMixedLoad", { continuous: 40, noncontinuous: 20 }), 70));
});

describe("dispatcher", () => {
  it("throws on unknown calculator", () => expect(() => runCalc("nope", {})).toThrow());
  it("throws on missing input", () => expect(() => runCalc("ohmsCurrent", { volts: 240 })).toThrow());
});
