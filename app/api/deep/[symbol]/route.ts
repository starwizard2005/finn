import { NextResponse } from "next/server";
import { deepAnalysis } from "@/lib/deep";
import { hasKey } from "@/lib/llm";
import { getFundamentals, seededDeep } from "@/lib/server";

export const maxDuration = 60;

/** GET /api/deep/KAYNES — promised-vs-delivered. Cached at the CDN for a day (one model run per company per day). */
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const seeded = seededDeep(symbol);
  if (seeded) return NextResponse.json(seeded);
  if (!hasKey())
    return NextResponse.json({ error: "Live transcript analysis needs a Gemini API key on the server (GEMINI_API_KEY). The seeded companies (Kaynes, Persistent, Navin Fluorine) work without one." }, { status: 503 });
  const { f, error } = await getFundamentals(symbol);
  if (!f) return NextResponse.json({ error: error ?? "Company not found" }, { status: 404 });
  try {
    const d = await deepAnalysis(f);
    return NextResponse.json(d, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
