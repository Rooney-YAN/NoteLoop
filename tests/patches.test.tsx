import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DiagnosisStep } from "@/components/DiagnosisStep";
import { appendPatches, equivalentPatchResults, uniqueNeededResults } from "@/lib/quiz";
import type { QuestionResult } from "@/lib/schemas";
import { completeAnswers, diagnosis, questions } from "./fixtures";

describe("note patch workflow", () => {
  it("deduplicates equal patches and avoids applying existing content", () => {
    expect(uniqueNeededResults(diagnosis.questionResults)).toHaveLength(1);
    expect(appendPatches("Remember the invariant.", diagnosis.questionResults).notes).toBe("Remember the invariant.");
    expect(equivalentPatchResults(diagnosis.questionResults, [diagnosis.questionResults[0]])).toHaveLength(2);
  });

  it("supports apply, apply selected, and undo", async () => {
    function Harness() {
      const [notes, setNotes] = useState("Original notes");
      const [applied, setApplied] = useState(new Set<string>());
      const [history, setHistory] = useState<Array<{ notes: string; applied: Set<string> }>>([]);
      const apply = (results: QuestionResult[]) => {
        const next = appendPatches(notes, results); if (!next.appliedQuestionIds.length) return;
        setHistory((value) => [...value, { notes, applied: new Set(applied) }]); setNotes(next.notes); setApplied(new Set([...applied, ...next.appliedQuestionIds]));
      };
      const undo = () => { const prior = history.at(-1); if (!prior) return; setNotes(prior.notes); setApplied(prior.applied); setHistory((value) => value.slice(0, -1)); };
      return <><output data-testid="notes">{notes}</output><DiagnosisStep diagnosis={diagnosis} questions={questions} answers={completeAnswers()} appliedPatchIds={applied} canUndo={Boolean(history.length)} onApply={apply} onUndo={undo} onBack={() => undefined} onReset={() => undefined} /></>;
    }
    render(<Harness />);
    expect(screen.getByText("1 unique patches selected")).toBeDefined();
    await userEvent.click(screen.getAllByRole("button", { name: "Apply to notes" })[0]);
    expect(screen.getByTestId("notes").textContent).toContain("NoteLoop patches");
    await userEvent.click(screen.getByRole("button", { name: "Undo last apply" }));
    expect(screen.getByTestId("notes").textContent).toBe("Original notes");
    await userEvent.click(screen.getByRole("button", { name: "Apply all selected" }));
    expect(screen.getByTestId("notes").textContent).toContain("Remember the invariant");
  });
});
