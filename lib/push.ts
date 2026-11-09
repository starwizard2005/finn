/**
 * Push: materiality scoring, event clustering, and end-of-day move alerts.
 *
 * The judgment lives here and is fully explainable: every score comes with the reasons that produced it,
 * which the UI shows under "Why this is here".
 */
import type { Announcement, Category, MoveAlert, PriceSeries, ScoredAnnouncement, Thresholds, Tier } from "./types";
import { metaFor } from "./companies";

export const DEFAULT_THRESHOLDS: Thresholds = {
  pricePct: 5,
  volumeX: 2,
  categories: ["results", "m_and_a", "management_change", "litigation", "fund_raise", "capex", "credit_rating", "pledging", "insider_trading"],
};

export const BASE: Record<Category, number> = {
  results: 46,
  management_change: 50,
  m_and_a: 50,
  litigation: 55,
  fund_raise: 40,
  capex: 50,
  order_win: 38,
  credit_rating: 30,
  pledging: 55,
  insider_trading: 40,
  bonus_split: 30,
  press_release: 22,
  earnings_call: 18,
  dividend: 12,
  agm_egm: 10,
  postal_ballot: 8,
  investor_meetings: 6,
  unclassified: 4,
};

type Rule = [RegExp, number, string];
const MODIFIERS: Partial<Record<Category, Rule[]>> = {
  results: [
    [/results presentation|newspaper|press release|quarterly report|board meeting scheduled/i, -45, "Ancillary to the results filing"],
  ],
  management_change: [
    [/\b(MD|CEO|managing director|chief executive|CFO|chief financial)\b/i, 30, "Top executive role (CEO / MD / CFO)"],
    [/\b(chairman|vice-chairman)\b/i, 12, "Board chair role"],
    [/governance guidelines|completion of (his|her) tenure|superannuat/i, -8, "Planned / scheduled exit"],
    [/chief compliance|group head|senior management/i, 10, "Senior management role"],
    [/independent director|non-executive/i, -15, "Board (non-executive) seat"],
    [/company secretary|compliance officer\b(?!.*chief)/i, -25, "Secretarial role"],
  ],
  m_and_a: [
    [/incorporat\w* .*wholly owned subsidiary|strike off|business transfer agreement with .*wholly owned|slump sale/i, -30, "Internal restructuring, not a change in control"],
    [/acquire|acquisition of|merger|demerger|divest|sale of (entire )?stake|binding term sheet/i, 15, "Deal with an outside party"],
  ],
  litigation: [
    [/closure|insolvency|halt|stay|nclat|nclt|high court|supreme court/i, 20, "Can disrupt operations or ownership"],
    [/sets aside|stays|allowed the appeal/i, -5, "Outcome favourable to the company"],
    [/notices? received|action\(s\) taken/i, -20, "Routine regulatory notice"],
  ],
  fund_raise: [
    [/initial public offer|\bipo\b|qip|rights issue|preferential|will commence/i, 30, "Equity issuance / listing event"],
    [/non[- ]convertible|commercial paper|call money|first and final call/i, -25, "Routine debt / call-money paperwork"],
  ],
  order_win: [
    [/mega|ultra-mega/i, 30, "Order size: Mega"],
    [/'major'|major\*?\)?/i, 20, "Order size: Major (Rs 5,000–10,000 cr)"],
    [/'large'|large\*?\)?/i, 10, "Order size: Large (Rs 2,500–5,000 cr)"],
  ],
  credit_rating: [
    [/downgrade|negative/i, 30, "Rating downgrade / negative outlook"],
    [/upgrade|positive/i, 15, "Rating upgrade / positive outlook"],
  ],
  earnings_call: [[/transcript/i, 6, "Transcript is a primary source for Pull"]],
  press_release: [[/approv|launch|invests|crosses|record/i, 8, "Business milestone"]],
};

