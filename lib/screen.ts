/** Rank every holding on one metric, computed by code from reported financials (no model involved). */
import type { Metric } from "./ask";
import { PORTFOLIO } from "./companies";
import { FUNDAMENTALS } from "./data";
import { chg } from "./format";

export type ScreenRow = { symbol: string; name: string; value: number | null; display: string; note?: string };

const r = (t: { rows: Record<string, (number | null)[]> } | null | undefined, ...k: string[]) => {
  for (const x of k) if (t?.rows[x]) return t.rows[x];
  return null;
};

export function screen(metric: Metric): { rows: ScreenRow[]; lowerIsWorse: boolean; skipped: string[] } {
  const rows: ScreenRow[] = [];
  const skipped: string[] = [];
  for (const c of PORTFOLIO) {
    const f = FUNDAMENTALS[c.symbol];
    if (!f) continue;
    const q = f.quarters;
    const n = q?.periods.length ?? 0;
    let v: number | null = null;
    let display = "—";
    let note: string | undefined;
    if (metric === "cash_conversion" || metric === "leverage" || metric === "margin_change") {
      if (f.isBank) {
        skipped.push(c.short);
        continue;
      }
    }
    if (metric === "cash_conversion") {
      const cfo = r(f.cashflow, "Cash from Operating Activity");
      const years = f.annual?.periods.filter((p) => p !== "TTM") ?? [];
      const pat = r(f.annual, "Net Profit");
      const periods = (f.cashflow?.periods ?? []).filter((p) => years.includes(p)).slice(-5);
      const sc = periods.reduce((s, p) => s + (cfo?.[f.cashflow!.periods.indexOf(p)] ?? 0), 0);
      const sp = periods.reduce((s, p) => s + (pat?.[years.indexOf(p)] ?? 0), 0);
      if (sp > 0) {
        v = (sc / sp) * 100;
        display = `${v.toFixed(0)}%`;
        note = `${periods.length} yrs`;
      }
    } else if (metric === "leverage") {
      const d = r(f.balance, "Borrowings", "Borrowing");
      const e = r(f.balance, "Equity Capital");
      const res = r(f.balance, "Reserves");
      const k = (d?.length ?? 0) - 1;
      if (d && e && res && k >= 0) {
        v = (d[k] ?? 0) / ((e[k] ?? 0) + (res[k] ?? 0));
        display = `${v.toFixed(2)}×`;
      }
    } else if (q && n >= 5) {
      const row = metric === "revenue_growth" ? r(q, "Sales", "Revenue") : metric === "profit_growth" ? r(q, "Net Profit") : r(q, "OPM %");
      if (row) {
        v = metric === "margin_change" ? (row[n - 1] ?? 0) - (row[n - 5] ?? 0) : chg(row[n - 1], row[n - 5]);
        display = v == null ? "—" : metric === "margin_change" ? `${v > 0 ? "+" : ""}${v.toFixed(0)} pts` : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
        note = q.periods[n - 1];
      }
    }
    rows.push({ symbol: c.symbol, name: c.short, value: v, display, note });
  }
  const lowerIsWorse = metric !== "leverage";
  rows.sort((a, b) => (a.value == null ? 1 : b.value == null ? -1 : lowerIsWorse ? a.value - b.value : b.value - a.value));
  return { rows, lowerIsWorse, skipped };
}
