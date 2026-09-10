import { NextResponse } from "next/server";
import { diagnoseRequestSchema, diagnosisSchema } from "@/lib/schemas";
import { buildDiagnosisMessages } from "@/lib/prompts";
import { isDevelopmentMockMode, publicLlmError, requestValidatedJson } from "@/lib/llm";
import { mockDiagnosis } from "@/lib/mock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The diagnosis request body must be valid JSON." }, { status: 400 });
  }

  const parsed = diagnoseRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Quiz answers or diagnostic data are invalid." }, { status: 400 });

  try {
    const { course, coverage, possibleErrors, questions, answers } = parsed.data;
    if (process.env.NODE_ENV === "development") console.info(`[NoteLoop] diagnose input: questions=${questions.length}, answerChars=${answers.reduce((sum, item) => sum + item.answer.length, 0)}`);
    if (isDevelopmentMockMode()) return NextResponse.json({ data: mockDiagnosis({ coverage, questions }, answers), mockMode: true });
    const data = await requestValidatedJson("diagnose", buildDiagnosisMessages(course, { coverage, possibleErrors, questions }, answers), diagnosisSchema, 4_000);
    return NextResponse.json({ data, mockMode: false });
  } catch (error) {
    return NextResponse.json({ error: publicLlmError(error) }, { status: 502 });
  }
}
