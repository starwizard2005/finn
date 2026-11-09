/**
 * Deterministic research engine. Works for ANY NSE ticker with a screener.in page.
 * Principle: numbers are computed by code from primary-sourced financials; the LLM is reserved for
 * reading words (transcripts / annual reports) — so the numbers can never be hallucinated.
 */
import { chg, cr, pct } from "./format";
import { fyQuarter } from "./classify";
import type { Fundamentals, Metric, Table } from "./types";

const row = (t: Table | null | undefined, ...names: string[]) => {
  if (!t) return null;
  for (const n of names) if (t.rows[n]) return t.rows[n];
  return null;
};
const last = <T,>(xs: T[] | null | undefined, k = 1) => (xs && xs.length >= k ? xs[xs.length - k] : null);

export type ResultLine = { label: string; cur: number | null; qoq: number | null; yoy: number | null; note?: string };
export type ResultsCard = { period: string; quarter: string; lines: ResultLine[]; margin?: { cur: number | null; prev: number | null; yoyPrev: number | null }; takeaway: string; isBank: boolean };

/** First cut of the headline numbers for the latest quarter: this quarter vs last quarter (QoQ) and vs a year ago (YoY). */
export function resultsCard(f: Fundamentals): ResultsCard | null {
  const q = f.quarters;
  if (!q || q.periods.length < 5) return null;
  const n = q.periods.length;
  const L = (label: string, r: (number | null)[] | null, note?: string): ResultLine => ({
    label,
    cur: r?.[n - 1] ?? null,
    qoq: r ? chg(r[n - 1], r[n - 2]) : null,
    yoy: r ? chg(r[n - 1], r[n - 5]) : null,
    note,
  });
  const rev = row(q, "Sales", "Revenue");
  const pbt = row(q, "Profit before tax");
  const pat = row(q, "Net Profit");
  const lines: ResultLine[] = [L("Revenue", rev)];
  if (f.isBank) {
    const intr = row(q, "Interest");
    const nii = rev && intr ? rev.map((v, i) => (v != null && intr[i] != null ? v - (intr[i] as number) : null)) : null;
    lines.push(L("Revenue − interest", nii, "Lenders: proxy for net interest income; EBITDA is not meaningful"));
  } else {
    lines.push(L("EBITDA", row(q, "Operating Profit"), "Operating profit before other income"));
  }
  lines.push(L("PBT", pbt), L("PAT", pat));

  const opm = row(q, "OPM %", "Financing Margin %");
  const margin = !f.isBank && opm ? { cur: opm[n - 1], prev: opm[n - 2], yoyPrev: opm[n - 5] } : undefined;

  // Deterministic one-line takeaway
  const r = lines[0];
  const p = lines[lines.length - 1];
  const bits: string[] = [];
  if (r.yoy != null) bits.push(`Revenue ${r.yoy >= 0 ? "up" : "down"} ${Math.abs(r.yoy).toFixed(0)}% YoY`);
  if (p.yoy != null) bits.push(`PAT ${p.yoy >= 0 ? "up" : "down"} ${Math.abs(p.yoy).toFixed(0)}%`);
  if (margin?.cur != null && margin.yoyPrev != null && Math.abs(margin.cur - margin.yoyPrev) >= 1)
    bits.push(`margin ${margin.cur > margin.yoyPrev ? "expanded" : "compressed"} ${margin.yoyPrev}→${margin.cur}%`);
  const oi = row(q, "Other Income");
  if (oi && pbt && oi[n - 1] != null && pbt[n - 1] && Math.abs(oi[n - 1]! - (oi[n - 5] ?? 0)) > 0.2 * Math.abs(pbt[n - 1]!))
    bits.push(`other income swung ${cr(oi[n - 5])} → ${cr(oi[n - 1])}`);
  let takeaway = bits.join("; ");
  if (r.yoy != null && p.yoy != null) {
    if (r.yoy > 5 && p.yoy < -5) takeaway += ". Growth didn't reach the bottom line.";
    else if (p.yoy > r.yoy + 10) takeaway += ". Operating leverage is showing.";
  }
  return { period: q.periods[n - 1], quarter: fyQuarter(q.periods[n - 1]), lines, margin, takeaway: takeaway ? takeaway + (takeaway.endsWith(".") ? "" : ".") : "", isBank: f.isBank };
}

