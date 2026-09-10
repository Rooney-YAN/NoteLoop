import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type BrowserLlmConfig = { apiKey: string; baseURL: string; analyzeModel: string; diagnoseModel: string };

export const DEFAULT_BROWSER_LLM_CONFIG: BrowserLlmConfig = {
  apiKey: "",
  baseURL: "https://api.openai.com/v1",
  analyzeModel: "gpt-4.1-mini",
  diagnoseModel: "gpt-4.1-mini",
};

type ModelKind = "analyze" | "diagnose";
type OutputMode = "strict_schema" | "json_object" | "prompt_only";

const OUTPUT_MODES: OutputMode[] = ["strict_schema", "json_object", "prompt_only"];

function parseJsonCandidate(content: string) {
  return JSON.parse(content.trim()) as unknown;
}

function validationSummary(error: z.ZodError) {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function isOutputModeRejection(error: unknown) {
  return error instanceof OpenAI.APIError && [400, 404, 415, 422].includes(error.status ?? 0);
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
  const responseFormat = zodResponseFormat(
    schema,
    kind === "analyze" ? "noteloop_analysis" : "noteloop_diagnosis",
    { description: "Complete NoteLoop result matching every required field and constraint." },
  );
  let priorContent = "";
  let repairFeedback = "The response was not a valid standalone JSON object.";
  let outputAttempt = 0;
  let outputModeIndex = 0;
  while (outputAttempt < 2) {
    const outputMode = OUTPUT_MODES[outputModeIndex];
    let response;
    try {
      response = await client.chat.completions.create({
        model,
        messages: outputAttempt === 0
          ? [{ role: "system", content: messages.system }, { role: "user", content: messages.user }]
          : [{ role: "system", content: messages.system }, { role: "user", content: messages.user }, { role: "assistant", content: priorContent || "(empty response)" }, { role: "user", content: `Repair the response. ${repairFeedback} Return one complete JSON object with every required field, valid enum value, and no surrounding text.` }],
        ...(outputMode === "strict_schema" ? { response_format: responseFormat } : {}),
        ...(outputMode === "json_object" ? { response_format: { type: "json_object" as const } } : {}),
        max_tokens: maxTokens,
      });
    } catch (error) {
      if (isOutputModeRejection(error) && outputModeIndex < OUTPUT_MODES.length - 1) {
        outputModeIndex += 1;
        continue;
      }
      throw error;
    }
    outputAttempt += 1;
    const choice = response.choices[0];
    if (choice?.message?.refusal) throw new Error("The model refused to generate the requested structured result.");
    const content = choice?.message?.content;
    priorContent = content ?? "";
    if (!content) {
      repairFeedback = choice?.finish_reason === "length"
        ? "The previous response was truncated; make each field more concise."
        : "The previous response was empty.";
      continue;
    }
    try {
      const validated = schema.safeParse(parseJsonCandidate(content));
      if (validated.success) return validated.data;
      repairFeedback = `These constraints failed: ${validationSummary(validated.error)}`;
    } catch {
      repairFeedback = "The previous response was not a valid standalone JSON object.";
    }
  }
  throw new Error("The model returned unusable data after two attempts. Try Analyze again; if it continues, use the default gpt-4.1-mini model.");
}

export function publicBrowserLlmError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "The provider rejected this API key or its permissions.";
    if (error.status === 429) return "The provider rate limit was reached. Wait briefly, then try again.";
    if (error.status && error.status >= 500) return "The model provider is temporarily unavailable. Try again shortly.";
    return `The provider rejected the request${error.status ? ` (HTTP ${error.status})` : ""}. Check the base URL and model names.`;
  }
  if (error instanceof Error) {
    if (error.message.startsWith("Enter ") || error.message.startsWith("The model ")) return error.message;
    if (/Failed to fetch|NetworkError|fetch failed/i.test(error.message)) return "The browser could not reach this provider. Check the base URL, network, and whether the provider allows browser requests.";
  }
  return "Could not reach the model provider. Check the API settings and network connection.";
}
