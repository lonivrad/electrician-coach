// =============================================================================
// engine/calc/calculators.ts — pure NEC calculators + a dispatcher.
//
// Each calculator derives a numeric answer from structured inputs using the
// encoded 2020 NEC tables. A question's `recompute` spec names a calculator and
// supplies its inputs; the recompute test runs `runCalc` for every numeric
// question and asserts the result matches the authored answer within tolerance.
// =============================================================================

import {
  AMPACITY_AL,
  AMPACITY_CU,
  BOX_VOLUME_ALLOWANCE,
  CCC_ADJUSTMENT,
  CIRCULAR_MILS,
  EGC_BY_OCPD,
  GEC_BY_SERVICE,
  MOTOR_FLC_1PH,
  MOTOR_FLC_3PH,
  RACEWAY_AREA,
  RANGE_DEMAND_C,
  STANDARD_OCPD,
  TEMP_CORRECTION,
  THHN_AREA,
} from "./tables.ts";

type Inputs = Record<string, unknown>;

// ---- input coercion --------------------------------------------------------
function num(o: Inputs, k: string): number {
  const v = o[k];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`input "${k}" must be a number`);
  return v;
}
function optNum(o: Inputs, k: string, dflt: number): number {
  return o[k] === undefined ? dflt : num(o, k);
}
function str(o: Inputs, k: string): string {
  const v = o[k];
  if (typeof v !== "string") throw new Error(`input "${k}" must be a string`);
  return v;
}
function optStr(o: Inputs, k: string): string | undefined {
  const v = o[k];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new Error(`input "${k}" must be a string`);
  return v;
}
function need<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new Error(msg);
  return v;
}
function ampColumn(o: Inputs, k: string): 60 | 75 | 90 {
  const c = num(o, k);
  if (c !== 60 && c !== 75 && c !== 90) throw new Error(`"${k}" must be 60, 75, or 90`);
  return c;
}

/** Smallest standard OCPD rating ≥ value (240.6(A)); the max if value exceeds all. */
export function nextStandardOCPD(value: number): number {
  for (const s of STANDARD_OCPD) if (s >= value) return s;
  return STANDARD_OCPD[STANDARD_OCPD.length - 1];
}

/** Ambient-temperature correction factor (Table 310.15(B)(1)). */
export function correctionFactor(ambientC: number, tempColumn: 60 | 75 | 90): number {
  for (const r of TEMP_CORRECTION) {
    if (ambientC <= r.maxAmbientC) {
      const f = tempColumn === 60 ? r.f60 : tempColumn === 75 ? r.f75 : r.f90;
      if (f === null) throw new Error(`${tempColumn}°C conductor not permitted at ${ambientC}°C ambient`);
      return f;
    }
  }
  throw new Error(`ambient ${ambientC}°C exceeds Table 310.15(B)(1)`);
}

/** >3 current-carrying conductor adjustment factor (Table 310.15(C)(1)). */
export function adjustmentFactor(ccc: number): number {
  for (const r of CCC_ADJUSTMENT) if (ccc <= r.maxCount) return r.factor;
  return CCC_ADJUSTMENT[CCC_ADJUSTMENT.length - 1].factor;
}

// ---- calculators -----------------------------------------------------------

/** Box fill (314.16): conductors by size + clamp/device/EGC allowances → in³. */
function boxFill(i: Inputs): number {
  const conductors = need(i.conductors as Record<string, number> | undefined, "boxFill needs conductors");
  const allow = (size: string) => need(BOX_VOLUME_ALLOWANCE[size], `no box allowance for AWG ${size}`);
  let total = 0;
  for (const [size, count] of Object.entries(conductors)) total += allow(size) * count;
  const clampSize = optStr(i, "clampSize");
  if (clampSize) total += allow(clampSize); // one allowance for any/all clamps
  const deviceCount = optNum(i, "deviceCount", 0);
  if (deviceCount > 0) total += deviceCount * 2 * allow(str(i, "deviceSize")); // 2× per yoke
  const egcSize = optStr(i, "egcSize");
  if (egcSize) total += allow(egcSize); // all EGCs = one allowance
  return round(total, 4);
}

/** Conduit fill (Ch.9): max same-size conductors permitted in a raceway. */
function conduitMaxSameSize(i: Inputs): number {
  const raceway = str(i, "raceway");
  const area = need(RACEWAY_AREA[raceway]?.[str(i, "tradeSize")], "unknown raceway/size");
  const condArea = need(THHN_AREA[str(i, "size")], "unknown THHN size");
  const fill = optNum(i, "fillPercent", 40) / 100;
  const n = (area * fill) / condArea;
  // Ch.9 Table 1 note: round up when the decimal is 0.8 or larger.
  return n - Math.floor(n) >= 0.8 ? Math.ceil(n) : Math.floor(n);
}

