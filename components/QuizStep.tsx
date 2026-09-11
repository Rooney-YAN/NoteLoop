"use client";

import { useMemo, useState } from "react";
import type { Question } from "@/lib/schemas";
import { completedAnswerCount, isAnswerComplete, type AnswerState, type DraftAnswer } from "@/lib/quiz";

const confidenceLabels = ["Completely unsure", "Guessing", "Mostly sure", "Very sure"];
const responseLabels = { single_choice: "Single choice", multiple_choice: "Multiple choice", short_answer: "Short answer" };
export type { AnswerState } from "@/lib/quiz";

export function QuizStep({ questions, answers, setAnswers, submitting, error, onBack, onSubmit }: {
  questions: Question[]; answers: AnswerState; setAnswers: (answers: AnswerState) => void; submitting: boolean; error: string; onBack: () => void; onSubmit: () => void;
}) {
  const [completionError, setCompletionError] = useState("");
  const completed = useMemo(() => completedAnswerCount(questions, answers), [questions, answers]);
  const update = (id: string, patch: Partial<DraftAnswer>) => setAnswers({ ...answers, [id]: { ...answers[id], ...patch } });
  const submit = () => {
    const firstIncomplete = questions.find((question) => !isAnswerComplete(question, answers[question.id]));
    if (firstIncomplete) {
      setCompletionError("Complete an answer and confidence level for every question.");
      document.getElementById(`question-${firstIncomplete.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`answer-${firstIncomplete.id}`)?.focus();
      return;
    }
    setCompletionError("");
    onSubmit();
  };

  return <section className="panel" aria-labelledby="quiz-title">
    <div className="panel-head"><div><h2 className="panel-title" id="quiz-title">Diagnostic quiz</h2><p className="panel-copy">Answer from memory. Choice questions have explicit options; short answers are graded against a hidden rubric.</p></div><div className="quiz-progress" aria-live="polite"><strong>{completed} / {questions.length}</strong><span>completed</span></div></div>
    <div className="panel-body"><div className="quiz-stack">{questions.map((question, index) => {
      const answer = answers[question.id];
      return <article className={`question-card ${completionError && !isAnswerComplete(question, answer) ? "question-incomplete" : ""}`} id={`question-${question.id}`} key={question.id}>
        <div className="question-head"><span className="question-index">Question {index + 1}</span><div className="question-chips"><span className="type-chip">{question.cognitiveType}</span><span className="response-chip">{responseLabels[question.responseType]}</span></div></div>
        <div className="question-topic">Topic · {question.topic}</div><p className="question-text">{question.question}</p>{question.code && <pre className="code"><code>{question.code}</code></pre>}
        {question.responseType === "short_answer" ? <><label className="section-label" htmlFor={`answer-${question.id}`}>Your answer</label><textarea className="answer" id={`answer-${question.id}`} maxLength={6000} value={answer?.answerText ?? ""} onChange={(event) => update(question.id, { answerText: event.target.value })} placeholder="Explain your reasoning…" /></> : <fieldset className="choice-fieldset" id={`answer-${question.id}`} tabIndex={-1}><legend className="section-label">{question.responseType === "single_choice" ? "Choose one option" : "Choose all that apply"}</legend><div className="choice-options">{question.options.map((option) => {
          const checked = question.responseType === "single_choice" ? answer?.selectedOptionId === option.id : Boolean(answer?.selectedOptionIds.includes(option.id));
          return <label className={`choice-option ${checked ? "selected" : ""}`} key={option.id}><input type={question.responseType === "single_choice" ? "radio" : "checkbox"} name={`answer-${question.id}`} value={option.id} checked={checked} onChange={(event) => {
            if (question.responseType === "single_choice") update(question.id, { selectedOptionId: option.id });
            else {
              const selected = answer?.selectedOptionIds ?? [];
              update(question.id, { selectedOptionIds: event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id) });
            }
          }} /><span className="option-id">{option.id}</span><span>{option.text}</span></label>;
        })}</div></fieldset>}
        <div className="confidence"><div className="confidence-label">Confidence</div><div className="confidence-options" role="group" aria-label={`Confidence for question ${index + 1}`}>{confidenceLabels.map((label, value) => <button type="button" key={label} className={`confidence-option ${answer?.confidence === value ? "selected" : ""}`} onClick={() => update(question.id, { confidence: value })} aria-pressed={answer?.confidence === value}><span>{value}</span>{label}</button>)}</div></div>
      </article>;
    })}</div>
      {(completionError || error) && <div className="error" role="alert">{completionError || error}</div>}
      <div className="actions"><button className="button button-secondary" type="button" onClick={onBack} disabled={submitting}>Back to coverage</button><button className="button button-primary" type="button" onClick={submit} data-incomplete={completed !== questions.length || undefined} disabled={submitting}>{submitting ? <span className="loading"><span className="spinner" />Diagnosing…</span> : error ? "Retry diagnosis" : "Submit answers"}</button></div>
    </div>
  </section>;
}
