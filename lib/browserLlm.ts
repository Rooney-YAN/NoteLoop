import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

export type ProviderPreset = "openai" | "deepseek" | "custom";
export type BrowserLlmConfig = {
  apiKey: string;
  provider: ProviderPreset;
  baseURL: string;
  analyzeModel: string;
  diagnoseModel: string;
};

export const PROVIDER_DEFAULTS: Record<Exclude<ProviderPreset, "custom">, Pick<BrowserLlmConfig, "baseURL" | "analyzeModel" | "diagnoseModel">> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    analyzeModel: "gpt-4.1-mini",
    diagnoseModel: "gpt-4.1-mini",
  },
  deepseek: {
    baseURL: "https://api.deepseek.com",
    analyzeModel: "deepseek-v4-flash",
    diagnoseModel: "deepseek-v4-flash",
  },
};

export const DEFAULT_BROWSER_LLM_CONFIG: BrowserLlmConfig = {
  apiKey: "",
  provider: "openai",
  ...PROVIDER_DEFAULTS.openai,
};

type ModelKind = "analyze" | "diagnose";
type ProviderKind = "openai" | "deepseek" | "relay";
type OutputMode = "strict_schema" | "json_object" | "prompt_only";
type RequestVariant = {
  outputMode: OutputMode;
  tokenField: "max_tokens" | "max_completion_tokens" | null;
  disableThinking?: boolean;
  disableReasoning?: boolean;
};
type ChatCompletionPayload = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null; refusal?: string | null };
  }>;
};

class ProviderHttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ProviderHttpError";
    this.status = status;
    this.code = code;
  }
}

class ProviderTimeoutError extends Error {
  constructor() {
    super("The provider took too long to respond.");
    this.name = "ProviderTimeoutError";
  }
}

function parseJsonCandidate(content: string) {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as unknown;
}

function validationSummary(error: z.ZodError) {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
}

function providerKind(config: BrowserLlmConfig, baseURL: string): ProviderKind {
  const hostname = new URL(baseURL).hostname.toLowerCase();
  if (config.provider === "deepseek" || hostname === "api.deepseek.com") return "deepseek";
  if (config.provider === "openai" || hostname === "api.openai.com") return "openai";
  return "relay";
}

function requestVariants(provider: ProviderKind, model: string): RequestVariant[] {
  if (provider === "deepseek") {
    return [
      { outputMode: "json_object", tokenField: "max_tokens", disableThinking: true },
      { outputMode: "json_object", tokenField: "max_tokens" },
      { outputMode: "prompt_only", tokenField: "max_tokens" },
      { outputMode: "prompt_only", tokenField: null },
    ];
  }
  if (provider === "openai") {
    const reasoningModel = /^(?:gpt-[56](?:\.|-|$)|o\d)/i.test(model);
    return [
      { outputMode: "strict_schema", tokenField: "max_completion_tokens", disableReasoning: reasoningModel },
      { outputMode: "json_object", tokenField: "max_completion_tokens" },
      { outputMode: "prompt_only", tokenField: "max_completion_tokens" },
      { outputMode: "prompt_only", tokenField: null },
    ];
  }
  return [
    { outputMode: "json_object", tokenField: "max_tokens" },
    { outputMode: "prompt_only", tokenField: "max_tokens" },
    { outputMode: "prompt_only", tokenField: "max_completion_tokens" },
    { outputMode: "prompt_only", tokenField: null },
  ];
}

function completionEndpoint(baseURL: string, provider: ProviderKind) {
  const url = new URL(baseURL);
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(path)) return url.toString();
  if (!path && provider === "relay") url.pathname = "/v1/chat/completions";
  else url.pathname = `${path}/chat/completions`.replace(/\/{2,}/g, "/");
  return url.toString();
}

