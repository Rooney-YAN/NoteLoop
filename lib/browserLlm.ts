import OpenAI from "openai";
import type { z } from "zod";

export type BrowserLlmConfig = { apiKey: string; baseURL: string; analyzeModel: string; diagnoseModel: string; jsonMode: boolean };

export const DEFAULT_BROWSER_LLM_CONFIG: BrowserLlmConfig = {
  apiKey: "",
  baseURL: "https://api.openai.com/v1",
  analyzeModel: "gpt-4.1-mini",
  diagnoseModel: "gpt-4.1-mini",
  jsonMode: true,
};

type ModelKind = "analyze" | "diagnose";

function parseJsonCandidate(content: string) {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as unknown;
}

function validatedConfig(kind: ModelKind, config: BrowserLlmConfig) {
  const apiKey = config.apiKey.trim();
  const baseURL = config.baseURL.trim().replace(/\/$/, "");
  const model = (kind === "analyze" ? config.analyzeModel : config.diagnoseModel).trim();
  if (!apiKey) throw new Error("Enter an API key before continuing.");
  if (!baseURL) throw new Error("Enter the provider base URL.");
  if (!model) throw new Error(`Enter a model for ${kind === "analyze" ? "analysis" : "diagnosis"}.`);
  try {
    const url = new URL(baseURL);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error();
  } catch { throw new Error("Enter a valid HTTPS provider base URL."); }
  return { apiKey, baseURL, model };
}

export async function requestValidatedJson<T>(kind: ModelKind, messages: { system: string; user: string }, schema: z.ZodType<T>, maxTokens: number, config: BrowserLlmConfig): Promise<T> {
  const { apiKey, baseURL, model } = validatedConfig(kind, config);
  const client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 0, dangerouslyAllowBrowser: true });
  let priorContent = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await client.chat.completions.create({
      model,
      messages: attempt === 0
        ? [{ role: "system", content: messages.system }, { role: "user", content: messages.user }]
        : [{ role: "system", content: messages.system }, { role: "user", content: messages.user }, { role: "assistant", content: priorContent || "(empty response)" }, { role: "user", content: "Repair the response. Output a complete JSON object with every required field, valid enum values, and no surrounding text." }],
      ...(config.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      max_tokens: maxTokens,
      temperature: 0.15,
    });
    const content = response.choices[0]?.message?.content;
    priorContent = content ?? "";
    if (!content) continue;
    try {
      const validated = schema.safeParse(parseJsonCandidate(content));
      if (validated.success) return validated.data;
    } catch { /* The single repair attempt handles parse failures. */ }
  }
  throw new Error("The model returned invalid structured data twice. Try again or choose a model with reliable JSON output.");
}

export function publicBrowserLlmError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "The provider rejected this API key or its permissions.";
    if (error.status === 429) return "The provider rate limit was reached. Wait briefly, then try again.";
    if (error.status && error.status >= 500) return "The model provider is temporarily unavailable. Try again shortly.";
    return `The provider rejected the request${error.status ? ` (HTTP ${error.status})` : ""}. Check the base URL and model names.`;
  }
  if (error instanceof Error) {
    if (error.message.startsWith("Enter ") || error.message.startsWith("The model returned")) return error.message;
    if (/Failed to fetch|NetworkError|fetch failed/i.test(error.message)) return "The browser could not reach this provider. Check the base URL, network, and whether the provider allows browser requests.";
  }
  return "Could not reach the model provider. Check the API settings and network connection.";
}
