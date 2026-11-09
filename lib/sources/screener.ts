/**
 * screener.in company-page parser.
 *
 * Written against the plain DOM API (querySelector / textContent / getAttribute) so the exact
 * same function runs in Node (via linkedom, see fetchScreener) and in a browser. During the build
 * it was validated live against screener.in pages in a real browser before being committed.
 */
import type { Fundamentals, Table } from "../types";

type El = {
  querySelector(s: string): El | null;
  querySelectorAll(s: string): ArrayLike<El> & Iterable<El>;
  textContent: string | null;
  getAttribute(n: string): string | null;
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

export function num(s: string | null | undefined): number | null {
  const t = clean(s).replace(/[,₹%]/g, "").replace(/Cr\.?/i, "").trim();
  if (!t || t === "-" ) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function label(td: El): string {
  return clean(td.textContent).replace(/\s*\+\s*$/, "").replace(/\s+\+$/, "").split(" Share of")[0].trim();
}

function parseTable(root: El | null): Table | null {
  const table = root?.querySelector("table.data-table") ?? null;
  if (!table) return null;
  const periods = Array.from(table.querySelectorAll("thead th"))
    .map((th) => clean(th.textContent))
    .slice(1);
  const rows: Record<string, (number | null)[]> = {};
  for (const tr of Array.from(table.querySelectorAll("tbody tr"))) {
    const cells = Array.from(tr.querySelectorAll("td"));
    if (cells.length < 2) continue;
    const l = label(cells[0]);
    if (!l || /raw pdf/i.test(l)) continue;
    rows[l] = cells.slice(1).map((c) => num(c.textContent));
  }
  return { periods, rows };
}

/** Keep only the last n periods of a table (keeps payload small). */
export function tail(t: Table | null, n: number): Table | null {
  if (!t) return null;
  const rows: Table["rows"] = {};
  for (const [k, v] of Object.entries(t.rows)) rows[k] = v.slice(-n);
  return { periods: t.periods.slice(-n), rows };
}

const BSE_PDF = /AnnPdfOpen\.aspx\?Pname=/;

export function parseScreener(doc: El, symbol: string, url: string): Fundamentals {
  const name = clean(doc.querySelector("h1")?.textContent) || symbol;
  const about = clean(doc.querySelector(".company-profile .about p")?.textContent).replace(/\[\d+\]/g, "");
  const keyPoints = clean(doc.querySelector(".company-profile .commentary")?.textContent).replace(/\[\d+\]/g, "").slice(0, 900);

  const ratios: Record<string, number | null> = {};
  for (const li of Array.from(doc.querySelectorAll("#top-ratios li"))) {
    const k = clean(li.querySelector(".name")?.textContent);
    const nums = Array.from(li.querySelectorAll(".number")).map((n) => num(n.textContent));
    if (k === "High / Low") {
      ratios["High"] = nums[0] ?? null;
      ratios["Low"] = nums[1] ?? null;
    } else if (k) ratios[k] = nums[0] ?? null;
  }

  const growth: Record<string, Record<string, number | null>> = {};
  for (const t of Array.from(doc.querySelectorAll("#profit-loss table.ranges-table"))) {
    const head = clean(t.querySelector("th")?.textContent);
    const g: Record<string, number | null> = {};
    for (const tr of Array.from(t.querySelectorAll("tr"))) {
      const td = Array.from(tr.querySelectorAll("td"));
      if (td.length === 2) g[clean(td[0].textContent).replace(":", "")] = num(td[1].textContent);
    }
    if (head) growth[head] = g;
  }

  const concalls: Fundamentals["concalls"] = [];
  for (const li of Array.from(doc.querySelectorAll("#documents .concalls li"))) {
    const period = clean(li.querySelector("div")?.textContent);
    let transcript: string | null = null;
    let ppt: string | null = null;
    for (const a of Array.from(li.querySelectorAll("a"))) {
      const t = clean(a.textContent);
      const href = a.getAttribute("href");
      // BSE's viewer URL -> the direct PDF path (more reliable for server-side fetches)
      if (t === "Transcript") transcript = href?.replace(/https?:\/\/www\.bseindia\.com\/stockinfo\/AnnPdfOpen\.aspx\?Pname=/, "https://www.bseindia.com/xml-data/corpfiling/AttachHis/") ?? null;
      if (t === "PPT") ppt = href;
    }
    if (period) concalls.push({ period, transcript, ppt });
  }

  const annualReports: Fundamentals["annualReports"] = [];
  for (const a of Array.from(doc.querySelectorAll("#documents .annual-reports li a"))) {
    const t = clean(a.textContent);
    const m = t.match(/(\d{4})/);
    if (m) annualReports.push({ year: Number(m[1]), url: a.getAttribute("href") ?? "" });
  }

  const section = (id: string) => doc.querySelector(`#${id}`);
  return {
    symbol,
    name,
    source: url,
    fetchedAt: new Date().toISOString(),
    about,
    keyPoints,
    ratios,
    growth,
    quarters: tail(parseTable(section("quarters")), 13),
    annual: tail(parseTable(section("profit-loss")), 8),
    balance: tail(parseTable(section("balance-sheet")), 7),
    cashflow: tail(parseTable(section("cash-flow")), 7),
    efficiency: tail(parseTable(section("ratios")), 7),
    concalls: concalls.slice(0, 8),
    annualReports: annualReports.slice(0, 3),
    isBank: !!parseTable(section("quarters"))?.rows["Financing Profit"],
  };
}

export const isBsePdf = (u: string) => BSE_PDF.test(u);

/** Server-side fetch (Node / Vercel / GitHub Actions). */
export async function fetchScreener(symbol: string): Promise<Fundamentals> {
  const { parseHTML } = await import("linkedom");
  const headers = {
    "user-agent": "Mozilla/5.0 (FINN research prototype; +https://github.com/)",
    accept: "text/html",
  };
  for (const variant of ["consolidated/", ""]) {
    const url = `https://www.screener.in/company/${encodeURIComponent(symbol)}/${variant}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) continue;
    const { document } = parseHTML(await res.text());
    const f = parseScreener(document as unknown as El, symbol, url);
    // Some companies have no consolidated numbers: fall back to standalone.
    if (f.quarters && Object.keys(f.quarters.rows).length) return f;
  }
  throw new Error(`screener.in: no data for ${symbol}`);
}
