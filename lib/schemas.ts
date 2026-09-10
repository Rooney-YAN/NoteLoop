import { z } from "zod";

export const importanceSchema = z.enum(["high", "medium", "low"]);
export const coverageStatusSchema = z.enum(["covered", "partial", "missing", "questionable", "redundant"]);
export const questionTypeSchema = z.enum(["recall", "discrimination", "transfer"]);
export const correctnessSchema = z.enum(["correct", "partial", "incorrect"]);
export const conceptStateSchema = z.enum(["SOLID", "KNOWLEDGE_GAP", "CONCEPTUAL_CONFUSION", "REASONING_GAP", "DETAIL_GAP", "CARELESS_ERROR"]);

const questionsSchema = z.array(z.object({
  id: z.string().min(1).max(40),
  topic: z.string().min(1).max(160),
  type: questionTypeSchema,
  question: z.string().min(1).max(1200),
  code: z.string().max(2500).nullable().optional(),
  evaluationCriteria: z.array(z.string().min(1).max(400)).min(1).max(8),
  referenceAnswer: z.string().min(1).max(1800),
})).min(4).max(10).refine(
  (questions) => new Set(questions.map((question) => question.id)).size === questions.length,
  { message: "Question IDs must be unique." },
);

export const analysisSchema = z.object({
  lectureTitle: z.string().min(1).max(180),
  outline: z.array(z.object({ topic: z.string().min(1).max(160), importance: importanceSchema })).min(1).max(30),
  coverage: z.array(z.object({ topic: z.string().min(1).max(160), status: coverageStatusSchema, comment: z.string().min(1).max(600) })).min(1).max(40),
  possibleErrors: z.array(z.object({ topic: z.string().min(1).max(160), comment: z.string().min(1).max(600) })).max(20),
  redundancy: z.array(z.object({ topic: z.string().min(1).max(160), comment: z.string().min(1).max(600) })).max(20),
  questions: questionsSchema,
});

export const diagnosisSchema = z.object({
  questionResults: z.array(z.object({
    questionId: z.string().min(1).max(40),
    correctness: correctnessSchema,
    diagnosis: conceptStateSchema,
    explanation: z.string().min(1).max(600),
  })).min(1).max(12),
  conceptStates: z.array(z.object({
    topic: z.string().min(1).max(160),
    state: conceptStateSchema,
    reason: z.string().min(1).max(600),
  })).min(1).max(30),
  notePatchMarkdown: z.string().max(8000),
  reviewAgain: z.array(z.string().min(1).max(200)).max(30),
  unstable: z.array(z.string().min(1).max(200)).max(30),
  solid: z.array(z.string().min(1).max(200)).max(30),
});

export const analyzeRequestSchema = z.object({
  course: z.enum(["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"]),
  courseMaterial: z.string().min(1).max(240_000),
  notes: z.string().min(1).max(80_000),
});

export const diagnoseRequestSchema = z.object({
  course: z.enum(["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"]),
  coverage: analysisSchema.shape.coverage,
  possibleErrors: analysisSchema.shape.possibleErrors,
  questions: analysisSchema.shape.questions,
  answers: z.array(z.object({ questionId: z.string().min(1).max(40), answer: z.string().trim().min(1).max(6000), confidence: z.number().int().min(0).max(3) })).min(1).max(10),
}).superRefine((data, context) => {
  const questionIds = data.questions.map((question) => question.id);
  const answerIds = data.answers.map((answer) => answer.questionId);
  const sameIds = questionIds.length === answerIds.length
    && new Set(answerIds).size === answerIds.length
    && questionIds.every((id) => answerIds.includes(id));
  if (!sameIds) context.addIssue({ code: "custom", path: ["answers"], message: "Each question must have exactly one matching answer." });
});

export type Analysis = z.infer<typeof analysisSchema>;
export type Diagnosis = z.infer<typeof diagnosisSchema>;
export type Question = Analysis["questions"][number];
export type CoverageItem = Analysis["coverage"][number];
export type ConceptState = z.infer<typeof conceptStateSchema>;
