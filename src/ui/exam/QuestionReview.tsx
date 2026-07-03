import type { ReviewItem } from "../../state/useExam.ts";

// Plain-language answer strings for a reviewed question.
function answerText(item: ReviewItem): { yours: string; correct: string } {
  const { question: q, response } = item;
  if (q.type === "numeric" && q.answer.kind === "numeric") {
    const yours = response?.kind === "numeric" ? `${response.value} ${q.answer.unit}` : "Left blank";
    return { yours, correct: `${q.answer.value} ${q.answer.unit}` };
  }
  const opts = q.options ?? [];
  const yourOpt = response?.kind === "single" ? opts.find((o) => o.id === response.optionId) : undefined;
  const correctOpt = opts.find((o) => o.isCorrect);
  return { yours: yourOpt ? yourOpt.text : "Left blank", correct: correctOpt ? correctOpt.text : "—" };
}

/** Expanded detail for one reviewed question: stem, answers, plain explanation. */
export function QuestionReview({ item }: { item: ReviewItem }) {
  const { yours, correct } = answerText(item);
  const q = item.question;
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-3 text-sm">
      <p className="text-slate-200">{q.stem}</p>

      <div className="mt-3 flex flex-col gap-1">
        <div className={item.correct ? "text-good" : "text-bad"}>
          Your answer: {yours}
          {item.correct ? " ✓" : ""}
        </div>
        {!item.correct && <div className="text-good">Correct answer: {correct}</div>}
      </div>

      <div className="mt-3 border-t border-line pt-2">
        <p className="text-slate-300">{q.solution.keyIdea}</p>
        {q.solution.steps.length > 0 && (
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs text-slate-400">
            {q.solution.steps.map((s, i) => (
              <li key={i}>{s.text}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
