import { fail, ok, preflight } from "@/lib/api";
import { ground } from "@/lib/ai/context";
import { askGemini, hasGemini } from "@/lib/ai/gemini";

export const OPTIONS = preflight;

const LANG: Record<string, string> = { en: "English", hi: "Hindi", mr: "Marathi", ta: "Tamil", gu: "Gujarati" };

/**
 * Answer a planner's question. The figures are looked up first; the language
 * model only words the answer and is told to use nothing else.
 */
export async function POST(req: Request) {
  let body: { question?: string; locale?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Send JSON: { \"question\": \"...\" }");
  }
  const question = (body.question ?? "").trim().slice(0, 600);
  if (question.length < 3) return fail(400, "question is required.");
  const locale = body.locale && body.locale in LANG ? body.locale : "en";

  const g = ground(question);
  let answer = g.summary;
  let engine: "gemini" | "local" = "local";

  if (hasGemini()) {
    try {
      const text = await askGemini([
        ["system",
          "You are the assistant inside Kaushal Radar, a labour market intelligence system used by skilling planners in India. " +
          "Answer the question using ONLY the facts given. Do not add numbers, places or trades that are not in the facts. " +
          "If the facts do not cover the question, say what they do show and that the rest is outside this data. " +
          "Demand means entry-level openings a year; supply means certified candidates entering the labour market a year. " +
          `Write two to four short sentences in ${LANG[locale]}, plain text, no lists and no markdown. Keep trade and place names as written.`],
        ["human", `Facts:\n${g.facts.join("\n")}\n\nQuestion: ${question}`],
      ]);
      if (text.trim()) {
        answer = text.trim();
        engine = "gemini";
      }
    } catch {
      // fall through to the plain summary
    }
  }
  return ok({ answer, engine, figures: g.figures, scope: g.scope, intent: g.intent }, { headers: { "cache-control": "no-store" } });
}
