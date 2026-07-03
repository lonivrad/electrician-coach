// Headless end-to-end smoke test of the diagnostic loop against the REAL pack.
// Simulates a candidate who is strong on ampacity but weak on WA law, and
// prints the resulting per-section projection. Proves the engine + pack wire
// together and the weakness map converges. Run: npx tsx scripts/smoke-diagnostic.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import {
  applyResponse,
  diagnosticPolicy,
  diagnosticShouldStop,
  emptyMastery,
  selectNextAcrossSections,
  projectBoard,
  type ContentPack,
  type Question,
} from "../engine/index.ts";

const packDir = join(process.cwd(), "content-packs", "wa-electrician-01");
const rd = <T>(f: string) => yaml.load(readFileSync(join(packDir, f), "utf8")) as T;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : e.endsWith(".yaml") ? [p] : [];
  });
}
const questions: Question[] = [];
for (const f of walk(join(packDir, "questions"))) {
  const parsed = yaml.load(readFileSync(f, "utf8"));
  if (Array.isArray(parsed)) questions.push(...(parsed as Question[]));
}
const pack: ContentPack = {
  ...rd<Omit<ContentPack, "domains" | "traps" | "blueprint" | "questions">>("pack.yaml"),
  domains: rd("domains.yaml"),
  traps: rd("traps.yaml"),
  blueprint: rd("blueprint.yaml"),
  questions,
};

const POLICY = diagnosticPolicy(30);

// Uses the SAME engine selection the app uses — no duplicated logic here.
const pickNext = (mastery: Parameters<typeof applyResponse>[0], used: Set<string>) =>
  selectNextAcrossSections({
    blueprint: pack.blueprint,
    domains: pack.domains,
    questions: pack.questions,
    mode: "diagnostic",
    mastery,
    usedQuestionIds: used,
    policy: POLICY.selection,
  });

// Simulated skill: correct if the domain is one this candidate "knows".
const strong = new Set(["nec.ampacity", "nec.theory-general", "nec.box-fill"]);
let mastery = emptyMastery();
const used = new Set<string>();
let answered = 0;
const domainsTouched = new Set<string>();

while (!diagnosticShouldStop({ blueprint: pack.blueprint, mastery, answered, stop: POLICY.stop })) {
  const q = pickNext(mastery, used);
  if (!q) break;
  used.add(q.id);
  domainsTouched.add(q.domainId);
  const correct = strong.has(q.domainId);
  mastery = applyResponse(mastery, {
    domainId: q.domainId,
    skillIds: q.skillIds,
    trapIds: q.trapIds,
    correct,
  });
  answered++;
}

const proj = projectBoard(pack.blueprint, mastery);
console.log(`\nSimulated diagnostic: ${answered} items answered, ${domainsTouched.size} domains touched.`);
for (const s of proj.sections) {
  console.log(
    `\n${s.name}: expected ${(s.expectedScore * 100).toFixed(0)}% ` +
      `(cut ${(s.cutScorePct * 100).toFixed(0)}%) → ${s.passesProjected ? "PASS" : "below cut"}`,
  );
  for (const d of s.domains.slice(0, 3)) {
    console.log(
      `   • ${d.domainId.padEnd(22)} mastery ${(d.mastery * 100).toFixed(0)}%  ` +
        `wt ${d.officialExamWeight}  priority ${d.practicePriority.toFixed(2)}`,
    );
  }
}
console.log(`\nProjected to pass BOTH sections: ${proj.passesAllSections}\n`);
