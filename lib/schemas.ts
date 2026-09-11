import { z } from "zod";

export const QUIZ_QUESTION_COUNT = 6;
export const importanceSchema = z.enum(["high", "medium", "low"]);
export const coverageStatusSchema = z.enum(["covered", "partial", "missing", "questionable", "redundant"]);
export const cognitiveTypeSchema = z.enum(["recall", "discrimination", "transfer"]);
export const responseTypeSchema = z.enum(["single_choice", "multiple_choice", "short_answer"]);
export const correctnessSchema = z.enum(["correct", "partial", "incorrect"]);
export const conceptStateSchema = z.enum(["SOLID", "KNOWLEDGE_GAP", "CONCEPTUAL_CONFUSION", "REASONING_GAP", "DETAIL_GAP", "CARELESS_ERROR"]);
export const patchActionSchema = z.enum(["ADD", "CORRECT", "CLARIFY", "NONE"]);

const optionSchema = z.object({ id: z.string().min(1).max(20), text: z.string().min(1).max(500) });

export const questionSchema = z.object({
  id: z.string().min(1).max(40),
  coverageTopicId: z.string().min(1).max(40),
  topic: z.string().min(1).max(160),
  cognitiveType: cognitiveTypeSchema,
  responseType: responseTypeSchema,
  question: z.string().min(1).max(1200),
  code: z.string().max(2500).nullable(),
  options: z.array(optionSchema).max(6),
  correctOptionIds: z.array(z.string().min(1).max(20)).max(6),
  evaluationCriteria: z.array(z.string().min(1).max(400)).min(1).max(8),
  referenceAnswer: z.string().min(1).max(1800),
}).superRefine((question, context) => {
  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) context.addIssue({ code: "custom", path: ["options"], message: "Option IDs must be unique." });
  if (new Set(question.correctOptionIds).size !== question.correctOptionIds.length || question.correctOptionIds.some((id) => !optionIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["correctOptionIds"], message: "Correct option IDs must be unique and reference existing options." });
  }
  if (question.responseType === "short_answer") {
    if (question.options.length || question.correctOptionIds.length) context.addIssue({ code: "custom", path: ["options"], message: "Short-answer questions cannot contain options or correct option IDs." });
  } else {
    if (question.options.length < 2) context.addIssue({ code: "custom", path: ["options"], message: "Choice questions need at least two options." });
    if (question.responseType === "single_choice" && question.correctOptionIds.length !== 1) context.addIssue({ code: "custom", path: ["correctOptionIds"], message: "Single-choice questions need exactly one correct option." });
    if (question.responseType === "multiple_choice" && question.correctOptionIds.length < 1) context.addIssue({ code: "custom", path: ["correctOptionIds"], message: "Multiple-choice questions need at least one correct option." });
  }
});

export const questionsSchema = z.array(questionSchema).length(QUIZ_QUESTION_COUNT).superRefine((questions, context) => {
  const ids = questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Question IDs must be unique." });
  (["single_choice", "multiple_choice", "short_answer"] as const).forEach((responseType) => {
    if (questions.filter((question) => question.responseType === responseType).length !== 2) context.addIssue({ code: "custom", message: `Quiz must contain exactly two ${responseType} questions.` });
  });
});

export const analysisSchema = z.object({
  lectureTitle: z.string().min(1).max(180),
  outline: z.array(z.object({ topic: z.string().min(1).max(160), importance: importanceSchema })).min(1).max(30),
  coverage: z.array(z.object({ id: z.string().min(1).max(40), topic: z.string().min(1).max(160), status: coverageStatusSchema, comment: z.string().min(1).max(600) })).min(1).max(40),
  possibleErrors: z.array(z.object({ coverageTopicId: z.string().min(1).max(40), topic: z.string().min(1).max(160), comment: z.string().min(1).max(600) })).max(20),
  redundancy: z.array(z.object({ coverageTopicId: z.string().min(1).max(40), topic: z.string().min(1).max(160), comment: z.string().min(1).max(600) })).max(20),
  questions: questionsSchema,
}).superRefine((analysis, context) => {
  const topicIds = analysis.coverage.map((item) => item.id);
  if (new Set(topicIds).size !== topicIds.length) context.addIssue({ code: "custom", path: ["coverage"], message: "Coverage topic IDs must be unique." });
  analysis.questions.forEach((question, index) => {
    if (!topicIds.includes(question.coverageTopicId)) context.addIssue({ code: "custom", path: ["questions", index, "coverageTopicId"], message: "Question must reference an existing coverage topic." });
  });
  [...analysis.possibleErrors, ...analysis.redundancy].forEach((item) => {
    if (!topicIds.includes(item.coverageTopicId)) context.addIssue({ code: "custom", path: ["coverageTopicId"], message: "Item must reference an existing coverage topic." });
  });
});

