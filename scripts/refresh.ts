/**
 * Live data pipeline:  npm run refresh   (run daily after market close; see .github/workflows/refresh.yml)
 *
 *   1. Prices      Yahoo Finance chart API (EOD close + volume, 3 months)       -> data/prices.json
 *   2. Filings     NSE corporate-announcements API (cookie warm-up)             -> data/announcements.json
 *                  rules classify everything; material filings get their PDF read (unpdf) and, if a
 *                  GEMINI_API_KEY is set, a fast-model extraction of headline / facts / people.
 *   3. Fundamentals screener.in company pages, parsed by lib/sources/screener.ts -> data/fundamentals.json
 *   4. Research    promised-vs-delivered for the research list (fast map + smart reduce) -> data/research/*.json
 *
 * Every stage is independent and fail-safe: if a source is down or blocks the runner, the previous snapshot
 * for that stage is kept, so the deployed demo never breaks.
 */
import fs from "node:fs";
import path from "node:path";
import { classify, headlineFrom } from "../lib/classify";
import { COMPANIES } from "../lib/companies";
import { deepAnalysis } from "../lib/deep";
import { generateJSON, hasKey } from "../lib/llm";
import { pdfText } from "../lib/sources/pdf";
import { fetchScreener } from "../lib/sources/screener";
import type { Announcement, Category, Fundamentals, PersonMention, PriceSeries } from "../lib/types";
import { writeResearchIndex } from "./import-seed";

const DATA = path.join(__dirname, "..", "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DAYS = Number(process.env.FINN_DAYS ?? 21);
const read = <T,>(f: string, d: T): T => (fs.existsSync(path.join(DATA, f)) ? JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) : d);
const write = (f: string, v: unknown) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 1. prices ----------
async function prices(): Promise<PriceSeries[]> {
  const out: PriceSeries[] = [];
  for (const c of COMPANIES) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${c.symbol}.NS?range=3mo&interval=1d`, { headers: { "user-agent": UA } });
    if (!r.ok) throw new Error(`Yahoo ${c.symbol}: ${r.status}`);
    const j = await r.json();
    const res = j.chart.result[0];
    const q = res.indicators.quote[0];
    const keep = res.timestamp.map((_: number, i: number) => q.close[i] != null && q.volume[i] != null);
    const N = 45;
    out.push({
      symbol: c.symbol,
      dates: res.timestamp.filter((_: number, i: number) => keep[i]).map((t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10)).slice(-N),
      close: q.close.filter((_: number, i: number) => keep[i]).map((x: number) => +x.toFixed(2)).slice(-N),
      volume: q.volume.filter((_: number, i: number) => keep[i]).slice(-N),
    });
    await sleep(250);
  }
  return out;
}

// ---------- 2. announcements ----------
async function nseSession(): Promise<string> {
  const r = await fetch("https://www.nseindia.com/companies-listing/corporate-filings-announcements", { headers: { "user-agent": UA, accept: "text/html" } });
  const set = r.headers.getSetCookie?.() ?? [];
  return set.map((c) => c.split(";")[0]).join("; ");
}

const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
const MATERIAL: Category[] = ["management_change", "m_and_a", "litigation", "fund_raise", "capex", "order_win", "credit_rating", "pledging"];

type Extract = { headline: string; facts: string[]; people: (PersonMention & { profile?: { summary?: string; career?: { org: string; role?: string; from?: number; to?: number }[]; education?: { org: string; degree?: string }[] } })[] };

async function announcements(prev: Announcement[]): Promise<Announcement[]> {
  const cookie = await nseSession();
  const to = new Date();
  const from = new Date(Date.now() - DAYS * 864e5);
  const prevById = new Map(prev.map((a) => [a.id, a]));
  const out: Announcement[] = [];
  for (const c of COMPANIES.filter((x) => x.portfolio)) {
    const r = await fetch(`https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(c.symbol)}&from_date=${ddmmyyyy(from)}&to_date=${ddmmyyyy(to)}`, {
      headers: { "user-agent": UA, accept: "application/json", referer: "https://www.nseindia.com/companies-listing/corporate-filings-announcements", cookie },
    });
    if (!r.ok) throw new Error(`NSE ${c.symbol}: ${r.status}`);
    const rows = (await r.json()) as { sort_date: string; desc: string; attchmntText: string; attchmntFile: string; symbol: string }[];
    for (const x of rows) {
      const file = x.attchmntFile && x.attchmntFile !== "-" ? x.attchmntFile : null;
      const id = file ? file.split("/").pop()!.replace(/\.pdf$/i, "") : `${x.symbol}_${x.sort_date.replace(/\W/g, "")}`;
      if (prevById.has(id)) {
        out.push(prevById.get(id)!); // already processed (and possibly LLM-enriched) — don't pay twice
        continue;
      }
      const text = (x.attchmntText ?? "").replace(/\s+/g, " ").replace(/^.*? has (informed|submitted (to )?)the Exchange (about|regarding)?\s*/i, "~").slice(0, 400);
      const ts = x.sort_date.replace(" ", "T") + "+05:30";
      let { category, confident } = classify(x.desc, text);
      let a: Announcement = { id, symbol: c.symbol, ts, nseDesc: x.desc, text: text.replace(/^~/, ""), file, category, headline: headlineFrom(x.desc, text, category, ts), facts: [], people: [], extractedFromPdf: false };
      // Read the PDF only where it matters (material categories, or ones the rules weren't sure about)
      if (file && hasKey() && (MATERIAL.includes(category) || !confident)) {
        try {
          const pdf = (await pdfText(file, 8)).slice(0, 14000);
          const ex = await generateJSON<Extract & { category?: Category }>({
            tier: "fast",
            system: "You read Indian stock-exchange filings and extract facts. Use only the document. JSON only.",
            prompt: `Exchange subject: ${x.desc}. ${confident ? "" : `Also classify into one of: results, m_and_a, fund_raise, management_change, litigation, insider_trading, earnings_call, investor_meetings, credit_rating, dividend, bonus_split, capex, press_release, postal_ballot, agm_egm, pledging, order_win, unclassified.`}
