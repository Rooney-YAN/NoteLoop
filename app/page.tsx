"use client";

import { useEffect, useRef, useState } from "react";
import { ApiSetup } from "@/components/ApiSetup";
import { InputStep } from "@/components/InputStep";
import { CoverageStep } from "@/components/CoverageStep";
import { QuizStep, type AnswerState } from "@/components/QuizStep";
import { DiagnosisStep } from "@/components/DiagnosisStep";
import { isCourseId, type CourseId } from "@/lib/courseProfiles";
import { buildAnalysisMessages, buildDiagnosisMessages } from "@/lib/prompts";
import { analysisSchema, analyzeRequestSchema, diagnosisSchema, diagnoseRequestSchema, type Analysis, type Diagnosis } from "@/lib/schemas";
import { DEFAULT_BROWSER_LLM_CONFIG, PROVIDER_DEFAULTS, publicBrowserLlmError, type BrowserLlmConfig, type ProviderPreset } from "@/lib/browserLlm";

type Step = 1 | 2 | 3 | 4;
type PdfInfo = { name: string; characters: number; pages: number; warnings: string[] } | null;

function readStoredValue(storage: Storage, key: string) {
  try { return storage.getItem(key); } catch { return null; }
}

function writeStoredValue(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value); } catch { /* Persistence is optional. */ }
}

function removeStoredValue(storage: Storage, key: string) {
  try { storage.removeItem(key); } catch { /* Persistence is optional. */ }
}

