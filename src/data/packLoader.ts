// =============================================================================
// src/data/packLoader.ts — assemble a ContentPack from its YAML files.
//
// Content packs live OUTSIDE src/. We import each YAML as a raw string (Vite
// `?raw`) and parse with js-yaml, then run the engine's validator so a
// malformed pack fails loudly at startup instead of silently degrading the
// adaptive model.
// =============================================================================

import yaml from "js-yaml";
import {
  validatePack,
  packErrors,
  type ContentPack,
  type Domain,
  type TrapDef,
  type Blueprint,
  type Question,
  type PackIssue,
} from "@engine/index.ts";

// Manifest/blueprint/domains/traps — one file each.
import packRaw from "@packs/wa-electrician-01/pack.yaml?raw";
import domainsRaw from "@packs/wa-electrician-01/domains.yaml?raw";
import trapsRaw from "@packs/wa-electrician-01/traps.yaml?raw";
import blueprintRaw from "@packs/wa-electrician-01/blueprint.yaml?raw";

// Questions — every YAML under questions/**. Eager so the pack is ready at boot.
const questionModules = import.meta.glob<string>("@packs/wa-electrician-01/questions/**/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

export interface LoadedPack {
  pack: ContentPack;
  issues: PackIssue[];
}

export function loadWaElectrician01(): LoadedPack {
  const manifest = yaml.load(packRaw) as Omit<ContentPack, "domains" | "traps" | "blueprint" | "questions">;
  const domains = yaml.load(domainsRaw) as Domain[];
  const traps = yaml.load(trapsRaw) as TrapDef[];
  const blueprint = yaml.load(blueprintRaw) as Blueprint;

  const questions: Question[] = [];
  for (const raw of Object.values(questionModules)) {
    const parsed = yaml.load(raw);
    if (Array.isArray(parsed)) questions.push(...(parsed as Question[]));
  }

  const pack: ContentPack = { ...manifest, domains, traps, blueprint, questions };

  const issues = validatePack(pack);
  const errors = packErrors(issues);
  if (errors.length > 0) {
    const msg = errors.map((e) => `  [${e.code}] ${e.message}`).join("\n");
    throw new Error(`Content pack "${pack.id}" failed validation:\n${msg}`);
  }
  return { pack, issues };
}

// Convenience lookups built once per pack.
export function indexPack(pack: ContentPack) {
  const domainById = new Map(pack.domains.map((d) => [d.id, d]));
  const trapById = new Map(pack.traps.map((t) => [t.id, t]));
  const questionById = new Map(pack.questions.map((q) => [q.id, q]));
  const sectionById = new Map(pack.blueprint.sections.map((s) => [s.id, s]));
  return { domainById, trapById, questionById, sectionById };
}
