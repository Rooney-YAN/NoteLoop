import type { Diagnosis, Question } from "@/lib/schemas";
import { createAnswerState, type AnswerState } from "@/lib/quiz";

const base = (index: number, responseType: Question["responseType"]): Question => ({
  id: `q${index}`,
  coverageTopicId: `topic-${index}`,
  topic: `Topic ${index}`,
  cognitiveType: index % 3 === 1 ? "recall" : index % 3 === 2 ? "discrimination" : "transfer",
  responseType,
  question: `Question text ${index}?`,
  code: null,
  options: responseType === "short_answer" ? [] : [{ id: "A", text: "Alpha" }, { id: "B", text: "Beta" }, { id: "C", text: "Gamma" }],
  correctOptionIds: responseType === "single_choice" ? ["A"] : responseType === "multiple_choice" ? ["A", "B"] : [],
  evaluationCriteria: ["Accurate core idea"],
  referenceAnswer: `Reference ${index}`,
});

export const questions: Question[] = [base(1, "single_choice"), base(2, "single_choice"), base(3, "multiple_choice"), base(4, "multiple_choice"), base(5, "short_answer"), base(6, "short_answer")];

export function completeAnswers(): AnswerState {
  const answers = createAnswerState(questions);
  questions.forEach((question) => {
    answers[question.id].confidence = 2;
    if (question.responseType === "single_choice") answers[question.id].selectedOptionId = "A";
    else if (question.responseType === "multiple_choice") answers[question.id].selectedOptionIds = ["A", "B"];
    else answers[question.id].answerText = `Answer ${question.id}`;
  });
  return answers;
}

export const diagnosis: Diagnosis = {
  questionResults: questions.map((question, index) => ({
    questionId: question.id,
    topic: question.topic,
    correctness: "correct",
    diagnosis: "SOLID",
    explanation: `Explanation ${index + 1}`,
    referenceAnswer: question.referenceAnswer,
    notePatch: index < 2
      ? { needed: true, action: "ADD", markdown: index === 0 ? "Remember the invariant." : "Remember the invariant.", reason: "Useful reference." }
      : { needed: false, action: "NONE", markdown: "", reason: "Already understood." },
  })),
  conceptStates: [{ topic: "Topic 1", state: "SOLID", reason: "Answered correctly." }],
  reviewAgain: [], unstable: [], solid: ["Topic 1"],
};
