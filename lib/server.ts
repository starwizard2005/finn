import "server-only";
import { FUNDAMENTALS, RESEARCH } from "./data";
import { fetchScreener } from "./sources/screener";
import type { Fundamentals } from "./types";

const live = new Map<string, { at: number; f: Fundamentals }>();

/** Snapshot first; otherwise fetch screener.in live (any NSE ticker), cached in memory for 6h. */
export async function getFundamentals(symbol: string): Promise<{ f: Fundamentals | null; live: boolean; error?: string }> {
  const s = symbol.toUpperCase().replace(/\.NS$/, "");
  if (FUNDAMENTALS[s]) return { f: FUNDAMENTALS[s], live: false };
  const hit = live.get(s);
  if (hit && Date.now() - hit.at < 6 * 36e5) return { f: hit.f, live: true };
  try {
    const f = await fetchScreener(s);
    live.set(s, { at: Date.now(), f });
    return { f, live: true };
  } catch (e) {
    return { f: null, live: true, error: (e as Error).message };
  }
}

export const seededDeep = (symbol: string) => RESEARCH[symbol.toUpperCase()] ?? null;
