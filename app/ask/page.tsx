"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Delta, Sparkline, Wordmark } from "@/components/ui";
import { hrefFor, METRICS, planRules, type Metric, type Plan } from "@/lib/ask";
import { screen } from "@/lib/screen";
import { COMPANIES } from "@/lib/companies";
import { priceOf } from "@/lib/data";

const SUGGESTIONS = [
  "Did Kaynes deliver what it promised?",
  "Persistent: bull vs bear",
  "Who can introduce me to Anup Bagchi?",
  "Who knows specialty chemicals?",
  "Who should I call about CG Power?",
  "TATAELXSI cash quality",
  "Which of my holdings has the weakest cash conversion?",
];

function Screen({ metric }: { metric: Metric }) {
  const { rows, lowerIsWorse, skipped } = useMemo(() => screen(metric), [metric]);
  return (
    <section className="px-5 pt-4">
      <h2 className="display text-[19px] font-[650]">{METRICS[metric].label}</h2>
      <p className="mb-3 text-[14px] text-ink-2">
        Your holdings, {lowerIsWorse ? "weakest" : "most indebted"} first. Computed from reported financials.
        {skipped.length > 0 && ` Lenders (${skipped.join(", ")}) are left out: this measure doesn't apply to them.`}
      </p>
      <div className="divide-y divide-line rounded-[14px] border border-line bg-sheet">
        {rows.map((r, i) => (
          <Link key={r.symbol} href={`/company/${r.symbol}`} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[15px]">
              <span className="num mr-2 text-ink-3">{i + 1}</span>
              {r.name}
            </span>
            <span className="num text-right text-[15px] font-semibold">
              {r.display}
              {r.note && <span className="block text-[11px] font-normal text-ink-3">{r.note}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function AskPage() {
  return (
    <Suspense>
      <Ask />
    </Suspense>
  );
}

function Ask() {
  const params = useSearchParams();
  const metric = params.get("screen") as Metric | null;
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(false);
  const router = useRouter();

  async function ask(text: string) {
    setQ(text);
    setMiss(false);
    let p = planRules(text);
    if (!p) {
      setBusy(true);
      try {
        p = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: text }) }).then((r) => r.json());
      } catch {}
      setBusy(false);
    }
    if (!p || !p.steps?.length) {
      setMiss(true);
      return;
    }
    setPlan(p);
    setTimeout(() => router.push(hrefFor(p!.steps[0])), 450);
  }

  const research = COMPANIES.filter((c) => c.research);
  const book = COMPANIES.filter((c) => c.portfolio && !c.research);

  return (
    <main>
      <header className="px-5 pt-[calc(18px+env(safe-area-inset-top))]">
        <Wordmark />
        <h1 className="display mt-5 text-[34px] font-[680] leading-[1.03]">Ask about any company, or anyone you know.</h1>
      </header>
      <form
        className="sticky top-0 z-20 mt-4 bg-paper/95 px-5 py-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask(q.trim());
        }}
      >
        <label htmlFor="q" className="sr-only">
          Ask FINN
        </label>
        <div className="flex items-center gap-2 rounded-[16px] border border-ink bg-sheet px-3.5 py-1.5">
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Did Kaynes deliver on guidance?"
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-ink-3"
            autoComplete="off"
            enterKeyHint="go"
          />
          <button type="submit" className="rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-semibold text-sheet" disabled={busy}>
            {busy ? "Thinking" : "Ask"}
          </button>
        </div>
        {plan && (
          <p className="rise mt-2 text-[14px] text-ink-2">
            <span className="font-semibold text-ink">Plan:</span> {plan.understood}
            {plan.by === "model" && <span className="text-ink-3"> (planned by the fast model)</span>}
          </p>
        )}
        {miss && <p className="mt-2 text-[14px] text-loss">Try a company name, an NSE symbol, a person, or a theme like &ldquo;rural lending&rdquo;.</p>}
      </form>

      {metric && METRICS[metric] && <Screen metric={metric} />}

      <section className="px-5 pt-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-sheet px-3 py-1.5 text-left text-[14px] text-ink-2">
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 pt-7">
        <h2 className="display text-[19px] font-[650]">On your research list</h2>
        <p className="mb-3 text-[14px] text-ink-2">Promised-vs-delivered already read from the last four earnings calls.</p>
        <CompanyList items={research} />
      </section>
      <section className="px-5 pt-7">
        <h2 className="display mb-3 text-[19px] font-[650]">Your portfolio</h2>
        <CompanyList items={book} />
        <p className="mt-3 text-[13px] text-ink-3">Not limited to these: type any NSE symbol and FINN fetches and analyses it live.</p>
      </section>
      <div className="h-6" />
    </main>
  );
}

function CompanyList({ items }: { items: typeof COMPANIES }) {
  return (
    <div className="divide-y divide-line rounded-[14px] border border-line bg-sheet">
      {items.map((c) => {
        const p = priceOf(c.symbol);
        const d = p ? (p.close[p.close.length - 1] / p.close[p.close.length - 22] - 1) * 100 : null;
        return (
          <Link key={c.symbol} href={`/company/${c.symbol}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{c.name}</span>
              <span className="text-[12px] text-ink-3">{c.sector}</span>
            </span>
            <span className="flex items-center gap-3">
              {p && <Sparkline values={p.close.slice(-22)} width={56} height={20} />}
              <span className="w-14 text-right text-[13px]">
                <Delta v={d} />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
