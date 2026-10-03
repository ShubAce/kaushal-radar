// The only place a language model is called: Gemini's free tier, through LangChain.
// Everything that uses it has a deterministic fallback, so the product keeps
// working with no key, an exhausted quota or a renamed model.
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { z } from "zod";

// Tried in order. All three are free of charge on Google's free tier (checked October 2026).
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite"];

const apiKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
export const hasGemini = () => apiKey().length > 0;

function models(): string[] {
  const custom = process.env.GEMINI_MODEL?.trim();
  return custom ? [custom, ...DEFAULT_MODELS.filter((m) => m !== custom)] : DEFAULT_MODELS;
}

function chat(model: string) {
  return new ChatGoogleGenerativeAI({ model, apiKey: apiKey(), temperature: 0.2, maxRetries: 0, maxOutputTokens: 700 });
}

// A rejected key or a timeout will not improve on another model. A renamed model or a
// per-model quota (free-tier limits are set model by model) might, so those move on.
const fatal = (e: unknown) => /api.?key|401|403|permission|unauthenticated|abort|timed? ?out/i.test(String((e as Error)?.message ?? e));

async function withFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const m of models()) {
    try {
      return await run(m);
    } catch (e) {
      last = e;
      if (fatal(e)) break;
    }
  }
  throw last;
}

const TIMEOUT_MS = 14000;

/** Plain-text answer. Throws if the model is unreachable; callers fall back. */
export function askGemini(messages: BaseMessageLike[]): Promise<string> {
  return withFallback(async (m) => {
    const res = await chat(m).invoke(messages, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return typeof res.content === "string" ? res.content : res.content.map((c) => ("text" in c ? c.text : "")).join("");
  });
}

/** Answer constrained to a schema. Throws if the model is unreachable; callers fall back. */
export function askGeminiStructured<S extends z.ZodType>(schema: S, messages: BaseMessageLike[]): Promise<z.infer<S>> {
  return withFallback(async (m) => {
    const structured = chat(m).withStructuredOutput(schema);
    return (await structured.invoke(messages, { signal: AbortSignal.timeout(TIMEOUT_MS) })) as z.infer<S>;
  });
}
