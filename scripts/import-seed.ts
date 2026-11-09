/**
 * Converts the raw captures in data/raw/ (collected from NSE, Yahoo Finance, screener.in and BSE
 * during the build) into the same snapshot format the live pipeline (scripts/refresh.ts) writes.
 *
 *   npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import { classify, headlineFrom } from "../lib/classify";
import type { Announcement, Fundamentals, PersonMention, PriceSeries, Table } from "../lib/types";

const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data/raw");
const OUT = path.join(ROOT, "data");
const BSE = "https://www.bseindia.com/xml-data/corpfiling/AttachHis/";
const NSE = "https://nsearchives.nseindia.com/corporate/";
export const SNAPSHOT_AT = "2026-11-09T17:00:00+05:30";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- prices ----------
function prices(): PriceSeries[] {
  const lines = fs.readFileSync(path.join(RAW, "prices.txt"), "utf8").trim().split("\n");
  const [yr, ds] = lines[0].split(" ");
  const dates = ds.split(",").map((d) => `${yr}-${d}`);
  return lines.slice(1).map((l) => {
    const [symbol, c, v] = l.split("|");
    return { symbol, dates, close: c.split(",").map(Number), volume: v.split(",").map((x) => Number(x) * 1000) };
  });
}

// ---------- announcements ----------
type Detail = { headline?: string; facts?: string[]; people?: PersonMention[]; profile?: { name: string }; profiles?: { name: string }[] };

function announcements(): Announcement[] {
  const details: Record<string, Detail> = JSON.parse(fs.readFileSync(path.join(RAW, "filing_details.json"), "utf8"));
  const rows = fs
    .readFileSync(path.join(RAW, "announcements.txt"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"));
  return rows.map((l) => {
    const [symbol, dt, nseDesc, rawText, file] = l.split("|");
    const [md, hm] = dt.split(" ");
    const ts = `2026-${md}T${hm}:00+05:30`;
    const d = file && file !== "-" ? details[file] : undefined;
    // PDF-extracted headline/facts (when present) sharpen classification of vague subject lines.
    const { category } = classify(nseDesc, [rawText, d?.headline ?? "", ...(d?.facts ?? [])].join(" "));
    const text = rawText.replace(/^~/, "").trim();

    let people: PersonMention[] = d?.people ?? [];
    if (d?.profile && !people.length) people = [{ name: d.profile.name, change: "appointed", profileId: slug(d.profile.name) }];
    if (d?.profiles) people = d.profiles.map((p) => ({ name: p.name, change: "appointed", role: "Senior Management", profileId: slug(p.name) }));
    people = people.map((p) => ({ ...p, profileId: p.profileId ?? slug(p.name) }));

    return {
      id: file && file !== "-" ? file.replace(/\.pdf$/i, "") : `${symbol}_${md}_${hm}`.replace(/[^\w]/g, ""),
      symbol,
      ts,
      nseDesc,
      text,
      file: file && file !== "-" ? NSE + file : null,
      category,
      headline: d?.headline ?? headlineFrom(nseDesc, rawText, category, ts),
      facts: d?.facts ?? [],
      people,
      extractedFromPdf: !!d,
    } satisfies Announcement;
  });
}

// ---------- fundamentals ----------
type Compact = { p: string[]; r: Record<string, (number | null)[]> } | null | undefined;
const table = (t: Compact): Table | null => (t ? { periods: t.p, rows: t.r } : null);

function fundamentals(): Fundamentals[] {
  const out: Fundamentals[] = [];
  for (const f of ["screener_1.json", "screener_2.json", "screener_3.json", "screener_4.json"]) {
    const j = JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8"));
    for (const [symbol, v] of Object.entries<any>(j)) {
      const link = (s: string) => s.replace(/^bsea?:/, BSE);
      out.push({
        symbol,
        name: v.name,
        source: `https://www.screener.in/company/${symbol}/consolidated/`,
        fetchedAt: SNAPSHOT_AT,
        about: v.about,
        keyPoints: v.kp ?? "",
        ratios: v.ratios,
        growth: v.growth,
        quarters: table(v.q),
        annual: table(v.a),
        balance: table(v.b),
        cashflow: table(v.cf),
        efficiency: table(v.e),
        concalls: (v.cc ?? []).map((x: string) => {
          const [period, u] = x.split("=");
          return { period, transcript: u && u !== "-" ? link(u) : null, ppt: null };
        }),
        annualReports: (v.ar ?? []).map((x: string) => {
          const [year, u] = x.split("=");
          return { year: Number(year), url: link(u) };
        }),
        isBank: !!v.q?.r?.["Financing Profit"],
      });
    }
  }
  return out;
}

/** Combine data/research/*.json (one deep analysis per company) into data/research.json. */
export function writeResearchIndex() {
  const dir = path.join(OUT, "research");
  const all: Record<string, unknown> = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) all[f.replace(".json", "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  fs.writeFileSync(path.join(OUT, "research.json"), JSON.stringify(all));
}

function main() {
  const p = prices();
  const a = announcements();
  const f = fundamentals();
  fs.writeFileSync(path.join(OUT, "prices.json"), JSON.stringify(p));
  fs.writeFileSync(path.join(OUT, "announcements.json"), JSON.stringify(a, null, 1));
  fs.writeFileSync(path.join(OUT, "fundamentals.json"), JSON.stringify(Object.fromEntries(f.map((x) => [x.symbol, x]))));
  writeResearchIndex();
  fs.writeFileSync(
    path.join(OUT, "snapshot.json"),
    JSON.stringify(
      {
        generatedAt: SNAPSHOT_AT,
        generatedBy: "seed (captured live from NSE / Yahoo / screener.in / BSE during the build)",
        announcementsFrom: "2026-10-20",
        sources: ["nseindia.com corporate announcements API", "Yahoo Finance chart API (EOD)", "screener.in company pages", "BSE / NSE filing PDFs"],
        fundamentals: f.map((x) => x.symbol),
      },
      null,
      1,
    ),
  );
  const byCat: Record<string, number> = {};
  for (const x of a) byCat[x.category] = (byCat[x.category] ?? 0) + 1;
  console.log(`prices: ${p.length} series · announcements: ${a.length} · fundamentals: ${f.length}`);
  console.log(byCat);
}

if (require.main === module) main();
