"use client";

import type { BrowserLlmConfig } from "@/lib/browserLlm";

export function ApiSetup({ config, setConfig }: {
  config: BrowserLlmConfig;
  setConfig: (config: BrowserLlmConfig) => void;
}) {
  const ready = Boolean(config.apiKey.trim());
  const update = (patch: Partial<BrowserLlmConfig>) => setConfig({ ...config, ...patch });

  return (
    <section className={`api-setup ${ready ? "configured" : ""}`} aria-labelledby="api-setup-title">
      <div className="api-setup-main">
        <div>
          <div className="api-title-row">
            <h2 id="api-setup-title">API connection</h2>
            <span className={`connection-chip ${ready ? "ready" : ""}`}>{ready ? "Ready" : "Key required"}</span>
          </div>
          <p>Enter your API key and start. JSON compatibility and result validation are handled automatically.</p>
        </div>
        <div className="api-key-field">
          <label htmlFor="api-key">API key</label>
          <input id="api-key" type="password" autoComplete="off" spellCheck={false} placeholder="sk-…" value={config.apiKey} onChange={(event) => update({ apiKey: event.target.value })} />
          {ready && <button type="button" className="link-button" onClick={() => update({ apiKey: "" })}>Forget key</button>}
        </div>
      </div>
      <details className="api-advanced">
        <summary>Advanced provider settings</summary>
        <div className="api-settings-grid">
          <label>Base URL<input type="url" value={config.baseURL} onChange={(event) => update({ baseURL: event.target.value })} /></label>
          <label>Analysis model<input value={config.analyzeModel} onChange={(event) => update({ analyzeModel: event.target.value })} /></label>
          <label>Diagnosis model<input value={config.diagnoseModel} onChange={(event) => update({ diagnoseModel: event.target.value })} /></label>
        </div>
        <p className="api-schema-note">Keep these defaults for OpenAI. Change them only when using another compatible provider.</p>
      </details>
      <p className="api-caution">Use a temporary or restricted project key on a trusted device. A browser-only demo cannot provide server-grade secret protection.</p>
    </section>
  );
}
