import Link from "next/link";
import { DeepPanel } from "@/components/deep";
import { HelperList } from "@/components/people";
import { Bars, Delta, Header, Panel, Section, Sparkline } from "@/components/ui";
import { metaFor } from "@/lib/companies";
import { ANNOUNCEMENTS, priceOf } from "@/lib/data";
import { cr, inr } from "@/lib/format";
import { helpersFor } from "@/lib/network";
import { analyse, quarterTable } from "@/lib/research";
import { getFundamentals, seededDeep } from "@/lib/server";

export const revalidate = 21600;

export default async function CompanyPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { f, live, error } = await getFundamentals(symbol);
  const meta = metaFor(symbol);

  if (!f)
    return (
      <main>
        <Header back="/ask" title={symbol} sub="FINN couldn't load this company." />
        <div className="px-5">
          <Panel className="px-4 py-4 text-[15px]">
            <p>
              No fundamentals found for <b>{symbol}</b> on screener.in. Check the NSE symbol (for example <code>TATAELXSI</code>, not &ldquo;Tata Elxsi&rdquo;).
            </p>
            {error && <p className="mt-2 text-[13px] text-ink-3">Details: {error}</p>}
          </Panel>
        </div>
      </main>
    );

  const p = priceOf(symbol);
  const last = p ? p.close[p.close.length - 1] : f.ratios["Current Price"];
  const d1 = p ? (p.close[p.close.length - 1] / p.close[p.close.length - 2] - 1) * 100 : null;
  const m1 = p ? (p.close[p.close.length - 1] / p.close[Math.max(0, p.close.length - 22)] - 1) * 100 : null;
  const sections = analyse(f);
  const qt = quarterTable(f, 6);
  const deep = seededDeep(symbol);
  const helpers = helpersFor(symbol, { limit: 4 });
  const recent = ANNOUNCEMENTS.filter((a) => a.symbol === symbol && !["unclassified", "investor_meetings"].includes(a.category)).slice(0, 4);
  const NAV = [
    ["snapshot", "Snapshot"],
    ["numbers", "Numbers"],
    ["trajectory", "Trajectory"],
    ["balance", "Balance sheet"],
    ["cash", "Cash"],
    ["promises", "Promised vs delivered"],
    ["bullbear", "Bull vs bear"],
    ["people", "Who to call"],
  ];

  return (
    <main>
      <Header
        back="/ask"
        title={f.name.replace(/ Ltd\.?$/, "")}
        sub={
          <>
            {symbol}
            {meta.sector !== "—" && `, ${meta.sector}`}
            {meta.portfolio ? `, ${meta.weight}% of your book` : ", not in your portfolio"}
          </>
        }
      />
      <div className="flex items-end justify-between px-5">
        <div>
          <p className="num display text-[30px] font-[650]">₹{inr(last, last && last < 1000 ? 1 : 0)}</p>
          <p className="text-[13px]">
            <Delta v={d1} /> <span className="mr-3 text-ink-3">on the day</span> <Delta v={m1} /> <span className="text-ink-3">1 month</span>
          </p>
        </div>
        {p && <Sparkline values={p.close} width={140} height={44} />}
      </div>

      <nav aria-label="Sections" className="scroll-x sticky top-0 z-30 mt-4 flex gap-1.5 overflow-x-auto border-b border-line bg-paper/95 px-5 py-2 backdrop-blur">
        {NAV.map(([id, l]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-line bg-sheet px-3 py-1 text-[13px] text-ink-2">
            {l}
          </a>
        ))}
      </nav>

      <Section id="snapshot" title="What the business does" aside={live ? "Fetched live" : undefined}>
        {deep?.businessSnapshot ? (
          <ul className="space-y-1.5">
            {deep.businessSnapshot.map((b) => (
              <li key={b} className="flex gap-2 text-[15px]">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                {b}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-[15px]">{f.about}</p>
            {f.keyPoints && <p className="mt-2 text-[14px] text-ink-2">{f.keyPoints}</p>}
          </>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {sections[0].metrics.map((x) => (
            <Panel key={x.label} className="px-3 py-2.5">
              <p className="text-[11px] text-ink-3">{x.label}</p>
              <p className="num text-[15px] font-semibold">{x.value}</p>
            </Panel>
          ))}
        </div>
      </Section>

      {qt && (
        <Section id="numbers" title="Last six quarters" aside="₹ cr">
          <Panel className="scroll-x overflow-x-auto">
            <table className="num w-full min-w-[420px] text-[13px]">
              <thead>
                <tr className="text-ink-3">
                  <th className="sticky left-0 bg-sheet px-3 py-2 text-left font-normal" />
                  {qt.periods.map((x) => (
                    <th key={x} className="px-2 py-2 text-right font-normal">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qt.rows.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <td className="sticky left-0 bg-sheet px-3 py-2">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className={`px-2 py-2 text-right ${i === r.values.length - 1 ? "font-semibold" : ""}`}>
                        {v == null ? "—" : inr(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
      )}

      {sections.slice(1).map((s) => (
        <Section key={s.id} id={s.id} title={s.title}>
          <div className="grid grid-cols-2 gap-2">
            {s.metrics.map((x) => (
              <Panel key={x.label} className="px-3 py-2.5">
                <p className="text-[11px] text-ink-3">{x.label}</p>
                <p className="num text-[15px] font-semibold">{x.value}</p>
              </Panel>
            ))}
          </div>
          {s.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {s.bullets.map((b) => (
                <li key={b.text} className="flex gap-2 text-[15px]">
                  <span className={`mt-[8px] h-2 w-2 shrink-0 rounded-full ${b.tone === "good" ? "bg-gain" : b.tone === "bad" ? "bg-loss" : "bg-ink-3"}`} />
                  {b.text}
                </li>
              ))}
            </ul>
          )}
          {s.series
            ?.filter((x) => x.values.some((v) => v != null))
            .map((x) => (
              <div key={x.label} className="mt-4">
                <p className="mb-1 text-[12px] text-ink-3">{x.label}</p>
                <Bars periods={x.periods} values={x.values} unit={x.unit} />
              </div>
            ))}
        </Section>
      ))}

      <Section id="promises" title="Promised vs delivered" aside="From earnings calls">
        <DeepPanel symbol={symbol} seeded={deep} hasCalls={f.concalls.some((c) => c.transcript)} />
      </Section>

      <Section id="people" title={`Who can help you on ${meta.short}`}>
        <HelperList helpers={helpers} company={meta.short} />
      </Section>

      {recent.length > 0 && (
        <Section title="Recent filings">
          <ul className="space-y-2 text-[14px]">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/event/${a.id}`} className="hover:underline">
                  {a.headline}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Sources">
        <ul className="space-y-1 text-[13px] text-ink-2">
          <li>
            Financials:{" "}
            <a className="underline" href={f.source} target="_blank" rel="noreferrer">
              screener.in
            </a>{" "}
            ({live ? "fetched live" : `snapshot ${f.fetchedAt.slice(0, 10)}`}). Market cap {cr(f.ratios["Market Cap"])}.
          </li>
          {f.annualReports.map((r) => (
            <li key={r.url}>
              <a className="underline" href={r.url} target="_blank" rel="noreferrer">
                Annual report {r.year}
              </a>
            </li>
          ))}
          {f.concalls
            .filter((c) => c.transcript)
            .slice(0, 4)
            .map((c) => (
              <li key={c.transcript!}>
                <a className="underline" href={c.transcript!} target="_blank" rel="noreferrer">
                  Earnings-call transcript, {c.period}
                </a>
              </li>
            ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-3">Pull uses primary sources only: exchange filings, annual reports, transcripts and reported numbers. No news, broker notes or model memory.</p>
      </Section>
      <div className="h-8" />
    </main>
  );
}
