import "server-only";
import OpenAI from "openai";
import type { z } from "zod";

type ModelKind = "analyze" | "diagnose";

export function isDevelopmentMockMode() {
  return process.env.NODE_ENV !== "production" && !process.env.LLM_API_KEY;
}

function getConfig(kind: ModelKind) {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  const model = kind === "analyze" ? process.env.LLM_MODEL_ANALYZE : process.env.LLM_MODEL_DIAGNOSE;
  const missing = [!apiKey && "LLM_API_KEY", !baseURL && "LLM_BASE_URL", !model && (kind === "analyze" ? "LLM_MODEL_ANALYZE" : "LLM_MODEL_DIAGNOSE")].filter(Boolean);
  if (missing.length) throw new Error(`Server configuration is missing: ${missing.join(", ")}.`);
  return { apiKey: apiKey!, baseURL: baseURL!, model: model!, jsonMode: process.env.LLM_JSON_MODE !== "false" };
}

function parseJsonCandidate(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as unknown;
}

export async function requestValidatedJson<T>(kind: ModelKind, messages: { system: string; user: string }, schema: z.ZodType<T>, maxTokens: number): Promise<T> {
  const config = getConfig(kind);
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, timeout: 60_000, maxRetries: 0 });
  let priorContent = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await client.chat.completions.create({
      model: config.model,
      messages: attempt === 0
        ? [{ role: "system", content: messages.system }, { role: "user", content: messages.user }]
        : [
            { role: "system", content: messages.system },
            { role: "user", content: messages.user },
            { role: "assistant", content: priorContent || "(empty response)" },
            { role: "user", content: "Repair the response. Output a complete JSON object with every required field, valid enum values, and no surrounding text." },
          ],
      ...(config.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      max_tokens: maxTokens,
      temperature: 0.15,
    });

    const content = response.choices[0]?.message?.content;
    priorContent = content ?? "";
    if (!content) continue;

    try {
      const parsed = parseJsonCandidate(content);
      const validated = schema.safeParse(parsed);
      if (validated.success) return validated.data;
    } catch {
      // The single repair attempt below handles parse failures.
    }
  }

  throw new Error("The model returned an invalid structured response twice. Try again or choose a provider/model with reliable JSON output.");
}

export function publicLlmError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "The provider rejected the API credentials or access permissions.";
    if (error.status === 429) return "The provider rate limit was reached. Wait briefly, then try again.";
    if (error.status && error.status >= 500) return "The LLM provider is temporarily unavailable. Try again shortly.";
    return `The LLM provider rejected the request${error.status ? ` (HTTP ${error.status})` : ""}. Check the base URL and model names.`;
  }
  if (error instanceof Error && (error.message.startsWith("Server configuration") || error.message.startsWith("The model returned"))) return error.message;
  return "Could not reach the LLM provider. Check the server configuration and network connection.";
}
