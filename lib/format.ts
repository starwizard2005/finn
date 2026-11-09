export const inr = (n: number | null | undefined, d = 0) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

/** Rs crore with Indian grouping: 1,23,456 cr; large values in lakh crore. */
export const cr = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 100000) return `${sign}₹${(a / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} L cr`;
  return `${sign}₹${inr(a)} cr`;
};

export const pct = (n: number | null | undefined, d = 1, sign = true) =>
  n == null || !Number.isFinite(n) ? "—" : `${sign && n > 0 ? "+" : ""}${n.toFixed(d)}%`;

export const chg = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur == null || prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

export const tone = (n: number | null | undefined, invert = false): "good" | "bad" | "neutral" =>
  n == null || Math.abs(n) < 0.5 ? "neutral" : (n > 0) !== invert ? "good" : "bad";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO timestamp in IST, e.g. "5 Nov, 16:50". */
export function istTime(iso: string, withTime = true) {
  const d = new Date(new Date(iso).getTime() + 330 * 60000);
  const s = `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  return withTime ? `${s}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : s;
}

export function ago(iso: string, now: string) {
  const h = (new Date(now).getTime() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export const dayLabel = (isoDate: string) => {
  const d = new Date(isoDate + "T00:00:00Z");
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};