export const notePatchSchema = z.object({
  needed: z.boolean(), action: patchActionSchema, markdown: z.string().max(1600), reason: z.string().min(1).max(400),
}).superRefine((patch, context) => {
  if (!patch.needed && (patch.action !== "NONE" || patch.markdown !== "")) context.addIssue({ code: "custom", message: "An unnecessary patch must use NONE and an empty markdown string." });
  if (patch.needed && (patch.action === "NONE" || !patch.markdown.trim())) context.addIssue({ code: "custom", message: "A needed patch must have an action and non-empty markdown." });
});

export const questionResultSchema = z.object({
  questionId: z.string().min(1).max(40), topic: z.string().min(1).max(160), correctness: correctnessSchema,
  diagnosis: conceptStateSchema, explanation: z.string().min(1).max(600), referenceAnswer: z.string().min(1).max(1800), notePatch: notePatchSchema,
});

export const diagnosisSchema = z.object({
  questionResults: z.array(questionResultSchema).length(QUIZ_QUESTION_COUNT),
  conceptStates: z.array(z.object({ topic: z.string().min(1).max(160), state: conceptStateSchema, reason: z.string().min(1).max(600) })).min(1).max(30),
  reviewAgain: z.array(z.string().min(1).max(200)).max(30),
  unstable: z.array(z.string().min(1).max(200)).max(30),
  solid: z.array(z.string().min(1).max(200)).max(30),
});

export const analyzeRequestSchema = z.object({
  course: z.enum(["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"]),
  courseMaterial: z.string().min(1).max(240_000), notes: z.string().min(1).max(80_000),
});

const answerBase = { questionId: z.string().min(1).max(40), confidence: z.number().int().min(0).max(3) };
export const quizAnswerSchema = z.discriminatedUnion("responseType", [
  z.object({ ...answerBase, responseType: z.literal("single_choice"), selectedOptionId: z.string().min(1).max(20) }),
  z.object({ ...answerBase, responseType: z.literal("multiple_choice"), selectedOptionIds: z.array(z.string().min(1).max(20)).min(1).max(6) }),
  z.object({ ...answerBase, responseType: z.literal("short_answer"), answerText: z.string().trim().min(1).max(6000) }),
]);

export const diagnoseRequestSchema = z.object({
  course: z.enum(["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"]),
  coverage: analysisSchema.shape.coverage, possibleErrors: analysisSchema.shape.possibleErrors,
  questions: questionsSchema, answers: z.array(quizAnswerSchema).length(QUIZ_QUESTION_COUNT),
}).superRefine((data, context) => {
  const answersById = new Map(data.answers.map((answer) => [answer.questionId, answer]));
  if (answersById.size !== data.answers.length || data.questions.some((question) => !answersById.has(question.id))) {
    context.addIssue({ code: "custom", path: ["answers"], message: "Each question must have exactly one matching answer." });
    return;
  }
  data.questions.forEach((question, index) => {
    const answer = answersById.get(question.id)!;
    if (answer.responseType !== question.responseType) {
      context.addIssue({ code: "custom", path: ["answers", index, "responseType"], message: "Answer type must match its question." });
      return;
    }
    const optionIds = question.options.map((option) => option.id);
    if (answer.responseType === "single_choice" && !optionIds.includes(answer.selectedOptionId)) context.addIssue({ code: "custom", path: ["answers", index, "selectedOptionId"], message: "Selected option must exist on the question." });
    if (answer.responseType === "multiple_choice" && (new Set(answer.selectedOptionIds).size !== answer.selectedOptionIds.length || answer.selectedOptionIds.some((id) => !optionIds.includes(id)))) {
      context.addIssue({ code: "custom", path: ["answers", index, "selectedOptionIds"], message: "Selected options must be unique and exist on the question." });
    }
  });
});

export type Analysis = z.infer<typeof analysisSchema>;
export type Diagnosis = z.infer<typeof diagnosisSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;
export type QuestionResult = z.infer<typeof questionResultSchema>;
export type CoverageItem = Analysis["coverage"][number];
export type ConceptState = z.infer<typeof conceptStateSchema>;
