// =============================================================================
// scripts/validate-pack.ts — CI gate for content packs. Run: npm run validate:pack
//
// Enforces the invariants that keep the engine/content separation honest and
// the adaptive model trustworthy:
//   • engine imports NOTHING from content-packs/ (zero-coupling rule)
//   • per section: Σ officialExamWeight === totalQuestions
//   • every domain/skill/trap id referenced by a question resolves
//   • no question is `live` while the pack edition is NEEDS_VERIFICATION
//   • answer keys are internally consistent
// Exits non-zero on any error so CI fails loudly.
// =============================================================================

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { validatePack, type ContentPack, type Question } from "../engine/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packDir = join(root, "content-packs", "wa-electrician-01");

function readYaml<T>(rel: string): T {
  return yaml.load(readFileSync(join(packDir, rel), "utf8")) as T;
}

function walkYaml(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkYaml(p));
    else if (entry.endsWith(".yaml")) out.push(p);
  }
  return out;
}

function loadPack(): ContentPack {
  const manifest = readYaml<Omit<ContentPack, "domains" | "traps" | "blueprint" | "questions">>("pack.yaml");
  const domains = readYaml<ContentPack["domains"]>("domains.yaml");
  const traps = readYaml<ContentPack["traps"]>("traps.yaml");
  const blueprint = readYaml<ContentPack["blueprint"]>("blueprint.yaml");
  const questions: Question[] = [];
  for (const file of walkYaml(join(packDir, "questions"))) {
    const parsed = yaml.load(readFileSync(file, "utf8"));
    if (Array.isArray(parsed)) questions.push(...(parsed as Question[]));
  }
  return { ...manifest, domains, traps, blueprint, questions };
}

// ---- Zero-coupling check: engine must not import content-packs -------------
function assertEngineDecoupled(): string[] {
  const engineDir = join(root, "engine");
  const offenders: string[] = [];
  // Match real import/require specifiers only — not comments/prose mentioning the path.
  const importRe = /(?:from|import|require)\s*\(?\s*['"][^'"]*(?:content-packs|@packs)[^'"]*['"]/;
  for (const file of walkTs(engineDir)) {
    const src = readFileSync(file, "utf8");
    if (importRe.test(src)) offenders.push(file);
  }
  return offenders;
}
function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (entry.endsWith(".ts")) out.push(p);
  }
  return out;
}

// ---- Run --------------------------------------------------------------------
const pack = loadPack();
const issues = validatePack(pack);
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");
const coupling = assertEngineDecoupled();

console.log(`\nContent pack: ${pack.id}  (edition ${pack.edition.code} — ${pack.edition.status})`);
console.log(
  `Questions: ${pack.questions.length}  Domains: ${pack.domains.length}  Traps: ${pack.traps.length}`,
);

for (const w of warnings) console.log(`  ⚠ [${w.code}] ${w.message}`);
for (const e of errors) console.error(`  ✖ [${e.code}] ${e.message}`);
if (coupling.length) {
  for (const f of coupling) console.error(`  ✖ [engine.coupling] engine file imports content: ${f}`);
}

const failed = errors.length > 0 || coupling.length > 0;
console.log(
  `\n${failed ? "FAILED" : "OK"} — ${errors.length} error(s), ${warnings.length} warning(s), ` +
    `${coupling.length} coupling violation(s).\n`,
);
process.exit(failed ? 1 : 0);
