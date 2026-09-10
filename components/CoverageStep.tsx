"use client";

import type { Analysis } from "@/lib/schemas";

function ListBox({ title, items }: { title: string; items: { topic: string; comment: string }[] }) {
  return <div className="info-box"><h3>{title}</h3>{items.length ? <ul className="info-list">{items.map((item, index) => <li key={`${item.topic}-${index}`}><strong>{item.topic}:</strong> {item.comment}</li>)}</ul> : <div className="empty-copy">None flagged.</div>}</div>;
}

export function CoverageStep({ analysis, mockMode, onStartQuiz }: { analysis: Analysis; mockMode: boolean; onStartQuiz: () => void }) {
  const uncertain = analysis.coverage.filter((item) => ["missing", "partial", "questionable"].includes(item.status)).map((item) => ({ topic: item.topic, comment: "Held for diagnostic testing before any note patch is proposed." }));
  return <section className="panel" aria-labelledby="coverage-title">
    <div className="panel-head"><div><p className="result-title">Coverage check</p><h2 className="lecture-title" id="coverage-title">{analysis.lectureTitle}</h2></div>{mockMode && <span className="mode-chip">Development demo</span>}</div>
    <div className="panel-body">
      <span className="section-label">Compact outline</span><div className="outline">{analysis.outline.map((item) => <span className="outline-item" key={item.topic}>{item.topic}<span className="importance">{item.importance}</span></span>)}</div>
      <span className="section-label">Review coverage</span><div className="table-wrap"><table className="coverage-table"><thead><tr><th>Topic</th><th>Status</th><th>Comment</th></tr></thead><tbody>{analysis.coverage.map((item, index) => <tr key={`${item.topic}-${index}`}><td>{item.topic}</td><td><span className={`status-chip status-${item.status}`}>{item.status}</span></td><td>{item.comment}</td></tr>)}</tbody></table></div>
      <div className="tri-grid"><ListBox title="Possible errors" items={analysis.possibleErrors} /><ListBox title="Possible redundancy" items={analysis.redundancy} /><ListBox title="Important uncertain areas" items={uncertain.slice(0, 6)} /></div>
      <div className="actions"><button className="button button-primary" type="button" onClick={onStartQuiz}>Start diagnostic quiz</button></div>
    </div>
  </section>;
}
