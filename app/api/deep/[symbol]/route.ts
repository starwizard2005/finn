import { NextResponse } from "next/server";
import { deepAnalysis } from "@/lib/deep";
import { hasKey } from "@/lib/llm";
import { getFundamentals, seededDeep } from "@/lib/server";
import { fetchScreener } from "@/lib/sources/screener";

export const maxDuration = 120;

/** GET /api/deep/KAYNES — promised-vs-delivered. Cached at the CDN for a day (one model run per company per day). */
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const seeded = seededDeep(symbol);
  if (seeded) return NextResponse.json(seeded);
  if (!hasKey())
    return NextResponse.json({ error: "Live transcript analysis needs a Gemini API key on the server (GEMINI_API_KEY). The seeded companies (Kaynes, Persistent, Navin Fluorine) work without one." }, { status: 503 });
  const { f: snap, error } = await getFundamentals(symbol);
  if (!snap) return NextResponse.json({ error: error ?? "Company not found" }, { status: 404 });
  let f = snap;
  // The snapshot keeps transcript links only for the research list; fetch them live for everyone else.
  if (!f.concalls.some((c) => c.transcript)) {
    try {
      const fresh = await fetchScreener(symbol.toUpperCase());
      f = { ...f, concalls: fresh.concalls };
    } catch (e) {
      return NextResponse.json({ error: `Couldn't fetch transcript links from screener.in: ${(e as Error).message}` }, { status: 502 });
    }
  }
  try {
    const d = await deepAnalysis(f);
    return NextResponse.json(d, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
