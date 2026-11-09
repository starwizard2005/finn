/**
 * Minimal Gemini client with model routing, fallbacks and caching.
 *
 * Routing policy (cost-aware):
 *   fast  -> Flash-Lite: bulk, narrow tasks (classify a vague filing, extract facts/people from a PDF,
 *            pull forward-looking statements out of one transcript, plan an "Ask" query). ~500 free RPD.
 *   smart -> Flash: only the synthesis step that needs reasoning across sources (promised vs delivered,
 *            bull/bear). ~20 free RPD, so its outputs are cached per company per quarter.
 * Everything numeric is computed in code (lib/research.ts) and passed IN to the model, never asked OUT of it.
 */
export type Tier = "fast" | "smart";

const ENV_MODEL: Record<Tier, string | undefined> = {
  fast: process.env.FINN_MODEL_FAST,
  smart: process.env.FINN_MODEL_SMART,
};
// Model names move quickly; try the configured one, then known-good fallbacks.
const FALLBACKS: Record<Tier, string[]> = {
  fast: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"],
  smart: ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"],
};

export const hasKey = () => !!process.env.GEMINI_API_KEY;

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export type LlmResult<T> = { data: T; model: string; usage?: { in: number; out: number } };

const cache = new Map<string, LlmResult<unknown>>();
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

export async function generateJSON<T>(opts: { tier: Tier; system: string; prompt: string; parts?: Part[]; maxTokens?: number; temperature?: number }): Promise<LlmResult<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const ck = hash(`${opts.tier}|${opts.system}|${opts.prompt}`);
  if (cache.has(ck)) return cache.get(ck) as LlmResult<T>;

  const models = [ENV_MODEL[opts.tier], ...FALLBACKS[opts.tier]].filter((m, i, a): m is string => !!m && a.indexOf(m) === i);
  let lastErr: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [...(opts.parts ?? []), { text: opts.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: opts.temperature ?? 0.2,
            maxOutputTokens: opts.maxTokens ?? 4096,
          },
        }),
      });
      if (res.status === 404 || res.status === 400) {
        lastErr = new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        break; // try next model
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`${model}: ${res.status}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      const text: string = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      const data = parseJSON<T>(text);
      const out: LlmResult<T> = { data, model, usage: { in: j.usageMetadata?.promptTokenCount ?? 0, out: j.usageMetadata?.candidatesTokenCount ?? 0 } };
      cache.set(ck, out);
      return out;
    }
  }
  throw lastErr ?? new Error("No model available");
}

function parseJSON<T>(text: string): T {
  const t = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(t) as T;
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1)) as T;
    throw new Error("Model did not return JSON");
  }
}
