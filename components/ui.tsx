import Link from "next/link";
import type { ReactNode } from "react";
import { CATEGORY_LABEL } from "@/lib/classify";
import type { Category, Tier } from "@/lib/types";

export function Header({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="px-5 pb-3 pt-[calc(18px+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        {back ? (
          <Link href={back} className="-ml-2 rounded-full px-2 py-1 text-[14px] text-ink-2" aria-label="Back">
            ‹ Back
          </Link>
        ) : (
          <Wordmark />
        )}
        {right}
      </div>
      {title && <h1 className="display mt-4 text-[30px] font-[650] leading-[1.05]">{title}</h1>}
      {sub && <p className="mt-1.5 text-[14px] text-ink-2">{sub}</p>}
    </header>
  );
}

export function Wordmark() {
  return (
    <span className="display text-[19px] font-[750] tracking-tight" aria-label="FINN">
      FINN<span className="text-signal">.</span>
    </span>
  );
}

export function CategoryTag({ c }: { c: Category }) {
  return <span className="rounded-full border border-line bg-sheet px-2 py-[1px] text-[12px] text-ink-2">{CATEGORY_LABEL[c]}</span>;
}

/** Materiality signal: a short marigold bar whose length is the score. */
export function SignalBar({ score, tier }: { score: number; tier: Tier }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Materiality ${score}/100`}>
      <span className="relative h-[5px] w-10 overflow-hidden rounded-full bg-line">
        <span className={`absolute inset-y-0 left-0 rounded-full ${tier === "critical" ? "bg-signal" : tier === "notable" ? "bg-ink-3" : "bg-line"}`} style={{ width: `${score}%` }} />
      </span>
      <span className="num text-[11px] text-ink-3">{score}</span>
    </span>
  );
}

export function Delta({ v, d = 1, invert = false, suffix = "%" }: { v: number | null | undefined; d?: number; invert?: boolean; suffix?: string }) {
  if (v == null || !Number.isFinite(v)) return <span className="text-ink-3">—</span>;
  const good = invert ? v < 0 : v > 0;
  const flat = Math.abs(v) < 0.05;
  return (
    <span className={`num ${flat ? "text-ink-2" : good ? "text-gain" : "text-loss"}`}>
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {Math.abs(v).toFixed(d)}
      {suffix}
    </span>
  );
}

export function Section({ title, aside, children, id }: { title: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-16 px-5 pt-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="display text-[19px] font-[650]">{title}</h2>
        {aside && <div className="text-[13px] text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[14px] border border-line bg-sheet ${className}`}>{children}</div>;
}

export function Sparkline({ values, width = 96, height = 28, className = "" }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--color-gain)" : "var(--color-loss)"} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.2" fill={up ? "var(--color-gain)" : "var(--color-loss)"} />
    </svg>
  );
}

/** Small multiples bar chart for annual series (handles negatives). */
export function Bars({ periods, values, unit = "", height = 72 }: { periods: string[]; values: (number | null)[]; unit?: string; height?: number }) {
  const vs = values.map((v) => v ?? 0);
  const max = Math.max(...vs.map(Math.abs), 1);
  const hasNeg = vs.some((v) => v < 0);
  const zero = hasNeg ? height / 2 : height;
  const scale = hasNeg ? height / 2 - 4 : height - 4;
  return (
    <div className="flex items-end gap-1.5" style={{ height: height + 18 }}>
      {vs.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / max) * scale);
        return (
          <div key={i} className="flex flex-1 flex-col items-center" title={`${periods[i]}: ${v}${unit}`}>
            <div className="relative w-full" style={{ height }}>
              <div
                className={`absolute left-[15%] right-[15%] rounded-[3px] ${v < 0 ? "bg-loss/80" : i === vs.length - 1 ? "bg-ink" : "bg-ink/35"}`}
                style={v < 0 ? { top: zero, height: h } : { bottom: height - zero, height: h }}
              />
              {hasNeg && <div className="absolute inset-x-0 border-t border-line" style={{ top: zero }} />}
            </div>
            <span className="mt-1 text-[10px] text-ink-3">{periods[i].replace(/^Mar /, "FY").replace(/^(FY)20/, "$1")}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Avatar({ name, kind = "contact", size = 36 }: { name: string; kind?: "contact" | "public"; size?: number }) {
  const initials = name
    .replace(/^Dr\.\s+/, "")
    .split(" ")
    .filter((x) => x.length > 1 && !x.endsWith("."))
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${kind === "public" ? "border border-dashed border-ink-3 bg-transparent text-ink-2" : "bg-ink text-sheet"}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function Strength({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-[3px]" title={`Tie strength ${n}/3`} aria-label={`Tie strength ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-[7px] w-[7px] rounded-full ${i <= n ? "bg-ink" : "bg-line"}`} />
      ))}
    </span>
  );
}
