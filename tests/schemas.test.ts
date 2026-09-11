import { describe, expect, it } from "vitest";
import { diagnoseRequestSchema, diagnosisSchema, questionSchema } from "@/lib/schemas";
import { createDiagnosisSchema, toQuizAnswers } from "@/lib/quiz";
import { completeAnswers, diagnosis, questions } from "./fixtures";

describe("quiz schemas", () => {
  it("validates the three answer shapes and existing option IDs", () => {
    const answers = toQuizAnswers(questions, completeAnswers());
    expect(diagnoseRequestSchema.safeParse({
      course: "General", coverage: questions.map((q) => ({ id: q.coverageTopicId, topic: q.topic, status: "missing", comment: "Test it." })),
      possibleErrors: [], questions, answers,
    }).success).toBe(true);
    const invalid = answers.map((answer) => answer.questionId === "q1" && answer.responseType === "single_choice" ? { ...answer, selectedOptionId: "Z" } : answer);
    expect(diagnoseRequestSchema.safeParse({ course: "General", coverage: questions.map((q) => ({ id: q.coverageTopicId, topic: q.topic, status: "missing", comment: "Test it." })), possibleErrors: [], questions, answers: invalid }).success).toBe(false);
  });

  it("rejects malformed choice options", () => {
    expect(questionSchema.safeParse({ ...questions[0], correctOptionIds: ["Z"] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...questions[0], options: [{ id: "A", text: "One" }, { id: "A", text: "Two" }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...questions[4], options: [{ id: "A", text: "Leak" }] }).success).toBe(false);
  });

  it("enforces patch cross-field constraints", () => {
    const badNone = structuredClone(diagnosis); badNone.questionResults[0].notePatch = { needed: false, action: "NONE", markdown: "still present", reason: "bad" };
    const badNeeded = structuredClone(diagnosis); badNeeded.questionResults[0].notePatch = { needed: true, action: "NONE", markdown: "", reason: "bad" };
    expect(diagnosisSchema.safeParse(badNone).success).toBe(false);
    expect(diagnosisSchema.safeParse(badNeeded).success).toBe(false);
  });

  it("requires exactly one result per question and deterministic choice grading", () => {
    const answers = toQuizAnswers(questions, completeAnswers());
    expect(createDiagnosisSchema(questions, answers).safeParse(diagnosis).success).toBe(true);
    const duplicate = structuredClone(diagnosis); duplicate.questionResults[1].questionId = "q1";
    expect(createDiagnosisSchema(questions, answers).safeParse(duplicate).success).toBe(false);
    const wrongGrade = structuredClone(diagnosis); wrongGrade.questionResults[0].correctness = "incorrect";
    expect(createDiagnosisSchema(questions, answers).safeParse(wrongGrade).success).toBe(false);
  });
});
