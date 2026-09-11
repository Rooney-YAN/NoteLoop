import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuizStep } from "@/components/QuizStep";
import { createAnswerState, type AnswerState } from "@/lib/quiz";
import { completeAnswers, questions } from "./fixtures";

function QuizHarness({ submit = vi.fn() }: { submit?: () => void }) {
  const [answers, setAnswers] = useState<AnswerState>(() => createAnswerState(questions));
  return <QuizStep questions={questions} answers={answers} setAnswers={setAnswers} submitting={false} error="" onBack={() => undefined} onSubmit={submit} />;
}

describe("QuizStep", () => {
  it("renders radio, checkbox, and short-answer controls without revealing references", () => {
    render(<QuizHarness />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByText("Reference 1")).toBeNull();
    expect(screen.getByText("0 / 6")).toBeDefined();
  });

  it("blocks an incomplete submission and focuses the first question", async () => {
    const submit = vi.fn(); render(<QuizHarness submit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Complete an answer");
  });

  it("preserves answers when a diagnosis API error is displayed", () => {
    const answers = completeAnswers();
    render(<QuizStep questions={questions} answers={answers} setAnswers={() => undefined} submitting={false} error="Provider failed" onBack={() => undefined} onSubmit={() => undefined} />);
    expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(true);
    expect((screen.getAllByRole("textbox")[0] as HTMLTextAreaElement).value).toBe("Answer q5");
    expect(screen.getByRole("button", { name: "Retry diagnosis" })).toBeDefined();
  });
});