/** Conduit fill: total THHN conductor area used (in²). */
function conduitAreaUsed(i: Inputs): number {
  const conductors = need(i.conductors as { size: string; count: number }[] | undefined, "needs conductors");
  let total = 0;
  for (const c of conductors) total += need(THHN_AREA[c.size], `unknown THHN ${c.size}`) * c.count;
  return round(total, 4);
}

/** Ampacity (310.16 + 310.15): base × correction × adjustment, capped at termination. */
function ampacityDerating(i: Inputs): number {
  const material = (optStr(i, "material") ?? "cu").toLowerCase();
  const table = material === "al" ? AMPACITY_AL : AMPACITY_CU;
  const size = str(i, "size");
  const row = need(table[size], `no ${material} ampacity for AWG ${size}`);
  const tempCol = ampColumn(i, "tempColumn");
  // Correction/adjustment: use the explicit factor if given, else derive it from
  // the ambient temperature / conductor count via the encoded tables.
  const correction =
    i.ambientC !== undefined
      ? correctionFactor(num(i, "ambientC"), tempCol)
      : optNum(i, "ambientCorrection", 1);
  const adjustment = i.ccc !== undefined ? adjustmentFactor(num(i, "ccc")) : optNum(i, "adjustment", 1);
  const derated = row[tempCol] * correction * adjustment;
  const termCol = i.terminationColumn === undefined ? undefined : ampColumn(i, "terminationColumn");
  const final = termCol === undefined ? derated : Math.min(derated, row[termCol]);
  return round(final, 2);
}

/** Continuous-load sizing: current × 125% (or given factor) — 210.19/215.2/210.20. */
function continuousLoad(i: Inputs): number {
  return round(num(i, "current") * optNum(i, "factor", 1.25), 2);
}

/** General lighting VA (220.12): area × VA/ft². */
function generalLighting(i: Inputs): number {
  return round(num(i, "areaFt2") * optNum(i, "vaPerFt2", 3), 2);
}

/** Table 220.42 tiered demand: first 3,000 VA @100%, 3,001–120,000 @35%, rest @25%. */
function standardDemandOf(total: number): number {
  let demand = Math.min(total, 3000);
  if (total > 3000) demand += Math.min(total - 3000, 117000) * 0.35;
  if (total > 120000) demand += (total - 120000) * 0.25;
  return demand;
}

/** Standard general-lighting demand (Table 220.42) on a stated total VA. */
function demandFactorStandard(i: Inputs): number {
  return round(standardDemandOf(num(i, "totalVA")), 2);
}

/** Sum component loads (VA), then apply the standard demand factors (220.42). */
function sumThenStandardDemand(i: Inputs): number {
  const comps = need(i.components as number[] | undefined, "sumThenStandardDemand needs components");
  return round(standardDemandOf(comps.reduce((a, b) => a + b, 0)), 2);
}

/** Optional dwelling method (220.82(B)): first 10 kVA @100%, remainder @40%, + HVAC. */
function optionalMethod(i: Inputs): number {
  const total = num(i, "totalKVA");
  const first = optNum(i, "firstKVA", 10);
  const remPct = optNum(i, "remainderPct", 0.4);
  return round(Math.min(total, first) + Math.max(0, total - first) * remPct + optNum(i, "hvacKVA", 0), 3);
}

/** Household range demand (Table 220.55, Column C) for N ranges ≤12 kW. */
function rangeDemandC(i: Inputs): number {
  return need(RANGE_DEMAND_C[num(i, "count")], "range count out of encoded range");
}

/** Motor full-load current (Table 430.248 / 430.250). */
function motorFLC(i: Inputs): number {
  const hp = str(i, "hp");
  const volts = num(i, "volts");
  const phase = num(i, "phase");
  if (phase === 3) return need(MOTOR_FLC_3PH[hp]?.[volts as 230 | 460], "no 3φ FLC for HP/volts");
  if (phase === 1) return need(MOTOR_FLC_1PH[hp]?.[volts as 115 | 230], "no 1φ FLC for HP/volts");
  throw new Error("phase must be 1 or 3");
}

/** Motor branch-circuit conductor (430.22): FLC × 125% (or given factor). */
function motorConductor(i: Inputs): number {
  return round(num(i, "flc") * optNum(i, "factor", 1.25), 2);
}

/** Motor branch short-circuit/GF protection (430.52): FLC × % → standard size. */
function motorBranchOCPD(i: Inputs): number {
  const v = num(i, "flc") * num(i, "pct");
  return optNum(i, "standardize", 1) ? nextStandardOCPD(v) : round(v, 2);
}

/** Motor overload (430.32): NAMEPLATE FLA × 125% (or given factor). */
function motorOverload(i: Inputs): number {
  return round(num(i, "nameplateFLA") * optNum(i, "factor", 1.25), 2);
}

/** Motor feeder (430.24): 125% of the largest FLC + sum of the others. */
function motorFeeder(i: Inputs): number {
  return round(num(i, "largestFLC") * optNum(i, "factor", 1.25) + num(i, "otherSum"), 2);
}

