"use client";

import { useRef } from "react";
import { courseIds, courseProfiles, type CourseId } from "@/lib/courseProfiles";

type PdfInfo = { name: string; characters: number; pages: number; warnings: string[] } | null;

export function InputStep({ course, setCourse, notes, setNotes, pdfInfo, extracting, analyzing, error, onPdf, onNotesFile, onAnalyze }: {
  course: CourseId; setCourse: (course: CourseId) => void; notes: string; setNotes: (notes: string) => void;
  pdfInfo: PdfInfo; extracting: boolean; analyzing: boolean; error: string; onPdf: (file: File) => void; onNotesFile: (file: File) => void; onAnalyze: () => void;
}) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  return (
    <section className="panel" aria-labelledby="input-title">
      <div className="panel-head"><div><h2 className="panel-title" id="input-title">Bring your material and your own notes</h2><p className="panel-copy">We’ll check review coverage first, then test uncertain areas before suggesting any note changes.</p></div></div>
      <div className="panel-body">
        <div className="course-row"><label className="section-label" htmlFor="course">Course</label><select className="select" id="course" value={course} onChange={(event) => setCourse(event.target.value as CourseId)}>{courseIds.map((id) => <option key={id} value={id}>{courseProfiles[id].label}</option>)}</select></div>
        <div className="input-grid">
          <div><span className="section-label">Course material</span><div className={`filebox ${pdfInfo ? "has-file" : ""}`}>
            <input ref={pdfRef} className="file-input" type="file" accept="application/pdf,.pdf" onChange={(event) => event.target.files?.[0] && onPdf(event.target.files[0])} />
            {pdfInfo ? <div className="file-meta"><div className="file-name">{pdfInfo.name}</div><div className="file-stats">{pdfInfo.pages} pages · ~{pdfInfo.characters.toLocaleString()} extracted characters</div><button type="button" className="link-button" onClick={() => pdfRef.current?.click()} disabled={extracting}>Replace PDF</button></div> : <><div className="upload-icon" aria-hidden="true" /><strong>{extracting ? "Extracting text…" : "Upload lecture slides or course notes"}</strong><p>PDF only · up to 15 MB<br />Text is extracted on this server before analysis.</p><button type="button" className="button button-secondary" onClick={() => pdfRef.current?.click()} disabled={extracting}>{extracting ? "Working…" : "Choose PDF"}</button></>}
          </div></div>
          <div><div className="note-toolbar"><label className="section-label" htmlFor="notes" style={{ marginBottom: 0 }}>My notes</label><><input ref={notesRef} className="file-input" type="file" accept=".md,.txt,text/plain,text/markdown" onChange={(event) => event.target.files?.[0] && onNotesFile(event.target.files[0])} /><button type="button" className="link-button" onClick={() => notesRef.current?.click()}>Upload .md / .txt</button></></div><textarea id="notes" className="textarea" maxLength={80000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="# Paste or write your notes here…" /><div className="helper">{notes.length.toLocaleString()} / 80,000 characters · Draft saved on this device</div></div>
        </div>
        <div className="notice">Text-first analysis: diagrams and image-only slide content may not be fully captured.</div>
        {pdfInfo?.warnings.map((warning) => <div className="notice warning" key={warning}>{warning}</div>)}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="actions"><button className="button button-primary" type="button" onClick={onAnalyze} disabled={!pdfInfo || pdfInfo.characters === 0 || !notes.trim() || extracting || analyzing}>{analyzing ? <span className="loading"><span className="spinner" />Analyzing coverage…</span> : "Analyze"}</button></div>
      </div>
    </section>
  );
}