function redactProviderMessage(message: string) {
  return message
    .replace(/(?:sk|key)-[A-Za-z0-9_-]{8,}/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

async function providerError(response: Response) {
  let message = response.statusText || "Request rejected";
  let code: string | undefined;
  try {
    const body = await response.json() as { error?: { message?: unknown; code?: unknown; type?: unknown }; message?: unknown };
    const error = body.error;
    if (typeof error?.message === "string") message = error.message;
    else if (typeof body.message === "string") message = body.message;
    if (typeof error?.code === "string") code = error.code;
    else if (typeof error?.type === "string") code = error.type;
  } catch { /* Some relays return an HTML or empty error response. */ }
  return new ProviderHttpError(response.status, redactProviderMessage(message), code);
}

function isCompatibilityRejection(error: unknown) {
  return error instanceof ProviderHttpError && [400, 415, 422].includes(error.status);
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

async function createCompletion(endpoint: string, apiKey: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError(response);
    try {
      return await response.json() as ChatCompletionPayload;
    } catch {
      throw new Error("The provider returned a response that was not valid JSON.");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function requestValidatedJson<T>(kind: ModelKind, messages: { system: string; user: string }, schema: z.ZodType<T>, maxTokens: number, config: BrowserLlmConfig): Promise<T> {
  const { apiKey, baseURL, model } = validatedConfig(kind, config);
  const provider = providerKind(config, baseURL);
  const endpoint = completionEndpoint(baseURL, provider);
  const responseFormat = zodResponseFormat(
    schema,
    kind === "analyze" ? "noteloop_analysis" : "noteloop_diagnosis",
    { description: "Complete NoteLoop result matching every required field and constraint." },
  );
  const variants = requestVariants(provider, model);
  let priorContent = "";
  let repairFeedback = "The response was not a valid standalone JSON object.";
  let outputAttempt = 0;
  let variantIndex = 0;

  while (outputAttempt < 2) {
    const variant = variants[variantIndex];
    const body: Record<string, unknown> = {
      model,
      messages: outputAttempt === 0
        ? [{ role: "system", content: messages.system }, { role: "user", content: messages.user }]
        : [{ role: "system", content: messages.system }, { role: "user", content: messages.user }, { role: "assistant", content: priorContent || "(empty response)" }, { role: "user", content: `Repair the response. ${repairFeedback} Return one complete JSON object with every required field, valid enum value, and no surrounding text.` }],
    };
    if (variant.outputMode === "strict_schema") body.response_format = responseFormat;
    if (variant.outputMode === "json_object") body.response_format = { type: "json_object" };
    if (variant.tokenField) body[variant.tokenField] = maxTokens;
    if (variant.disableThinking) body.thinking = { type: "disabled" };
    if (variant.disableReasoning) body.reasoning_effort = "none";

    let response: ChatCompletionPayload;
    try {
      response = await createCompletion(endpoint, apiKey, body);
    } catch (error) {
      if (isCompatibilityRejection(error) && variantIndex < variants.length - 1) {
        variantIndex += 1;
        continue;
      }
      throw error;
    }

    outputAttempt += 1;
    const choice = response.choices?.[0];
    if (choice?.message?.refusal) throw new Error("The model refused to generate the requested structured result.");
    const content = choice?.message?.content;
    priorContent = content ?? "";
    if (!content) {
      repairFeedback = choice?.finish_reason === "length"
        ? "The previous response was truncated; make every field much more concise."
        : "The previous response was empty; produce the JSON object directly.";
      continue;
    }
    try {
      const validated = schema.safeParse(parseJsonCandidate(content));
      if (validated.success) return validated.data;
      repairFeedback = `These constraints failed: ${validationSummary(validated.error)}`;
    } catch {
      repairFeedback = "The previous response was not valid JSON.";
    }
  }
  throw new Error("The model returned unusable data after two attempts. Try Analyze again; if it continues, choose an official provider preset.");
}

export function publicBrowserLlmError(error: unknown) {
  if (error instanceof ProviderHttpError) {
    if (error.status === 401 || error.status === 403) return "The API key is invalid, expired, or not allowed to use this model.";
    if (error.status === 402) return "The provider account has insufficient credit. Add balance or use another key.";
    if (error.status === 404) return `The provider could not find this endpoint or model (HTTP 404). Check the Base URL and exact model ID. Details: ${error.message}`;
    if (error.status === 413) return "The provider rejected the input as too large. Use a smaller PDF or shorter notes.";
    if (error.status === 429) return "The provider rate limit was reached. Wait briefly, then try again.";
    if (error.status && error.status >= 500) return `The provider is temporarily unavailable (HTTP ${error.status}). Try again shortly.`;
    return `The provider rejected the request (HTTP ${error.status}${error.code ? `, ${error.code}` : ""}). Details: ${error.message}`;
  }
  if (error instanceof ProviderTimeoutError) return "The provider did not finish within 3 minutes. Try again or use a faster model.";
  if (error instanceof Error) {
    if (error.message.startsWith("Enter ") || error.message.startsWith("The model ") || error.message.startsWith("The provider ")) return error.message;
    if (/Failed to fetch|NetworkError|fetch failed/i.test(error.message)) return "The browser could not reach this provider. The relay may block browser CORS requests; use an official provider preset or a relay that allows this site.";
  }
  return "Could not reach the model provider. Check the API settings and network connection.";
}