const cagr = (a: number | null, b: number | null, years: number) =>
  a == null || b == null || a <= 0 || b <= 0 ? null : (Math.pow(b / a, 1 / years) - 1) * 100;

export type Flag = { text: string; tone: "good" | "bad" | "neutral" };
export type Section = { id: string; title: string; metrics: Metric[]; bullets: Flag[]; series?: { label: string; periods: string[]; values: (number | null)[]; unit?: string }[] };

export function analyse(f: Fundamentals): Section[] {
  const A = f.annual;
  const yrs = A ? A.periods.filter((p) => p !== "TTM") : [];
  const ai = (name: string[]) => {
    const r = row(A, ...name);
    return r ? r.slice(0, yrs.length) : null;
  };
  const sales = ai(["Sales", "Revenue"]);
  const op = ai(["Operating Profit", "Financing Profit"]);
  const pat = ai(["Net Profit"]);
  const opm = ai(["OPM %", "Financing Margin %"]);
  const n = yrs.length;
  const sections: Section[] = [];

  // --- Financial snapshot
  const R = f.ratios;
  sections.push({
    id: "snapshot",
    title: "Financial snapshot",
    metrics: [
      { label: "Market cap", value: cr(R["Market Cap"]) },
      { label: "P/E", value: R["Stock P/E"] != null ? `${R["Stock P/E"]}×` : "—" },
      { label: "ROCE", value: pct(R["ROCE"], 1, false) },
      { label: "ROE", value: pct(R["ROE"], 1, false) },
      { label: `Revenue ${yrs[n - 1] ?? ""}`, value: cr(last(sales)) },
      { label: f.isBank ? "PAT" : "EBITDA margin", value: f.isBank ? cr(last(pat)) : pct(last(opm), 0, false) },
    ],
    bullets: [],
  });

  // --- Trajectory
  const t: Flag[] = [];
  const c3 = n >= 4 ? cagr(sales?.[n - 4] ?? null, last(sales), 3) : null;
  const c5 = n >= 6 ? cagr(sales?.[n - 6] ?? null, last(sales), 5) : null;
  const p3 = n >= 4 ? cagr(pat?.[n - 4] ?? null, last(pat), 3) : null;
  if (c3 != null) t.push({ text: `Revenue compounded ${c3.toFixed(0)}% a year over 3 years${c5 != null ? ` (${c5.toFixed(0)}% over 5)` : ""}.`, tone: c3 > 12 ? "good" : c3 < 5 ? "bad" : "neutral" });
  if (p3 != null && c3 != null) {
    const gap = p3 - c3;
    t.push({ text: `Profit compounded ${p3.toFixed(0)}% a year — ${Math.abs(gap) < 3 ? "in line with" : gap > 0 ? "faster than" : "slower than"} revenue.`, tone: gap > 3 ? "good" : gap < -3 ? "bad" : "neutral" });
  }
  if (opm && n >= 4 && !f.isBank) {
    const a = opm[n - 4];
    const b = opm[n - 1];
    if (a != null && b != null) t.push({ text: `Operating margin ${b > a ? "expanded" : b < a ? "compressed" : "held"}: ${a}% → ${b}% over 3 years.`, tone: b - a >= 1 ? "good" : a - b >= 1 ? "bad" : "neutral" });
  }
  const q = f.quarters;
  if (q && q.periods.length >= 5) {
    const qs = row(q, "Sales", "Revenue")!;
    const qm = row(q, "OPM %", "Financing Margin %");
    const k = q.periods.length;
    const g = chg(qs[k - 1], qs[k - 5]);
    if (g != null) t.push({ text: `Latest quarter (${fyQuarter(q.periods[k - 1])}): revenue ${pct(g, 0)} YoY${qm && !f.isBank ? `, margin ${qm[k - 5]}% → ${qm[k - 1]}%` : ""}.`, tone: g > 10 ? "good" : g < 0 ? "bad" : "neutral" });
  }
  sections.push({
    id: "trajectory",
    title: "Trajectory",
    metrics: [
      { label: "Revenue CAGR 3y", value: pct(c3, 0, false) },
      { label: "PAT CAGR 3y", value: pct(p3, 0, false) },
    ],
    bullets: t,
    series: [
      { label: "Revenue (₹ cr)", periods: yrs, values: sales ?? [] },
      ...(f.isBank ? [] : [{ label: "EBITDA margin %", periods: yrs, values: opm ?? [], unit: "%" }]),
      { label: "PAT (₹ cr)", periods: yrs, values: pat ?? [] },
    ],
  });

  // --- Balance sheet
  const B = f.balance;
  const bp = B?.periods ?? [];
  const eq = row(B, "Equity Capital");
  const res = row(B, "Reserves");
  const debt = row(B, "Borrowings", "Borrowing");
  const nw = eq && res ? eq.map((v, i) => (v ?? 0) + (res[i] ?? 0)) : null;
  const de = nw && debt ? debt.map((d, i) => (d != null && nw[i] ? d / nw[i] : null)) : null;
  const b: Flag[] = [];
  if (de && de.length >= 2) {
    const d0 = de[0];
    const d1 = last(de);
    if (d1 != null) {
      if (f.isBank) b.push({ text: `Borrowings are ${d1.toFixed(1)}× net worth (deposits are the main funding).`, tone: "neutral" });
      else b.push({ text: `Debt-to-equity ${d1.toFixed(2)}× (${bp[bp.length - 1]})${d0 != null ? `, from ${d0.toFixed(2)}× in ${bp[0]}` : ""}.`, tone: d1 < 0.3 ? "good" : d1 > 1 ? "bad" : "neutral" });
    }
  }
  const dep = row(B, "Deposits");
  if (dep && dep.length >= 2) b.push({ text: `Deposits grew ${pct(chg(last(dep), dep[dep.length - 2]), 0)} in the latest period.`, tone: "neutral" });
  const cwip = row(B, "CWIP");
  if (cwip && nw && last(cwip) != null && last(nw)) {
    const share = (last(cwip)! / last(nw)!) * 100;
    if (share > 8) b.push({ text: `Capital work-in-progress is ${share.toFixed(0)}% of net worth — capacity still to come on stream.`, tone: "neutral" });
  }
  const E = f.efficiency;
  const ccc = row(E, "Cash Conversion Cycle");
  const wcd = row(E, "Working Capital Days");
  const dd = row(E, "Debtor Days");
  if (ccc && ccc.length >= 3 && last(ccc) != null && ccc[ccc.length - 3] != null) {
    const a = ccc[ccc.length - 3]!;
    const z = last(ccc)!;
    if (Math.abs(z - a) >= 15) b.push({ text: `Cash conversion cycle ${z > a ? "lengthened" : "shortened"} ${a} → ${z} days in 2 years.`, tone: z > a ? "bad" : "good" });
  }
  if (dd && dd.length >= 2 && last(dd) != null && dd[dd.length - 2] != null && last(dd)! >= 1.4 * dd[dd.length - 2]!)
    b.push({ text: `Debtor days jumped ${dd[dd.length - 2]} → ${last(dd)} in a year: customers are paying slower.`, tone: "bad" });
  sections.push({
    id: "balance",
    title: "Balance sheet",
    metrics: [
      { label: "Net worth", value: cr(last(nw)) },
      { label: "Borrowings", value: cr(last(debt)) },
      { label: f.isBank ? "Borrowings / NW" : "Debt / equity", value: de && last(de) != null ? `${last(de)!.toFixed(2)}×` : "—" },
      ...(wcd && last(wcd) != null ? [{ label: "Working-capital days", value: `${last(wcd)}` }] : []),
    ],
    bullets: b,
    series: debt ? [{ label: "Borrowings (₹ cr)", periods: bp, values: debt }] : [],
  });

  // --- Cash quality
  const C = f.cashflow;
  const cp = C?.periods ?? [];
  const cfo = row(C, "Cash from Operating Activity");
  const fcf = row(C, "Free Cash Flow");
  const conv = row(C, "CFO/EBITDA");
  const cq: Flag[] = [];
  if (f.isBank) {
    cq.push({ text: "For lenders, operating cash flow mostly reflects loan-book growth and deposit flows — judge asset quality and NIMs instead.", tone: "neutral" });
  } else if (cfo && pat) {
    // align by period label
    const patBy = Object.fromEntries(yrs.map((y, i) => [y, pat[i]]));
    const common = cp.filter((p) => patBy[p] != null).slice(-5);
    const sCfo = common.reduce((s, p) => s + (cfo[cp.indexOf(p)] ?? 0), 0);
    const sPat = common.reduce((s, p) => s + (patBy[p] ?? 0), 0);
    if (sPat > 0 && sCfo < 0) {
      cq.push({ text: `Over ${common.length} years, operating cash flow added up to ${cr(sCfo)} despite ${cr(sPat)} of reported profit.`, tone: "bad" });
    } else if (sPat > 0) {
      const ratio = sCfo / sPat;
      cq.push({
        text: `Over ${common.length} years, operating cash flow was ${(ratio * 100).toFixed(0)}% of reported profit (${cr(sCfo)} vs ${cr(sPat)}).`,
        tone: ratio >= 0.9 ? "good" : ratio < 0.6 ? "bad" : "neutral",
      });
    }
    const negYears = common.filter((p) => (cfo[cp.indexOf(p)] ?? 0) < 0 && (patBy[p] ?? 0) > 0);
    if (negYears.length) cq.push({ text: `Profitable but cash-negative from operations in ${negYears.join(", ")}.`, tone: "bad" });
    if (fcf) {
      const sF = fcf.slice(-3).reduce((s: number, v) => s + (v ?? 0), 0);
      cq.push({ text: `Free cash flow, last 3 years: ${cr(sF)}${sF < 0 ? " — growth is being funded externally" : ""}.`, tone: sF > 0 ? "good" : "bad" });
    }
  }
  sections.push({
    id: "cash",
    title: "Cash quality",
    metrics: [
      { label: "CFO (latest yr)", value: cr(last(cfo)) },
      { label: "FCF (latest yr)", value: cr(last(fcf)) },
      { label: "CFO / EBITDA", value: conv && last(conv) != null ? `${last(conv)}%` : "—" },
    ],
    bullets: cq,
    series: [
      ...(cfo ? [{ label: "Cash from operations (₹ cr)", periods: cp, values: cfo }] : []),
      ...(fcf ? [{ label: "Free cash flow (₹ cr)", periods: cp, values: fcf }] : []),
    ],
  });
  return sections;
}

/** Strip a quarterly table to the essentials for display. */
export function quarterTable(f: Fundamentals, k = 6) {
  const q = f.quarters;
  if (!q) return null;
  const pick = f.isBank ? ["Revenue", "Interest", "Profit before tax", "Net Profit", "Gross NPA %", "Net NPA %"] : ["Sales", "Operating Profit", "OPM %", "Other Income", "Profit before tax", "Net Profit"];
  const rows = pick.filter((p) => q.rows[p]).map((p) => ({ label: p === "Sales" ? "Revenue" : p === "Operating Profit" ? "EBITDA" : p === "OPM %" ? "EBITDA margin %" : p === "Net Profit" ? "PAT" : p === "Profit before tax" ? "PBT" : p, values: q.rows[p].slice(-k) }));
  return { periods: q.periods.slice(-k).map(fyQuarter), rows };
}
