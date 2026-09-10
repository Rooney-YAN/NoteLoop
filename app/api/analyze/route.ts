import { NextResponse } from "next/server";
import { analyzeRequestSchema, analysisSchema } from "@/lib/schemas";
import { buildAnalysisMessages } from "@/lib/prompts";
import { isDevelopmentMockMode, publicLlmError, requestValidatedJson } from "@/lib/llm";
import { mockAnalysis } from "@/lib/mock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The analysis request body must be valid JSON." }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Course material or notes are empty or exceed the input limit." }, { status: 400 });

  try {
    const { course, courseMaterial, notes } = parsed.data;
    if (process.env.NODE_ENV === "development") console.info(`[NoteLoop] analyze input lengths: material=${courseMaterial.length}, notes=${notes.length}`);
    if (isDevelopmentMockMode()) return NextResponse.json({ data: mockAnalysis(course, courseMaterial, notes), mockMode: true });
    const data = await requestValidatedJson("analyze", buildAnalysisMessages(course, courseMaterial, notes), analysisSchema, 5_000);
    return NextResponse.json({ data, mockMode: false });
  } catch (error) {
    return NextResponse.json({ error: publicLlmError(error) }, { status: 502 });
  }
}
