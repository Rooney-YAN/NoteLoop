import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requestValidatedJson, type BrowserLlmConfig } from "@/lib/browserLlm";
import { createDiagnosisSchema, toQuizAnswers } from "@/lib/quiz";
import { completeAnswers, diagnosis, questions } from "./fixtures";

const outputSchema = z.object({ ok: z.boolean() });
const completion = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });

async function capture(config: BrowserLlmConfig) {
  const fetchMock = vi.fn().mockResolvedValue(completion());
  vi.stubGlobal("fetch", fetchMock);
  await requestValidatedJson("analyze", { system: "Return JSON", user: "Input" }, outputSchema, 123, config);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

describe("provider request compatibility", () => {
  it("uses strict schema and max_completion_tokens for OpenAI", async () => {
    const request = await capture({ apiKey: "test", provider: "openai", baseURL: "https://api.openai.com/v1", analyzeModel: "gpt-5.6-sol", diagnoseModel: "gpt-5.6-sol" });
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.body.max_completion_tokens).toBe(123);
    expect(request.body.response_format).toMatchObject({ type: "json_schema" });
  });

  it("uses JSON Object mode and disables thinking for DeepSeek", async () => {
    const request = await capture({ apiKey: "test", provider: "deepseek", baseURL: "https://api.deepseek.com", analyzeModel: "deepseek-v4-flash", diagnoseModel: "deepseek-v4-flash" });
    expect(request.url).toBe("https://api.deepseek.com/chat/completions");
    expect(request.body.max_tokens).toBe(123);
    expect(request.body.response_format).toEqual({ type: "json_object" });
    expect(request.body.thinking).toEqual({ type: "disabled" });
  });

  it("uses the conservative OpenAI-compatible relay request", async () => {
    const request = await capture({ apiKey: "test", provider: "custom", baseURL: "https://relay.example", analyzeModel: "relay-model", diagnoseModel: "relay-model" });
    expect(request.url).toBe("https://relay.example/v1/chat/completions");
    expect(request.body.max_tokens).toBe(123);
    expect(request.body.response_format).toEqual({ type: "json_object" });
  });

  it("serializes and validates the refined full diagnosis schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(diagnosis) } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const answers = toQuizAnswers(questions, completeAnswers());
    const result = await requestValidatedJson("diagnose", { system: "Return JSON", user: "Input" }, createDiagnosisSchema(questions, answers), 6000, { apiKey: "test", provider: "openai", baseURL: "https://api.openai.com/v1", analyzeModel: "gpt-4.1-mini", diagnoseModel: "gpt-4.1-mini" });
    expect(result.questionResults).toHaveLength(6);
  });
});
