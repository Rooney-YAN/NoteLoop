"use client";

import { useMemo, useState } from "react";
import type { Diagnosis, Question, QuestionResult } from "@/lib/schemas";
import { formatStudentAnswer, uniqueNeededResults, type AnswerState } from "@/lib/quiz";

function ReviewBox({ title, items, className }: { title: string; items: string[]; className: string }) {
  return <div className={`review-box ${className}`}><h3>{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <div className="empty-copy">None right now.</div>}</div>;
}

export function DiagnosisStep({ diagnosis, questions, answers, appliedPatchIds, canUndo, onApply, onUndo, onBack, onReset }: {
  diagnosis: Diagnosis; questions: Question[]; answers: AnswerState; appliedPatchIds: Set<string>; canUndo: boolean;
  onApply: (results: QuestionResult[]) => void; onUndo: () => void; onBack: () => void; onReset: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(diagnosis.questionResults.filter((result) => result.notePatch.needed).map((result) => result.questionId)));
  const [copiedId, setCopiedId] = useState("");
  const selected = useMemo(() => uniqueNeededResults(diagnosis.questionResults.filter((result) => selectedIds.has(result.questionId)), appliedPatchIds), [diagnosis, selectedIds, appliedPatchIds]);
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(id); window.setTimeout(() => setCopiedId(""), 1800); } catch { setCopiedId(""); }
  };
  const copyAll = () => copy(selected.map((result) => `### ${result.topic}\n\n${result.notePatch.markdown}`).join("\n\n"), "all");
  const toggleSelected = (id: string, checked: boolean) => setSelectedIds((current) => {
    const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next;
  });

  return <section className="panel" aria-labelledby="diagnosis-title">
    <div className="panel-head"><div><h2 className="panel-title" id="diagnosis-title">Knowledge diagnosis</h2><p className="panel-copy">Each answer is graded separately and linked to one small, optional note patch.</p></div><span className="mode-chip">{diagnosis.questionResults.length} results</span></div>
    <div className="panel-body">
      <div className="bulk-patch-bar"><div><strong>{selected.length} unique patches selected</strong><span>Applying appends to your notes and never overwrites them.</span></div><div className="bulk-actions"><button className="copy-button" type="button" onClick={copyAll} disabled={!selected.length}>{copiedId === "all" ? "Copied all" : "Copy all selected"}</button><button className="button button-primary button-compact" type="button" onClick={() => onApply(selected)} disabled={!selected.length}>Apply all selected</button><button className="button button-secondary button-compact" type="button" onClick={onUndo} disabled={!canUndo}>Undo last apply</button></div></div>

      <div className="result-stack">{diagnosis.questionResults.map((result, index) => {
        const question = questions.find((item) => item.id === result.questionId)!;
        const answer = answers[result.questionId];
        const applied = appliedPatchIds.has(result.questionId);
        const selectable = result.notePatch.needed && !applied;
        return <article className="result-card" key={result.questionId}>
          <div className="result-card-head"><div><span className="question-index">Question {index + 1}</span><h3>{question.question}</h3><div className="question-topic">Topic · {result.topic}</div></div><div className="result-badges"><span className={`correctness-chip correctness-${result.correctness}`}>{result.correctness}</span><span className={`state-chip state-${result.diagnosis.toLowerCase()}`}>{result.diagnosis.replaceAll("_", " ")}</span></div></div>
          {question.code && <pre className="code"><code>{question.code}</code></pre>}
          <div className="answer-review-grid"><div><span className="section-label">Your answer</span><pre className="answer-review">{formatStudentAnswer(question, answer)}</pre><span className="confidence-summary">Confidence: {answer.confidence} · {confidenceLabels(answer.confidence)}</span></div><div><span className="section-label">Reference answer</span><p>{result.referenceAnswer}</p></div></div>
          <div className="diagnosis-explanation"><strong>Diagnosis</strong><p>{result.explanation}</p></div>
          <div className={`inline-patch ${result.notePatch.needed ? "needed" : "not-needed"}`}><div className="inline-patch-head"><div><strong>{result.notePatch.needed ? `${result.notePatch.action} note patch` : "No note change needed"}</strong><p>{result.notePatch.reason}</p></div>{selectable && <label className="patch-select"><input type="checkbox" checked={selectedIds.has(result.questionId)} onChange={(event) => toggleSelected(result.questionId, event.target.checked)} />Include</label>}{applied && <span className="applied-chip">Applied</span>}</div>
            {result.notePatch.needed && <><pre>{result.notePatch.markdown}</pre><div className="inline-patch-actions"><button className="copy-button" type="button" onClick={() => copy(result.notePatch.markdown, result.questionId)}>{copiedId === result.questionId ? "Copied" : "Copy this patch"}</button><button className="copy-button" type="button" onClick={() => onApply([result])} disabled={applied}>{applied ? "Applied" : "Apply to notes"}</button><button className="link-button" type="button" onClick={() => toggleSelected(result.questionId, false)} disabled={applied || !selectedIds.has(result.questionId)}>Skip</button></div></>}
          </div>
        </article>;
      })}</div>

      <span className="section-label diagnosis-summary-label">Topic summary</span><div className="concept-stack">{diagnosis.conceptStates.map((item, index) => <div className="concept-row" key={`${item.topic}-${index}`}><strong>{item.topic}</strong><span className={`state-chip state-${item.state.toLowerCase()}`}>{item.state.replaceAll("_", " ")}</span><p>{item.reason}</p></div>)}</div>
      <div className="review-grid diagnosis-review-grid"><ReviewBox title="Review again" items={diagnosis.reviewAgain} className="review-again" /><ReviewBox title="Unstable" items={diagnosis.unstable} className="review-unstable" /><ReviewBox title="Solid" items={diagnosis.solid} className="review-solid" /></div>
      <div className="actions"><button className="button button-secondary" type="button" onClick={onBack}>Edit answers & re-diagnose</button><button className="button button-secondary" type="button" onClick={onReset}>Start a new analysis</button></div>
    </div>
  </section>;
}

function confidenceLabels(confidence: number | null) {
  return confidence === 0 ? "Completely unsure" : confidence === 1 ? "Guessing" : confidence === 2 ? "Mostly sure" : "Very sure";
}