/** Transformer full-load current: 1φ = VA/V; 3φ = VA/(√3·V). */
function transformerCurrent(i: Inputs): number {
  const va = num(i, "kva") * 1000;
  const volts = num(i, "volts");
  const phase = num(i, "phase");
  const denom = phase === 3 ? Math.sqrt(3) * volts : volts;
  return round(va / denom, 2);
}

/** Transformer primary-only OCP (Table 450.3(B)): FLC × 125% → next standard size. */
function transformerPrimaryOCP(i: Inputs): number {
  const cur = transformerCurrent(i);
  const v = cur * optNum(i, "pct", 1.25);
  return optNum(i, "standardize", 1) ? nextStandardOCPD(v) : round(v, 2);
}

/** Voltage drop: 1φ = 2·K·I·D/cmil; 3φ = √3·K·I·D/cmil. */
function voltageDrop(i: Inputs): number {
  const cmil = optStr(i, "size") ? need(CIRCULAR_MILS[str(i, "size")], "unknown size") : num(i, "cmil");
  const factor = num(i, "phase") === 3 ? Math.sqrt(3) : 2;
  return round((factor * num(i, "k") * num(i, "current") * num(i, "oneWayFt")) / cmil, 2);
}

/** OCPD for mixed load (210.20): 125% continuous + 100% noncontinuous [→ std size]. */
function ocpdMixedLoad(i: Inputs): number {
  const v = num(i, "continuous") * 1.25 + num(i, "noncontinuous");
  return optNum(i, "standardize", 0) ? nextStandardOCPD(v) : round(v, 2);
}

/** Ohm's law current: V / R. */
function ohmsCurrent(i: Inputs): number {
  return round(num(i, "volts") / num(i, "ohms"), 2);
}

/** Single-phase real power: V·I·pf. */
function power1ph(i: Inputs): number {
  return round(num(i, "volts") * num(i, "amps") * optNum(i, "pf", 1), 2);
}

/** Three-phase real power: √3·V·I·pf. */
function power3ph(i: Inputs): number {
  return round(Math.sqrt(3) * num(i, "volts") * num(i, "amps") * optNum(i, "pf", 1), 0);
}

/** Circular-mil ratio (250.122(B) proportional upsize): new/orig. */
function cmilRatio(i: Inputs): number {
  const nw = optStr(i, "newSize")
    ? need(CIRCULAR_MILS[str(i, "newSize")], "unknown newSize")
    : num(i, "newCmil");
  const og = optStr(i, "origSize")
    ? need(CIRCULAR_MILS[str(i, "origSize")], "unknown origSize")
    : num(i, "origCmil");
  return round(nw / og, 2);
}

function round(x: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

// ---- dispatcher ------------------------------------------------------------
export const CALCULATORS: Record<string, (i: Inputs) => number> = {
  boxFill,
  conduitMaxSameSize,
  conduitAreaUsed,
  ampacityDerating,
  continuousLoad,
  generalLighting,
  demandFactorStandard,
  sumThenStandardDemand,
  optionalMethod,
  rangeDemandC,
  motorFLC,
  motorConductor,
  motorBranchOCPD,
  motorOverload,
  motorFeeder,
  transformerCurrent,
  transformerPrimaryOCP,
  voltageDrop,
  ocpdMixedLoad,
  ohmsCurrent,
  power1ph,
  power3ph,
  cmilRatio,
};

export function runCalc(calc: string, inputs: Inputs): number {
  const fn = CALCULATORS[calc];
  if (!fn) throw new Error(`unknown calculator "${calc}"`);
  return fn(inputs);
}

export function isKnownCalc(calc: string): boolean {
  return calc in CALCULATORS;
}

// ---- size-returning calculators (table lookups → conductor-size string) ----

/** Table 250.122: minimum copper EGC size for an overcurrent-device rating. */
function egcSize(i: Inputs): string {
  const ocpd = num(i, "ocpd");
  for (const r of EGC_BY_OCPD) if (ocpd <= r.maxRating) return r.size;
  return EGC_BY_OCPD[EGC_BY_OCPD.length - 1].size;
}

/** Table 250.66: copper GEC size for the largest service-entrance conductor. */
function gecSize(i: Inputs): string {
  const cmil = optStr(i, "serviceSize")
    ? need(CIRCULAR_MILS[str(i, "serviceSize")], `unknown service size "${str(i, "serviceSize")}"`)
    : num(i, "serviceKcmil") * 1000;
  for (const r of GEC_BY_SERVICE) if (cmil <= r.maxCmil) return r.size;
  return GEC_BY_SERVICE[GEC_BY_SERVICE.length - 1].size;
}

export const SIZE_CALCULATORS: Record<string, (i: Inputs) => string> = { egcSize, gecSize };

export function runSizeCalc(calc: string, inputs: Inputs): string {
  const fn = SIZE_CALCULATORS[calc];
  if (!fn) throw new Error(`unknown size calculator "${calc}"`);
  return fn(inputs);
}

export function isKnownSizeCalc(calc: string): boolean {
  return calc in SIZE_CALCULATORS;
}