function restoredProvider(value: string | null, baseURL: string | null): ProviderPreset {
  if (value === "openai" || value === "deepseek" || value === "custom") return value;
  try {
    const hostname = new URL(baseURL ?? "").hostname.toLowerCase();
    if (hostname === "api.deepseek.com") return "deepseek";
    if (hostname === "api.openai.com") return "openai";
    if (hostname) return "custom";
  } catch { /* Invalid old settings fall back to OpenAI. */ }
  return "openai";
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [course, setCourse] = useState<CourseId>("COMP2012");
  const [notes, setNotes] = useState("");
  const [courseMaterial, setCourseMaterial] = useState("");
  const [pdfInfo, setPdfInfo] = useState<PdfInfo>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [extracting, setExtracting] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [apiConfig, setApiConfig] = useState<BrowserLlmConfig>(DEFAULT_BROWSER_LLM_CONFIG);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const savedCourse = readStoredValue(window.localStorage, "noteloop.course");
    const savedNotes = readStoredValue(window.localStorage, "noteloop.notes");
    const savedBaseURL = readStoredValue(window.localStorage, "noteloop.api.baseURL");
    const savedAnalyzeModel = readStoredValue(window.localStorage, "noteloop.api.analyzeModel");
    const savedDiagnoseModel = readStoredValue(window.localStorage, "noteloop.api.diagnoseModel");
    const savedProvider = readStoredValue(window.localStorage, "noteloop.api.provider");
    const savedKey = readStoredValue(window.sessionStorage, "noteloop.api.key");
    const timer = window.setTimeout(() => {
      if (savedCourse && isCourseId(savedCourse)) setCourse(savedCourse);
      if (savedNotes) setNotes(savedNotes);
      const provider = restoredProvider(savedProvider, savedBaseURL);
      const defaults = provider === "custom" ? DEFAULT_BROWSER_LLM_CONFIG : PROVIDER_DEFAULTS[provider];
      setApiConfig({
        apiKey: savedKey ?? "",
        provider,
        baseURL: provider === "custom" ? savedBaseURL || defaults.baseURL : defaults.baseURL,
        analyzeModel: provider === "custom" ? savedAnalyzeModel || defaults.analyzeModel : defaults.analyzeModel,
        diagnoseModel: provider === "custom" ? savedDiagnoseModel || defaults.diagnoseModel : defaults.diagnoseModel,
      });
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { if (storageReady) writeStoredValue(window.localStorage, "noteloop.course", course); }, [course, storageReady]);
  useEffect(() => { if (!storageReady) return; const timer = window.setTimeout(() => writeStoredValue(window.localStorage, "noteloop.notes", notes), 250); return () => window.clearTimeout(timer); }, [notes, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    if (apiConfig.apiKey) writeStoredValue(window.sessionStorage, "noteloop.api.key", apiConfig.apiKey);
    else removeStoredValue(window.sessionStorage, "noteloop.api.key");
    writeStoredValue(window.localStorage, "noteloop.api.provider", apiConfig.provider);
    writeStoredValue(window.localStorage, "noteloop.api.baseURL", apiConfig.baseURL);
    writeStoredValue(window.localStorage, "noteloop.api.analyzeModel", apiConfig.analyzeModel);
    writeStoredValue(window.localStorage, "noteloop.api.diagnoseModel", apiConfig.diagnoseModel);
  }, [apiConfig, storageReady]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "stage_study_note",
      title: "Stage study note",
      description: "Select a supported course and place a note draft into NoteLoop's visible input step. A PDF and API key still need to be chosen by the student.",
      inputSchema: { type: "object", properties: { course: { type: "string", enum: ["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"] }, notes: { type: "string", maxLength: 80000 } }, required: ["course", "notes"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object") throw new Error("Expected course and notes.");
        const candidate = input as { course?: unknown; notes?: unknown };
        if (typeof candidate.course !== "string" || !isCourseId(candidate.course)) throw new Error("Unsupported course.");
        if (typeof candidate.notes !== "string" || candidate.notes.length > 80_000) throw new Error("Notes must be text under 80,000 characters.");
        setCourse(candidate.course); setNotes(candidate.notes); setStep(1); setAnalysis(null); setDiagnosis(null); setAnswers({}); setError("");
        return { course: candidate.course, noteCharacters: candidate.notes.length, inputStepReady: true, pdfRequired: !pdfInfo, apiKeyRequired: !apiConfig.apiKey };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [pdfInfo, apiConfig.apiKey]);

  const onPdf = async (file: File) => {
    setExtracting(true); setError(""); setPdfInfo(null); setCourseMaterial("");
    try {
      const { extractPdfText, LONG_SOURCE_WARNING_CHARS, MAX_PDF_BYTES, NEAR_EMPTY_CHARS } = await import("@/lib/pdf");
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Unsupported course material. Please upload a PDF.");
      if (!file.size) throw new Error("The selected PDF is empty.");
      if (file.size > MAX_PDF_BYTES) throw new Error("The PDF is larger than 15 MB. Split it into a smaller lecture or section.");
      const { text, pages } = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      const warnings: string[] = [];
      if (text.length < NEAR_EMPTY_CHARS) warnings.push("Very little text was extracted. This may be an image-only PDF; OCR is not included in this demo.");
      if (text.length > LONG_SOURCE_WARNING_CHARS) warnings.push("This is an unusually long source. Analysis may be slower or cost more; consider using one lecture or section at a time.");
      setCourseMaterial(text); setPdfInfo({ name: file.name, characters: text.length, pages, warnings });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not read that PDF.";
      setError(/limit|timed out|characters|pages|PDF|course material/i.test(message) ? message : "Could not extract text from this PDF. It may be damaged, encrypted, or image-only.");
    } finally { setExtracting(false); }
  };

  const onNotesFile = async (file: File) => {
    setError("");
    if (!/\.(md|txt)$/i.test(file.name)) { setError("Notes must be a .md or .txt file."); return; }
    if (file.size > 500_000) { setError("The notes file is too large. Keep the note under 80,000 characters."); return; }
    try {
      const text = await file.text();
      if (text.length > 80_000) { setError("The notes file exceeds the 80,000-character limit."); return; }
      setNotes(text);
    } catch { setError("Could not read that notes file. Try a plain UTF-8 .md or .txt file."); }
  };

  const onAnalyze = async () => {
    if (requestInFlight.current) return;
    const input = analyzeRequestSchema.safeParse({ course, courseMaterial, notes });
    if (!input.success) { setError("Choose a readable PDF and add your own notes before analysis."); return; }
    requestInFlight.current = true; setWorking(true); setError("");
    try {
      const { requestValidatedJson } = await import("@/lib/browserLlm");
      const data = await requestValidatedJson("analyze", buildAnalysisMessages(course, courseMaterial, notes), analysisSchema, 5_000, apiConfig);
      setAnalysis(data); setDiagnosis(null); setAnswers({}); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(publicBrowserLlmError(caught)); }
    finally { requestInFlight.current = false; setWorking(false); }
  };

  const startQuiz = () => {
    if (!analysis) return;
    setAnswers((current) => analysis.questions.every((question) => current[question.id]) ? current : Object.fromEntries(analysis.questions.map((question) => [question.id, { answer: "", confidence: null }])));
    setError(""); setStep(3); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitAnswers = async () => {
    if (!analysis || requestInFlight.current) return;
    const answerList = analysis.questions.map((question) => ({ questionId: question.id, answer: answers[question.id]?.answer ?? "", confidence: answers[question.id]?.confidence ?? 0 }));
    const input = diagnoseRequestSchema.safeParse({ course, coverage: analysis.coverage, possibleErrors: analysis.possibleErrors, questions: analysis.questions, answers: answerList });
    if (!input.success) { setError("Answer every question and choose a confidence level before submitting."); return; }
    requestInFlight.current = true; setWorking(true); setError("");
    try {
      const { requestValidatedJson } = await import("@/lib/browserLlm");
      const data = await requestValidatedJson("diagnose", buildDiagnosisMessages(course, { coverage: analysis.coverage, possibleErrors: analysis.possibleErrors, questions: analysis.questions }, answerList), diagnosisSchema, 4_000, apiConfig);
      setDiagnosis(data); setStep(4); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(publicBrowserLlmError(caught)); }
    finally { requestInFlight.current = false; setWorking(false); }
  };

  const reset = () => { setStep(1); setAnalysis(null); setDiagnosis(null); setAnswers({}); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const labels = ["Input", "Coverage", "Quiz", "Diagnosis"];

  return <div className="shell"><header className="topbar"><div className="topbar-inner"><div className="brand"><div className="brand-mark">N</div><div><h1>NoteLoop</h1><p>Diagnose understanding. Patch only what matters.</p></div></div><div className="privacy"><span className="privacy-dot" />Browser-only demo</div></div></header><main className="main"><nav className="stepper" aria-label="Study diagnostic progress">{labels.map((label, index) => { const number = (index + 1) as Step; return <div key={label} className={`step ${step === number ? "active" : ""} ${step > number ? "done" : ""}`} aria-current={step === number ? "step" : undefined}><span className="step-number">{step > number ? "✓" : number}</span><span className="step-label">{label}</span></div>; })}</nav>{step === 1 && <><ApiSetup config={apiConfig} setConfig={setApiConfig} /><InputStep course={course} setCourse={setCourse} notes={notes} setNotes={setNotes} pdfInfo={pdfInfo} extracting={extracting} analyzing={working} apiReady={Boolean(apiConfig.apiKey.trim())} error={error} onPdf={onPdf} onNotesFile={onNotesFile} onAnalyze={onAnalyze} /></>}{step === 2 && analysis && <CoverageStep analysis={analysis} mockMode={false} onBack={() => setStep(1)} onStartQuiz={startQuiz} />}{step === 3 && analysis && <QuizStep questions={analysis.questions} answers={answers} setAnswers={setAnswers} submitting={working} error={error} onBack={() => setStep(2)} onSubmit={submitAnswers} />}{step === 4 && diagnosis && <DiagnosisStep diagnosis={diagnosis} mockMode={false} onBack={() => setStep(3)} onReset={reset} />}</main></div>;
}
