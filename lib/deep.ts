/**
 * "Promised vs delivered" — the deep, LLM-assisted part of Pull.
 *
 *   transcripts (PDF) --code--> text --code--> forward-looking sentences
 *       --FAST model (map, one call per call-transcript)--> structured commitments (verbatim quotes)
 *       --SMART model (reduce, one call)--> verdicts vs. the ACTUAL numbers we computed in code
 *       --code--> every quote is checked against the transcript text; unverifiable evidence is dropped.
 *
 * Grounding rule from the brief: primary sources only (transcripts + reported financials). The prompts
 * forbid outside knowledge, and the verifier enforces it for quotes.
 */
import { generateJSON } from "./llm";
import { forwardLooking, pdfText } from "./sources/pdf";
import { quarterTable } from "./research";
import type { DeepAnalysis, Fundamentals, PromiseItem } from "./types";

type Commitment = { topic: string; quote: string; metric?: string; target?: string; horizon?: string };

const MAP_SYSTEM = `You extract management guidance from Indian listed-company earnings-call transcripts.
Use ONLY the sentences given. Never use outside knowledge. Quotes must be copied verbatim from the input.
Skip analyst questions unless management's answer is inside the same sentence.`;

const REDUCE_SYSTEM = `You are a sceptical buy-side analyst. You compare what management PROMISED on earnings calls with what the
company actually DELIVERED in its reported numbers. Ground every claim in the inputs: the commitments list (with verbatim quotes)
and the financial tables. Do not use outside knowledge, news, or broker views. If a target's deadline has not passed, verdict = "pending".
Be concise and specific; prefer numbers to adjectives.`;

export async function deepAnalysis(f: Fundamentals): Promise<DeepAnalysis> {
  const calls = f.concalls.filter((c) => c.transcript).slice(0, 4);
  if (!calls.length) throw new Error("No earnings-call transcripts listed for this company");

  // 1. Code: fetch + extract text + pre-filter (no tokens spent)
  const errs: string[] = [];
  const texts = await Promise.all(
    calls.map(async (c) => {
      try {
        return { period: c.period, url: c.transcript!, text: await pdfText(c.transcript!, 60, 15000) };
      } catch (e) {
        errs.push(`${c.period}: ${(e as Error).message}`);
        return null;
      }
    }),
  );
  const got = texts.filter((x): x is NonNullable<typeof x> => !!x && x.text.length > 2000);
  if (!got.length) throw new Error(`Step 1 (download transcripts from BSE) failed: ${errs.join("; ").slice(0, 300) || "PDFs had no text"}`);

  // 2. FAST model, map step: one call per transcript
  const commitments = (
    await Promise.all(
      got.map(async (t) => {
        const sentences = forwardLooking(t.text, 70);
        const r = await generateJSON<{ commitments: Commitment[] }>({
          timeoutMs: 25000,
          tier: "fast",
          system: MAP_SYSTEM,
          prompt: `Company: ${f.name}. Call: ${t.period}.\nSentences:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nReturn JSON {"commitments":[{"topic":"revenue|margin|working capital|cash flow|capex|order book|debt|segment|other","quote":"verbatim sentence or clause","metric":"...","target":"...","horizon":"e.g. FY27 / by Mar-26"}]} with at most 8 items, most material first.`,
          maxTokens: 2000,
        });
        return (r.data.commitments ?? []).map((c) => ({ ...c, period: t.period }));
      }),
    )
  ).flat();

  // 3. SMART model, reduce step: verdicts against code-computed numbers
  const qt = quarterTable(f, 9);
  const numbers = [
    `Quarterly (₹ cr): ${qt?.periods.join(" | ")}`,
    ...(qt?.rows.map((r) => `${r.label}: ${r.values.join(" | ")}`) ?? []),
    `Annual (₹ cr): ${f.annual?.periods.join(" | ")}`,
    ...Object.entries(f.annual?.rows ?? {}).map(([k, v]) => `${k}: ${v.join(" | ")}`),
    `Cash flow (₹ cr): ${f.cashflow?.periods.join(" | ")}`,
    ...Object.entries(f.cashflow?.rows ?? {}).map(([k, v]) => `${k}: ${v.join(" | ")}`),
    `Efficiency: ${f.efficiency?.periods.join(" | ")}`,
    ...Object.entries(f.efficiency?.rows ?? {}).map(([k, v]) => `${k}: ${v.join(" | ")}`),
  ].join("\n");

  const r = await generateJSON<Omit<DeepAnalysis, "symbol" | "generatedAt" | "generatedBy" | "sources">>({
    timeoutMs: 45000,
    tier: "smart",
    system: REDUCE_SYSTEM,
    prompt: `Company: ${f.name} (${f.symbol}). About: ${f.about}

COMMITMENTS (from the last ${got.length} earnings calls, newest first):
${commitments.map((c, i) => `${i + 1}. [${c.period}] (${c.topic}) "${c.quote}" — target: ${c.target ?? "?"}, horizon: ${c.horizon ?? "?"}`).join("\n")}

REPORTED NUMBERS:
${numbers}

Return JSON:
{"businessSnapshot":["3 short bullets: what the company does / segments, from the About + transcripts"],
 "guidance":[{"metric":"","target":"","said":"call period","status":"on track | behind | ahead | too early"}],
 "promises":[{"topic":"","promised":"one line","when":"call period","delivered":"one line with the actual number","verdict":"delivered|missed|partly|pending|beat","evidence":[{"quote":"verbatim from commitments","source":"call period"}]}],
 "narrativeVsNumbers":["3-4 sharp observations where the story and the numbers agree or diverge"],
 "bull":["3 bullets"],"bear":["3 bullets"]}
Max 6 promises, most material first.`,
    maxTokens: 5000,
  });

  // 4. Code: verify every quote really appears in a transcript
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
  const corpus = got.map((t) => norm(t.text)).join(" ");
  const verified = (q: string) => {
    const n = norm(q);
    return n.length > 20 && corpus.includes(n.slice(0, Math.min(80, n.length)));
  };
  const promises: PromiseItem[] = (r.data.promises ?? []).map((p) => ({ ...p, evidence: (p.evidence ?? []).filter((e) => verified(e.quote)) }));

  return {
    symbol: f.symbol,
    generatedAt: new Date().toISOString(),
    generatedBy: `${r.model} (synthesis) + fast model (extraction); ${promises.reduce((s, p) => s + p.evidence.length, 0)} quotes verified against transcripts`,
    sources: got.map((t) => ({ label: `Earnings call transcript — ${t.period}`, url: t.url })),
    businessSnapshot: r.data.businessSnapshot,
    guidance: r.data.guidance ?? [],
    promises,
    narrativeVsNumbers: r.data.narrativeVsNumbers ?? [],
    bull: r.data.bull ?? [],
    bear: r.data.bear ?? [],
  };
}
