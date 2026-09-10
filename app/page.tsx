"use client";

import { useEffect, useRef, useState } from "react";
import { InputStep } from "@/components/InputStep";
import { CoverageStep } from "@/components/CoverageStep";
import { QuizStep, type AnswerState } from "@/components/QuizStep";
import { DiagnosisStep } from "@/components/DiagnosisStep";
import { isCourseId, type CourseId } from "@/lib/courseProfiles";
import type { Analysis, Diagnosis } from "@/lib/schemas";

type Step = 1 | 2 | 3 | 4;
type PdfInfo = { name: string; characters: number; pages: number; warnings: string[] } | null;

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Something went wrong. Please try again.");
  return payload as T;
}

function readStoredValue(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStoredValue(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Persistence is optional. */ }
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
  const [mockMode, setMockMode] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const savedCourse = readStoredValue("noteloop.course");
    const savedNotes = readStoredValue("noteloop.notes");
    const timer = window.setTimeout(() => {
      if (savedCourse && isCourseId(savedCourse)) setCourse(savedCourse);
      if (savedNotes) setNotes(savedNotes);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (storageReady) writeStoredValue("noteloop.course", course); }, [course, storageReady]);
  useEffect(() => { if (!storageReady) return; const timer = window.setTimeout(() => writeStoredValue("noteloop.notes", notes), 250); return () => window.clearTimeout(timer); }, [notes, storageReady]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "stage_study_note",
      title: "Stage study note",
      description: "Select a supported course and place a note draft into NoteLoop's visible input step. A PDF still needs to be chosen by the student.",
      inputSchema: {
        type: "object",
        properties: {
          course: { type: "string", enum: ["COMP2012", "COMP2611", "COMP3711", "MATH2023", "General"] },
          notes: { type: "string", maxLength: 80000 },
        },
        required: ["course", "notes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object") throw new Error("Expected course and notes.");
        const candidate = input as { course?: unknown; notes?: unknown };
        if (typeof candidate.course !== "string" || !isCourseId(candidate.course)) throw new Error("Unsupported course.");
        if (typeof candidate.notes !== "string" || candidate.notes.length > 80_000) throw new Error("Notes must be text under 80,000 characters.");
        setCourse(candidate.course);
        setNotes(candidate.notes);
        setStep(1);
        setAnalysis(null);
        setDiagnosis(null);
        setAnswers({});
        setError("");
        return { course: candidate.course, noteCharacters: candidate.notes.length, inputStepReady: true, pdfRequired: !pdfInfo };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [pdfInfo]);

  const onPdf = async (file: File) => {
    setExtracting(true); setError(""); setPdfInfo(null); setCourseMaterial("");
    try {
      const form = new FormData(); form.append("file", file);
      const data = await jsonRequest<{ text: string; pages: number; characterCount: number; warnings: string[] }>("/api/extract", { method: "POST", body: form });
      setCourseMaterial(data.text); setPdfInfo({ name: file.name, characters: data.characterCount, pages: data.pages, warnings: data.warnings });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read that PDF."); }
    finally { setExtracting(false); }
  };

  const onNotesFile = async (file: File) => {
    setError("");
    if (!/\.(md|txt)$/i.test(file.name)) { setError("Notes must be a .md or .txt file."); return; }
    if (file.size > 500_000) { setError("The notes file is too large. Keep the note under 80,000 characters."); return; }
    try {
      const text = await file.text();
      if (text.length > 80_000) { setError("The notes file exceeds the 80,000-character limit."); return; }
      setNotes(text);
    } catch {
      setError("Could not read that notes file. Try a plain UTF-8 .md or .txt file.");
    }
  };

  const onAnalyze = async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setWorking(true); setError("");
    try {
      const result = await jsonRequest<{ data: Analysis; mockMode: boolean }>("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course, courseMaterial, notes }) });
      setAnalysis(result.data); setDiagnosis(null); setAnswers({}); setMockMode(result.mockMode); setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Analysis failed."); }
    finally { requestInFlight.current = false; setWorking(false); }
  };

  const startQuiz = () => {
    if (!analysis) return;
    setAnswers((current) => analysis.questions.every((question) => current[question.id]) ? current : Object.fromEntries(analysis.questions.map((question) => [question.id, { answer: "", confidence: null }]))); setError(""); setStep(3); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitAnswers = async () => {
    if (!analysis || requestInFlight.current) return;
    requestInFlight.current = true;
    setWorking(true); setError("");
    try {
      const answerList = analysis.questions.map((question) => ({ questionId: question.id, answer: answers[question.id]?.answer ?? "", confidence: answers[question.id]?.confidence ?? 0 }));
      const result = await jsonRequest<{ data: Diagnosis; mockMode: boolean }>("/api/diagnose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course, coverage: analysis.coverage, possibleErrors: analysis.possibleErrors, questions: analysis.questions, answers: answerList }) });
      setDiagnosis(result.data); setMockMode(result.mockMode); setStep(4); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Diagnosis failed."); }
    finally { requestInFlight.current = false; setWorking(false); }
  };

  const reset = () => { setStep(1); setAnalysis(null); setDiagnosis(null); setAnswers({}); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const labels = ["Input", "Coverage", "Quiz", "Diagnosis"];

  return <div className="shell"><header className="topbar"><div className="topbar-inner"><div className="brand"><div className="brand-mark">N</div><div><h1>NoteLoop</h1><p>Diagnose understanding. Patch only what matters.</p></div></div><div className="privacy"><span className="privacy-dot" />Your API key stays server-side</div></div></header><main className="main"><nav className="stepper" aria-label="Study diagnostic progress">{labels.map((label, index) => { const number = (index + 1) as Step; return <div key={label} className={`step ${step === number ? "active" : ""} ${step > number ? "done" : ""}`} aria-current={step === number ? "step" : undefined}><span className="step-number">{step > number ? "✓" : number}</span><span className="step-label">{label}</span></div>; })}</nav>{step === 1 && <InputStep course={course} setCourse={setCourse} notes={notes} setNotes={setNotes} pdfInfo={pdfInfo} extracting={extracting} analyzing={working} error={error} onPdf={onPdf} onNotesFile={onNotesFile} onAnalyze={onAnalyze} />}{step === 2 && analysis && <CoverageStep analysis={analysis} mockMode={mockMode} onBack={() => setStep(1)} onStartQuiz={startQuiz} />}{step === 3 && analysis && <QuizStep questions={analysis.questions} answers={answers} setAnswers={setAnswers} submitting={working} error={error} onBack={() => setStep(2)} onSubmit={submitAnswers} />}{step === 4 && diagnosis && <DiagnosisStep diagnosis={diagnosis} mockMode={mockMode} onBack={() => setStep(3)} onReset={reset} />}</main></div>;
}
