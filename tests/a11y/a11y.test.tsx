// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { emptyMastery } from "../../engine/index.ts";
import { loadPackOnce } from "../../src/data/packLoader.ts";
import type { ExamReport } from "../../src/state/useExam.ts";
import { Home } from "../../src/ui/Home.tsx";
import { QuestionPlayer } from "../../src/ui/player/QuestionPlayer.tsx";
import { ExamRunner } from "../../src/ui/exam/ExamRunner.tsx";
import { ExamResults } from "../../src/ui/exam/ExamResults.tsx";
import { WeaknessMap } from "../../src/ui/results/WeaknessMap.tsx";
import { ExitConfirm } from "../../src/ui/components/ExitConfirm.tsx";

afterEach(cleanup);

const noop = () => {};
const { pack } = loadPackOnce();
const single = pack.questions.find((q) => q.type === "single")!;
const numeric = pack.questions.find((q) => q.type === "numeric")!;
const sectionA = pack.blueprint.sections[0];

// Contrast is checked by hand against the design tokens; axe can't compute it in
// jsdom (no stylesheet is applied), so disable that one rule here.
async function expectA11y(container: HTMLElement) {
  const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
  // Assert on the violation ids so a failure names exactly what's wrong.
  const violations = results.violations.map((v) => `${v.id} — ${v.help}`);
  expect(violations).toEqual([]);
}

describe("accessibility: main screens have no axe violations", () => {
  it("Home / mode picker", async () => {
    const { container } = render(
      <Home
        onStartDiagnostic={noop}
        onStartBoard={noop}
        onStartHardMode={noop}
        onPracticeMissed={noop}
        onOpenProgress={noop}
      />,
    );
    await expectA11y(container);
  });

  it("Diagnostic question player (single-choice radio group)", async () => {
    const { container } = render(
      <QuestionPlayer
        question={single}
        section={sectionA}
        domainName="Ampacity"
        index={0}
        total={10}
        onSubmit={noop}
        onHome={noop}
        canPrevious={false}
      />,
    );
    await expectA11y(container);
  });

  it("Exam runner (single-choice + timer)", async () => {
    const { container } = render(
      <ExamRunner
        question={single}
        section={sectionA}
        index={0}
        total={60}
        remainingSec={3600}
        allottedSec={3600}
        response={undefined}
        rawNumeric=""
        flagged={false}
        onToggleFlag={noop}
        onSingle={noop}
        onNumeric={noop}
        onPrev={noop}
        canPrev={false}
        onNext={noop}
        isLast={false}
        onFinish={noop}
        onHome={noop}
      />,
    );
    await expectA11y(container);
  });

  it("Exam runner (numeric input has a label)", async () => {
    const { container } = render(
      <ExamRunner
        question={numeric}
        section={sectionA}
        index={0}
        total={60}
        remainingSec={120}
        allottedSec={3600}
        response={undefined}
        rawNumeric=""
        flagged={false}
        onToggleFlag={noop}
        onSingle={noop}
        onNumeric={noop}
        onPrev={noop}
        canPrev={false}
        onNext={noop}
        isLast={false}
        onFinish={noop}
        onHome={noop}
      />,
    );
    await expectA11y(container);
  });

  it("Exam results (pass/fail + review)", async () => {
    const report: ExamReport = {
      sectionName: "NEC & Theory",
      total: 2,
      answered: 2,
      correct: 1,
      scorePct: 0.5,
      cutPct: 0.7,
      passed: false,
      allottedSec: 3600,
      timeUsedSec: 1200,
      timedOut: false,
      domains: [{ domainId: "d", name: "Ampacity", total: 2, correct: 1, accuracy: 0.5, priority: 4 }],
      reviewItems: [
        {
          question: single,
          response: { kind: "single", optionId: single.options![0].id },
          correct: false,
          flagged: true,
        },
      ],
    };
    const { container } = render(<ExamResults report={report} onAgain={noop} onHome={noop} />);
    await expectA11y(container);
  });

  it("Diagnostic weakness map", async () => {
    const { container } = render(
      <WeaknessMap
        pack={pack}
        mastery={emptyMastery()}
        answered={5}
        onRestart={noop}
        onReset={noop}
        onHome={noop}
      />,
    );
    await expectA11y(container);
  });

  it("Exit-confirm dialog", async () => {
    const { container } = render(
      <ExitConfirm onStay={noop} onLeave={noop} message="Leave the practice exam? This run won't be scored." />,
    );
    await expectA11y(container);
  });
});
