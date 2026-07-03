import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  validatePack,
  packErrors,
  selectBlueprintExam,
  boardPolicy,
  type ContentPack,
  type Question,
} from "../../engine/index.ts";

const packDir = join(process.cwd(), "content-packs", "wa-electrician-01");

function walkYaml(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkYaml(p));
    else if (e.endsWith(".yaml")) out.push(p);
  }
  return out;
}

function loadPack(): ContentPack {
  const rd = <T>(f: string) => yaml.load(readFileSync(join(packDir, f), "utf8")) as T;
  const manifest = rd<Omit<ContentPack, "domains" | "traps" | "blueprint" | "questions">>("pack.yaml");
  const questions: Question[] = [];
  for (const file of walkYaml(join(packDir, "questions"))) {
    const parsed = yaml.load(readFileSync(file, "utf8"));
    if (Array.isArray(parsed)) questions.push(...(parsed as Question[]));
  }
  return {
    ...manifest,
    domains: rd("domains.yaml"),
    traps: rd("traps.yaml"),
    blueprint: rd("blueprint.yaml"),
    questions,
  };
}

describe("wa-electrician-01 pack", () => {
  const pack = loadPack();

  it("passes engine validation (no errors)", () => {
    expect(packErrors(validatePack(pack))).toEqual([]);
  });

  it("section weights sum to the real exam counts (60 and 17)", () => {
    const secA = pack.blueprint.sections.find((s) => s.id === "nec-theory")!;
    const secB = pack.blueprint.sections.find((s) => s.id === "wa-laws")!;
    expect(secA.totalQuestions).toBe(60);
    expect(secB.totalQuestions).toBe(17);
    const sum = (s: typeof secA) => s.domainWeights.reduce((n, w) => n + w.officialExamWeight, 0);
    expect(sum(secA)).toBe(60);
    expect(sum(secB)).toBe(17);
  });

  it("both sections pass at 70%", () => {
    for (const s of pack.blueprint.sections) expect(s.cutScorePct).toBe(0.7);
  });

  it("all WA Laws subdomain weights are flagged provisional", () => {
    const secB = pack.blueprint.sections.find((s) => s.id === "wa-laws")!;
    expect(secB.domainWeights.every((w) => w.needsVerification)).toBe(true);
  });

  it("edition is verified 2020 NEC and no question is live yet", () => {
    expect(pack.edition.code).toBe("NEC-2020");
    expect(pack.edition.status).toBe("verified");
    // Per-item draft/SME-review gating stays intact regardless of edition status.
    expect(pack.questions.every((q) => q.status !== "live")).toBe(true);
  });

  // The question bank is a POOL that grows past the exam size; each domain must
  // hold at least its exam weight so a full blueprint exam can be drawn without
  // repeats, and the NEC bank must be at least the exam length.
  it("NEC & Theory bank ≥ 60 with each domain ≥ its exam weight", () => {
    const sectionOf = (id: string) => pack.domains.find((d) => d.id === id)?.sectionId;
    const nec = pack.questions.filter((q) => sectionOf(q.domainId) === "nec-theory");
    expect(nec.length).toBeGreaterThanOrEqual(60);

    const secA = pack.blueprint.sections.find((s) => s.id === "nec-theory")!;
    for (const w of secA.domainWeights) {
      const count = nec.filter((q) => q.domainId === w.domainId).length;
      expect(count, `${w.domainId} has ${count}, needs ≥ ${w.officialExamWeight}`).toBeGreaterThanOrEqual(
        w.officialExamWeight,
      );
    }
  });

  it("NEC & Theory bank has questions at every difficulty and real L3/L4 depth", () => {
    const sectionOf = (id: string) => pack.domains.find((d) => d.id === id)?.sectionId;
    const nec = pack.questions.filter((q) => sectionOf(q.domainId) === "nec-theory");
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<number, number>;
    for (const q of nec) dist[q.difficulty]++;
    for (const level of [1, 2, 3, 4]) expect(dist[level], `L${level}`).toBeGreaterThan(0);
    // Enough hard items to fill Hard Mode from a meaningful pool.
    expect(dist[3] + dist[4]).toBeGreaterThanOrEqual(20);
  });

  it("wa.admin-rules gap is filled (every domain has ≥1 question)", () => {
    const withQuestions = new Set(pack.questions.map((q) => q.domainId));
    for (const d of pack.domains) expect(withQuestions.has(d.id)).toBe(true);
  });

  it("a blueprint exam draws exactly the section total, proportioned by weight", () => {
    const secA = pack.blueprint.sections.find((s) => s.id === "nec-theory")!;
    const exam = selectBlueprintExam({
      section: secA,
      domains: pack.domains,
      questions: pack.questions,
      mode: "board",
      policy: boardPolicy().selection,
    });
    expect(exam.length).toBe(secA.totalQuestions);
    expect(new Set(exam.map((q) => q.id)).size).toBe(exam.length); // no repeats
    for (const w of secA.domainWeights) {
      const n = exam.filter((q) => q.domainId === w.domainId).length;
      expect({ d: w.domainId, n }).toEqual({ d: w.domainId, n: w.officialExamWeight });
    }
  });
});
