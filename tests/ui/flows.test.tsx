// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExamFlow } from "../../src/ui/exam/ExamFlow.tsx";
import { DiagnosticFlow } from "../../src/ui/DiagnosticFlow.tsx";
import { RetryFlow } from "../../src/ui/exam/RetryFlow.tsx";
import { ProgressView } from "../../src/ui/ProgressView.tsx";
import { createLocalProgressRepo, type AttemptRecord } from "../../src/data/progressRepo.ts";

const noop = () => {};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

// Answer whatever question is on screen (radio → first option; numeric → type).
function answerCurrent() {
  const radios = screen.queryAllByRole("radio");
  if (radios.length > 0) {
    fireEvent.click(radios[0]);
  } else {
    fireEvent.change(screen.getByLabelText(/enter your answer/i), { target: { value: "24" } });
  }
}

describe("ExamFlow (board)", () => {
  it("config → start → answer → navigate → exit guard", () => {
    render(<ExamFlow mode="board" onExit={noop} />);
    // Config screen lists both sections; start NEC & Theory.
    fireEvent.click(screen.getByRole("button", { name: /NEC & Theory/i }));
    // Running.
    expect(screen.getByText(/Question 1 of/i)).toBeTruthy();
    const radios = screen.queryAllByRole("radio");
    if (radios.length > 0) {
      fireEvent.click(radios[0]);
      expect(radios[0].getAttribute("aria-checked")).toBe("true");
    } else {
      answerCurrent();
    }
    // Flag toggle.
    fireEvent.click(screen.getByRole("button", { name: /flag this to review later/i }));
    // Next.
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText(/Question 2 of/i)).toBeTruthy();
    // Home → exit-confirm dialog; Stay dismisses it.
    fireEvent.click(screen.getByRole("button", { name: /go to the home screen/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^stay$/i }));
  });
});

describe("DiagnosticFlow", () => {
  it("auto-starts, answers, shows the explanation, and continues", () => {
    render(<DiagnosticFlow onExit={noop} />);
    expect(screen.getByText(/Question 1 of 30/i)).toBeTruthy();
    answerCurrent();
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    // Explanation screen.
    expect(screen.getByText(/key idea/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(screen.getByText(/Question 2 of 30/i)).toBeTruthy();
  });
});

describe("RetryFlow", () => {
  it("shows the empty state when nothing has been missed", () => {
    render(<RetryFlow onExit={noop} />);
    expect(screen.getByText(/nothing to practice yet/i)).toBeTruthy();
  });
});

describe("ProgressView", () => {
  it("shows the empty state with no history", () => {
    render(<ProgressView onHome={noop} />);
    expect(screen.getByText(/my progress/i)).toBeTruthy();
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();
  });

  it("shows exam history and by-topic bars when there is progress", () => {
    const repo = createLocalProgressRepo();
    const stored = repo.load("wa-electrician-01");
    const attempt: AttemptRecord = {
      at: 1_700_000_000_000,
      kind: "board",
      section: "NEC & Theory",
      correct: 45,
      total: 60,
      scorePct: 0.75,
    };
    repo.save({
      ...stored,
      attempts: [attempt],
      mastery: {
        byDomain: { "nec.ampacity": { seen: 4, correct: 3, mastery: 0.6, variance: 0.02 } },
        bySkill: {},
        trapAccuracy: {},
      },
    });
    render(<ProgressView onHome={noop} />);
    expect(screen.getByText(/how you're doing by topic/i)).toBeTruthy();
    expect(screen.getByText(/your practice exams/i)).toBeTruthy();
    expect(screen.getByText(/75%/)).toBeTruthy();
  });
});
