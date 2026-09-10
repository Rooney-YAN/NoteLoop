"use client";

import { PROVIDER_DEFAULTS, type BrowserLlmConfig, type ProviderPreset } from "@/lib/browserLlm";

export function ApiSetup({ config, setConfig }: {
  config: BrowserLlmConfig;
  setConfig: (config: BrowserLlmConfig) => void;
}) {
  const ready = Boolean(config.apiKey.trim());
  const update = (patch: Partial<BrowserLlmConfig>) => setConfig({ ...config, ...patch });
  const chooseProvider = (provider: ProviderPreset) => {
    if (provider === "custom") update({ provider });
    else setConfig({ ...config, provider, ...PROVIDER_DEFAULTS[provider] });
  };
  const customUpdate = (patch: Partial<BrowserLlmConfig>) => update({ provider: "custom", ...patch });

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
        <div className="api-connect-fields">
          <label className="api-provider-field" htmlFor="api-provider">Provider
            <select id="api-provider" value={config.provider} onChange={(event) => chooseProvider(event.target.value as ProviderPreset)}>
              <option value="openai">OpenAI official</option>
              <option value="deepseek">DeepSeek official</option>
              <option value="custom">Custom relay</option>
            </select>
          </label>
          <div className="api-key-field">
            <label htmlFor="api-key">API key</label>
            <input id="api-key" type="password" autoComplete="off" spellCheck={false} placeholder="Enter key" value={config.apiKey} onChange={(event) => update({ apiKey: event.target.value })} />
            {ready && <button type="button" className="link-button" onClick={() => update({ apiKey: "" })}>Forget</button>}
          </div>
        </div>
      </div>
      <details className="api-advanced">
        <summary>{config.provider === "custom" ? "Custom relay settings" : "Advanced settings"}</summary>
        <div className="api-settings-grid">
          <label>Base URL<input type="url" value={config.baseURL} onChange={(event) => customUpdate({ baseURL: event.target.value })} /></label>
          <label>Analysis model<input value={config.analyzeModel} onChange={(event) => customUpdate({ analyzeModel: event.target.value })} /></label>
          <label>Diagnosis model<input value={config.diagnoseModel} onChange={(event) => customUpdate({ diagnoseModel: event.target.value })} /></label>
        </div>
        <p className="api-schema-note">Official presets fill the correct endpoint and model automatically. For a relay, paste its OpenAI-compatible Base URL exactly as documented.</p>
      </details>
      <p className="api-caution">Use a temporary or restricted project key on a trusted device. A browser-only demo cannot provide server-grade secret protection.</p>
    </section>
  );
}
