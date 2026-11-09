/** Snapshot data access (pure imports — works server-side and client-side). */
import announcementsJson from "@/data/announcements.json";
import fundamentalsJson from "@/data/fundamentals.json";
import pricesJson from "@/data/prices.json";
import researchJson from "@/data/research.json";
import snapshot from "@/data/snapshot.json";
import { helpersFor, pathsTo } from "./network";
import { resultsCard } from "./research";
import { reportedQuarter } from "./classify";
import { causeRank, cluster, DEFAULT_THRESHOLDS, moveAlerts, priceReaction, score, type Event } from "./push";
import type { Announcement, DeepAnalysis, Fundamentals, MoveAlert, PriceSeries, Thresholds } from "./types";

export const SNAPSHOT = snapshot;
export const NOW = snapshot.generatedAt;
export const ANNOUNCEMENTS = announcementsJson as unknown as Announcement[];
export const PRICES = pricesJson as unknown as PriceSeries[];
export const FUNDAMENTALS = fundamentalsJson as unknown as Record<string, Fundamentals>;
export const RESEARCH = researchJson as unknown as Record<string, DeepAnalysis>;

export const priceOf = (symbol: string) => PRICES.find((p) => p.symbol === symbol);

const touchCache = new Map<string, string | null>();
/** Does the investor's network give them an edge on this filing? (used as a scoring nudge + card footer) */
export function networkTouch(a: Announcement): string | null {
  const k = a.id;
  if (touchCache.has(k)) return touchCache.get(k)!;
  let out: string | null = null;
  for (const p of a.people) {
    if (p.change === "appointed" && p.profileId) {
      const best = pathsTo(p.profileId).find((x) => x.link?.kind !== "alumni");
      if (best) {
        out = best.via ? `${best.via.name} overlapped with ${p.name}` : `You overlapped with ${p.name}`;
        break;
      }
    }
  }
  if (!out) {
    const h = helpersFor(a.symbol, { event: a.category, limit: 1 })[0];
    if (h && h.score > 0.55) out = `${h.person.name}: ${h.why}`;
  }
  touchCache.set(k, out);
  return out;
}

/** Results-day surprise from the reported numbers: big profit swings or margin moves earn attention. */
export function resultsSignal(a: Announcement): { pts: number; why: string } | null {
  if (!/results filed/i.test(a.headline)) return null;
  const f = FUNDAMENTALS[a.symbol];
  const r = f && resultsCard(f);
  if (!r || r.quarter !== reportedQuarter(a.ts)) return null;
  const pat = r.lines[r.lines.length - 1].yoy;
  const dm = r.margin?.cur != null && r.margin.yoyPrev != null ? r.margin.cur - r.margin.yoyPrev : 0;
  if (pat == null) return null;
  if (Math.abs(pat) >= 25 || Math.abs(dm) >= 3) return { pts: 18, why: `Big swing: PAT ${pat > 0 ? "+" : ""}${pat.toFixed(0)}% YoY${Math.abs(dm) >= 1 ? `, margin ${dm > 0 ? "+" : ""}${dm.toFixed(0)} pts` : ""}` };
  if (Math.abs(pat) >= 12) return { pts: 8, why: `PAT ${pat > 0 ? "+" : ""}${pat.toFixed(0)}% YoY` };
  return null;
}

// For each (symbol, reaction session) the filing with the highest cause-rank "owns" the price move.
const owner = new Map<string, string>();
for (const a of [...ANNOUNCEMENTS].sort((x, y) => causeRank(y) - causeRank(x))) {
  const pr = priceReaction(a.symbol, a.ts, PRICES);
  if (!pr) continue;
  const k = `${a.symbol}@${pr.date}`;
  if (!owner.has(k)) owner.set(k, a.id);
}
const ownsReaction = (a: Announcement, date: string) => owner.get(`${a.symbol}@${date}`) === a.id;

const ctx = (th: Thresholds) => ({ prices: PRICES, thresholds: th, networkTouch, resultsSignal, ownsReaction });

export type Digest = { events: Event[]; moves: MoveAlert[]; from: string; to: string; total: number };

export function digest(hours: number, th: Thresholds = DEFAULT_THRESHOLDS): Digest {
  const to = new Date(NOW).getTime();
  const from = to - hours * 36e5;
  const inWin = ANNOUNCEMENTS.filter((a) => {
    const t = new Date(a.ts).getTime();
    return t > from && t <= to;
  });
  const scored = inWin.map((a) => score(a, ctx(th)));
  const sinceDate = new Date(from + 330 * 60000).toISOString().slice(0, 10);
  return {
    events: cluster(scored),
    moves: moveAlerts(PRICES, th, sinceDate, ANNOUNCEMENTS),
    from: new Date(from).toISOString(),
    to: NOW,
    total: inWin.length,
  };
}

export function scoredById(id: string, th: Thresholds = DEFAULT_THRESHOLDS) {
  const a = ANNOUNCEMENTS.find((x) => x.id === id);
  return a ? score(a, ctx(th)) : null;
}

/** All filings belonging to the same event as `id` (results day etc.). */
export function eventFor(id: string): Event | null {
  const all = cluster(ANNOUNCEMENTS.map((a) => score(a, ctx(DEFAULT_THRESHOLDS))));
  return all.find((e) => e.lead.id === id || e.related.some((r) => r.id === id)) ?? null;
}