export function priceReaction(symbol: string, ts: string, prices: PriceSeries[]) {
  const s = prices.find((p) => p.symbol === symbol);
  if (!s) return null;
  // Work in IST regardless of the server's timezone.
  const ist = new Date(new Date(ts).getTime() + 330 * 60000);
  // reaction day = first session on/after the filing (filings after 15:30 IST react next session)
  const afterClose = ist.getUTCHours() * 60 + ist.getUTCMinutes() > 15 * 60 + 30;
  const day = new Date(ist.getTime() + (afterClose ? 864e5 : 0)).toISOString().slice(0, 10);
  const i = s.dates.findIndex((d) => d >= day);
  if (i < 1) return null;
  const avgVol = avg(s.volume.slice(Math.max(0, i - 20), i));
  return { pct: (s.close[i] / s.close[i - 1] - 1) * 100, volX: s.volume[i] / avgVol, date: s.dates[i] };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

export function score(
  a: Announcement,
  ctx: {
    prices: PriceSeries[];
    thresholds: Thresholds;
    networkTouch?: (a: Announcement) => string | null;
    resultsSignal?: (a: Announcement) => { pts: number; why: string } | null;
    /** Is this filing the most likely cause of its symbol's reaction that session? (avoids double-counting one move) */
    ownsReaction?: (a: Announcement, date: string) => boolean;
  },
): ScoredAnnouncement {
  let s = BASE[a.category];
  const reasons: string[] = [];
  const hay = `${a.headline} ${a.text} ${a.facts.join(" ")} ${a.people.map((p) => p.role ?? "").join(" ")}`;
  for (const [re, d, why] of MODIFIERS[a.category] ?? []) {
    if (re.test(hay)) {
      s += d;
      reasons.push(`${why} (${d > 0 ? "+" : ""}${d})`);
    }
  }
  if (a.category === "results" && s > 40) {
    reasons.unshift("Primary results filing");
    const sig = ctx.resultsSignal?.(a);
    if (sig) {
      s += sig.pts;
      reasons.push(`${sig.why} (+${sig.pts})`);
    }
  }

  const pr = priceReaction(a.symbol, a.ts, ctx.prices);
  if (pr && s > 15 && (ctx.ownsReaction?.(a, pr.date) ?? true)) {
    if (Math.abs(pr.pct) >= ctx.thresholds.pricePct) {
      s += 15;
      reasons.push(`Stock moved ${pr.pct > 0 ? "+" : ""}${pr.pct.toFixed(1)}% that session (+15)`);
    } else if (Math.abs(pr.pct) >= ctx.thresholds.pricePct / 2) {
      s += 6;
      reasons.push(`Stock moved ${pr.pct > 0 ? "+" : ""}${pr.pct.toFixed(1)}% that session (+6)`);
    }
    if (pr.volX >= ctx.thresholds.volumeX) {
      s += 8;
      reasons.push(`Volume ${pr.volX.toFixed(1)}× its 20-day average (+8)`);
    }
  }
  if (ctx.thresholds.categories.includes(a.category) && s >= 30) {
    s += 4;
    reasons.push("A category you asked to watch (+4)");
  }
  if (a.extractedFromPdf) {
    s += 2;
    reasons.push("Details read from the filing PDF");
  }
  const touch = ctx.networkTouch?.(a);
  if (touch && s >= 30) {
    s += 6;
    reasons.push(`${touch} (+6)`);
  }
  const w = metaFor(a.symbol).weight ?? 0;
  if (w >= 7 && s >= 30) {
    s += 4;
    reasons.push(`Large position (${w}% of book) (+4)`);
  }
  s = Math.max(0, Math.min(100, s));
  const tier: Tier = s >= 72 ? "critical" : s >= 38 ? "notable" : "routine";
  return { ...a, score: Math.round(s), tier, reasons, priceReaction: pr };
}

export type Event = { key: string; lead: ScoredAnnouncement; related: ScoredAnnouncement[] };

/**
 * Many filings describe one event (results day produces 5–8: outcome, press release, deck, ad,
 * recording, transcript). Collapse them so the investor sees one card per event.
 */
export function cluster(items: ScoredAnnouncement[]): Event[] {
  const fam = (c: Category) => (c === "results" || c === "earnings_call" ? "results" : c);
  const groups = new Map<string, ScoredAnnouncement[]>();
  for (const a of [...items].sort((x, y) => (x.ts < y.ts ? -1 : 1))) {
    const f = fam(a.category);
    // results & management changes cluster over ~10 days; others only same-day duplicates
    const span = f === "results" ? 10 : f === "management_change" || f === "litigation" ? 3 : 0;
    const keyBase = `${a.symbol}:${f}`;
    let key = [...groups.keys()].find((k) => {
      if (!k.startsWith(keyBase + "@")) return false;
      const first = groups.get(k)![0];
      return Math.abs(new Date(a.ts).getTime() - new Date(first.ts).getTime()) <= span * 864e5 + 12 * 36e5 && (span > 0 || first.headline === a.headline);
    });
    if (!key) {
      key = `${keyBase}@${a.ts}`;
      groups.set(key, []);
    }
    groups.get(key)!.push(a);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const lead = [...g].sort((a, b) => b.score - a.score)[0];
      return { key, lead, related: g.filter((x) => x !== lead).sort((a, b) => b.score - a.score) };
    })
    .sort((a, b) => b.lead.score - a.lead.score || (a.lead.ts < b.lead.ts ? 1 : -1));
}

/** End-of-day move alerts: |return| beyond X% or volume beyond N× the 20-session average. */
/** Rank used to decide which filing best explains a price move. */
export const causeRank = (a: Announcement) => {
  const h = a.headline;
  if (/presentation|newspaper|press release|quarterly report|scheduled|notices? received|action\(s\) taken/i.test(h)) return 0;
  if (a.category === "management_change" && !/\b(CEO|MD|managing director|chief executive|CFO|chief financial|chairman)\b/i.test(h + a.people.map((p) => p.role).join(" "))) return 0;
  const b = BASE[a.category];
  return b < 38 ? 0 : b + (/results filed/i.test(h) ? 20 : 0) + (a.extractedFromPdf ? 5 : 0);
};

export function moveAlerts(prices: PriceSeries[], th: Thresholds, sinceDate: string, anns: Announcement[] = []): MoveAlert[] {
  const out: MoveAlert[] = [];
  for (const s of prices) {
    for (let i = 20; i < s.dates.length; i++) {
      if (s.dates[i] < sinceDate) continue;
      const pct = (s.close[i] / s.close[i - 1] - 1) * 100;
      const volX = s.volume[i] / avg(s.volume.slice(i - 20, i));
      const p = Math.abs(pct) >= th.pricePct;
      const v = volX >= th.volumeX;
      if (!p && !v) continue;
      // Explain the move with the most material filing in the 2 days before it, if any.
      const day = new Date(s.dates[i] + "T15:30:00+05:30").getTime();
      const cands = anns
        .filter((a) => a.symbol === s.symbol && day - new Date(a.ts).getTime() < 3 * 864e5 && new Date(a.ts).getTime() < day && causeRank(a) > 0)
        .sort((a, b) => causeRank(b) - causeRank(a));
      out.push({
        id: `${s.symbol}-${s.dates[i]}`,
        symbol: s.symbol,
        date: s.dates[i],
        kind: p && v ? "both" : p ? "price" : "volume",
        pct,
        volX,
        close: s.close[i],
        explanation: cands[0]?.headline,
        linkedAnnouncementId: cands[0]?.id,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1) || Math.abs(b.pct) - Math.abs(a.pct));
}
