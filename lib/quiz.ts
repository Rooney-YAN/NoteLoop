import type { z } from "zod";
import { diagnosisSchema, type Diagnosis, type Question, type QuestionResult, type QuizAnswer } from "./schemas";

export type DraftAnswer = {
  responseType: Question["responseType"];
  selectedOptionId: string;
  selectedOptionIds: string[];
  answerText: string;
  confidence: number | null;
};
export type AnswerState = Record<string, DraftAnswer>;

export function createAnswerState(questions: Question[], current: AnswerState = {}): AnswerState {
  return Object.fromEntries(questions.map((question) => [question.id, current[question.id]?.responseType === question.responseType
    ? current[question.id]
    : { responseType: question.responseType, selectedOptionId: "", selectedOptionIds: [], answerText: "", confidence: null }]));
}

export function isAnswerComplete(question: Question, answer?: DraftAnswer) {
  if (!answer || answer.responseType !== question.responseType || answer.confidence === null) return false;
  if (question.responseType === "single_choice") return Boolean(answer.selectedOptionId);
  if (question.responseType === "multiple_choice") return answer.selectedOptionIds.length > 0;
  return Boolean(answer.answerText.trim());
}

export function completedAnswerCount(questions: Question[], answers: AnswerState) {
  return questions.filter((question) => isAnswerComplete(question, answers[question.id])).length;
}

export function toQuizAnswers(questions: Question[], answers: AnswerState): QuizAnswer[] {
  return questions.map((question) => {
    const answer = answers[question.id];
    if (!answer || answer.confidence === null) throw new Error("Every question needs an answer and confidence level.");
    if (question.responseType === "single_choice") return { questionId: question.id, responseType: question.responseType, selectedOptionId: answer.selectedOptionId, confidence: answer.confidence };
    if (question.responseType === "multiple_choice") return { questionId: question.id, responseType: question.responseType, selectedOptionIds: answer.selectedOptionIds, confidence: answer.confidence };
    return { questionId: question.id, responseType: question.responseType, answerText: answer.answerText.trim(), confidence: answer.confidence };
  });
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export function objectiveCorrectness(question: Question, answer: QuizAnswer) {
  if (question.responseType === "short_answer" || answer.responseType === "short_answer") return null;
  const selected = answer.responseType === "single_choice" ? [answer.selectedOptionId] : answer.selectedOptionIds;
  if (sameIds(selected, question.correctOptionIds)) return "correct" as const;
  if (question.responseType === "multiple_choice" && selected.some((id) => question.correctOptionIds.includes(id))) return "partial" as const;
  return "incorrect" as const;
}

export function createDiagnosisSchema(questions: Question[], answers: QuizAnswer[]): z.ZodType<Diagnosis> {
  return diagnosisSchema.superRefine((diagnosis, context) => {
    const resultsById = new Map(diagnosis.questionResults.map((result) => [result.questionId, result]));
    if (resultsById.size !== diagnosis.questionResults.length || questions.some((question) => !resultsById.has(question.id))) {
      context.addIssue({ code: "custom", path: ["questionResults"], message: "Each quiz question must have exactly one matching result." });
      return;
    }
    questions.forEach((question, index) => {
      const answer = answers.find((item) => item.questionId === question.id);
      const result = resultsById.get(question.id)!;
      const expected = answer ? objectiveCorrectness(question, answer) : null;
      if (expected && result.correctness !== expected) context.addIssue({ code: "custom", path: ["questionResults", index, "correctness"], message: `Choice grading must be ${expected}.` });
    });
  });
}

export function normalizeDiagnosis(diagnosis: Diagnosis, questions: Question[]): Diagnosis {
  const byId = new Map(diagnosis.questionResults.map((result) => [result.questionId, result]));
  return {
    ...diagnosis,
    questionResults: questions.map((question) => ({ ...byId.get(question.id)!, topic: question.topic, referenceAnswer: question.referenceAnswer })),
  };
}

export function formatStudentAnswer(question: Question, answer: DraftAnswer) {
  if (question.responseType === "short_answer") return answer.answerText;
  const selected = question.responseType === "single_choice" ? [answer.selectedOptionId] : answer.selectedOptionIds;
  return question.options.filter((option) => selected.includes(option.id)).map((option) => `${option.id}. ${option.text}`).join("\n");
}

export function patchFingerprint(markdown: string) {
  return markdown.toLowerCase().replace(/[`#>*_~\-]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function uniqueNeededResults(results: QuestionResult[], excludedIds: ReadonlySet<string> = new Set()) {
  const fingerprints = new Set<string>();
  return results.filter((result) => {
    if (!result.notePatch.needed || !result.notePatch.markdown.trim()) return false;
    const fingerprint = patchFingerprint(result.notePatch.markdown);
    if (!fingerprint || fingerprints.has(fingerprint)) return false;
    fingerprints.add(fingerprint);
    if (excludedIds.has(result.questionId)) return false;
    return true;
  });
}

export function equivalentPatchResults(allResults: QuestionResult[], requested: QuestionResult[]) {
  const fingerprints = new Set(requested.map((result) => patchFingerprint(result.notePatch.markdown)).filter(Boolean));
  return allResults.filter((result) => result.notePatch.needed && fingerprints.has(patchFingerprint(result.notePatch.markdown)));
}

export function appendPatches(notes: string, results: QuestionResult[]) {
  const existing = patchFingerprint(notes);
  const candidates = results.filter((result) => result.notePatch.needed && result.notePatch.markdown.trim());
  const unique = uniqueNeededResults(candidates).filter((result) => !existing.includes(patchFingerprint(result.notePatch.markdown)));
  const appliedQuestionIds = candidates.map((result) => result.questionId);
  if (!unique.length) return { notes, appliedQuestionIds };
  const body = unique.map((result) => `### ${result.topic}\n\n${result.notePatch.markdown.trim()}`).join("\n\n");
  const separator = notes.trim() ? "\n\n---\n\n" : "";
  return { notes: `${notes.trimEnd()}${separator}## NoteLoop patches\n\n${body}\n`, appliedQuestionIds };
}