Document:\n${pdf}\n
Return {"headline":"<= 14 words, specific, no company name","facts":["<=3 short factual bullets with numbers/dates"],"people":[{"name":"","role":"","change":"appointed|ceased","profile":{"summary":"one line","career":[{"org":"","role":"","from":2010,"to":2020}],"education":[{"org":"","degree":""}]}}]${confident ? "" : ',"category":""'}}`,
            maxTokens: 1200,
          });
          if (!confident && ex.data.category) category = ex.data.category;
          a = { ...a, category, headline: ex.data.headline || a.headline, facts: ex.data.facts ?? [], people: (ex.data.people ?? []).map((p) => ({ name: p.name, role: p.role, change: p.change, profileId: slug(p.name) })), extractedFromPdf: true };
          addPublicProfiles(ex.data.people ?? [], c.symbol, id);
        } catch (e) {
          log("  pdf/llm skipped", id, (e as Error).message);
        }
      }
      out.push(a);
    }
    await sleep(400);
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

const slug = (s: string) => s.toLowerCase().replace(/^(mr|ms|mrs|dr)\.?\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** People named in filings become public profiles the Network can link to (never contacts). */
function addPublicProfiles(people: Extract["people"], symbol: string, sourceRef: string) {
  const net = read<{ investor: unknown; people: { id: string }[] }>("network.json", { investor: null, people: [] });
  let changed = false;
  for (const p of people) {
    if (p.change !== "appointed" || !p.profile?.career?.length) continue;
    const id = slug(p.name);
    if (net.people.some((x) => x.id === id)) continue;
    const co = COMPANIES.find((c) => c.symbol === symbol)!;
    net.people.push({
      id,
      name: p.name.replace(/^(Mr|Ms|Mrs)\.?\s+/i, ""),
      kind: "public",
      headline: `${p.role ?? "Appointed"}, ${co.short}`,
      career: [...p.profile.career, { org: co.name, role: p.role, from: new Date().getFullYear(), to: null }],
      education: p.profile.education ?? [],
      expertise: co.themes,
      source: "filing",
      sourceRef,
    } as never);
    changed = true;
  }
  if (changed) fs.writeFileSync(path.join(DATA, "network.json"), JSON.stringify(net, null, 1));
}

// ---------- 3. fundamentals ----------
async function fundamentals(prev: Record<string, Fundamentals>) {
  const out = { ...prev };
  for (const c of COMPANIES) {
    try {
      out[c.symbol] = await fetchScreener(c.symbol);
    } catch (e) {
      log("  screener kept previous", c.symbol, (e as Error).message);
    }
    await sleep(1200); // be polite
  }
  return out;
}

// ---------- 4. research ----------
async function research(f: Record<string, Fundamentals>) {
  if (!hasKey()) return log("research: no GEMINI_API_KEY, keeping existing analyses");
  fs.mkdirSync(path.join(DATA, "research"), { recursive: true });
  for (const c of COMPANIES.filter((x) => x.research)) {
    try {
      const d = await deepAnalysis(f[c.symbol]);
      fs.writeFileSync(path.join(DATA, "research", `${c.symbol}.json`), JSON.stringify(d, null, 1));
      log("research ok", c.symbol, d.generatedBy);
    } catch (e) {
      log("research kept previous", c.symbol, (e as Error).message);
    }
  }
  writeResearchIndex();
}

async function stage<T>(name: string, fn: () => Promise<T>, onOk: (v: T) => void) {
  try {
    const v = await fn();
    onOk(v);
    log(`✓ ${name}`);
    return true;
  } catch (e) {
    log(`✗ ${name} — keeping previous snapshot (${(e as Error).message})`);
    return false;
  }
}

async function main() {
  const only = process.argv[2]; // optional: prices | filings | fundamentals | research
  const ok: Record<string, boolean> = {};
  if (!only || only === "prices") ok.prices = await stage("prices", prices, (v) => write("prices.json", v));
  if (!only || only === "filings") ok.filings = await stage("filings", () => announcements(read("announcements.json", [])), (v) => write("announcements.json", v));
  let f = read<Record<string, Fundamentals>>("fundamentals.json", {});
  if (!only || only === "fundamentals") ok.fundamentals = await stage("fundamentals", () => fundamentals(f), (v) => ((f = v), write("fundamentals.json", v)));
  if (!only || only === "research") await research(f);
  if (Object.values(ok).some(Boolean)) {
    const snap = read<Record<string, unknown>>("snapshot.json", {});
    write("snapshot.json", { ...snap, generatedAt: new Date(Date.now() + 330 * 60000).toISOString().replace("Z", "+05:30"), generatedBy: "scripts/refresh.ts", stages: ok, announcementsFrom: new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10) });
  }
}

main();
