import { NextResponse } from "next/server";
import { generateJSON, hasKey } from "@/lib/llm";
import { pdfText } from "@/lib/sources/pdf";
import { fetchScreener } from "@/lib/sources/screener";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** GET /api/diag?symbol=TITAN — checks each live dependency separately, with timings. Never prints secrets. */
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "TITAN";
  const out: Record<string, unknown> = { region: process.env.VERCEL_REGION ?? "local", geminiKeyPresent: hasKey() };
  const time = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      out[name] = { ok: true, ms: Date.now() - t, result: await fn() };
      (out[name] as { ms: number }).ms = Date.now() - t;
    } catch (e) {
      out[name] = { ok: false, ms: Date.now() - t, error: (e as Error).message.slice(0, 300) };
    }
  };
  let transcript: string | null = null;
  await time("screener", async () => {
    const f = await fetchScreener(symbol);
    transcript = f.concalls.find((c) => c.transcript)?.transcript ?? null;
    return { quarters: f.quarters?.periods.length, transcript };
  });
  await time("bsePdf", async () => {
    if (!transcript) throw new Error("no transcript link");
    const t = await pdfText(transcript, 5, 15000);
    return { chars: t.length };
  });
  await time("gemini", async () => {
    const r = await generateJSON<{ ok: boolean }>({ tier: "fast", system: "Reply with JSON only.", prompt: 'Return {"ok":true}', maxTokens: 20, timeoutMs: 20000 });
    return { model: r.model, data: r.data };
  });
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
