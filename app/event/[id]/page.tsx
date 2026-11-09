import Link from "next/link";
import { notFound } from "next/navigation";
import details from "@/data/raw/filing_details.json";
import { HelperList, Paths, Career } from "@/components/people";
import { ResultsTable } from "@/components/results";
import { CategoryTag, Delta, Header, Panel, Section, SignalBar, Sparkline } from "@/components/ui";
import { CATEGORY_LABEL, reportedQuarter } from "@/lib/classify";
import { metaFor } from "@/lib/companies";
import { ANNOUNCEMENTS, eventFor, FUNDAMENTALS, priceOf } from "@/lib/data";
import { dayLabel, istTime } from "@/lib/format";
import { firstName, helpersFor, pathsTo, person } from "@/lib/network";
import { resultsCard } from "@/lib/research";

type Profile = { summary?: string; highlights?: string[]; education_source?: string };
const PROFILES: Record<string, Profile> = {};
for (const [, v] of Object.entries(details as Record<string, { profile?: { name: string } & Profile; profiles?: ({ name: string } & Profile)[] }>)) {
  for (const p of [v.profile, ...(v.profiles ?? [])]) if (p) PROFILES[p.name] = p;
}

export function generateStaticParams() {
  return ANNOUNCEMENTS.map((a) => ({ id: a.id }));
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ev = eventFor(decodeURIComponent(id));
  if (!ev) notFound();
  const a = ev.lead.id === id ? ev.lead : [ev.lead, ...ev.related].find((x) => x.id === id) ?? ev.lead;
  const m = metaFor(a.symbol);
  const f = FUNDAMENTALS[a.symbol];
  const isResults = a.category === "results" || a.category === "earnings_call";
  const rc = isResults && f ? resultsCard(f) : null;
  const rcFresh = rc && rc.quarter === reportedQuarter(a.ts);
  const appointed = a.people.filter((p) => p.profileId && person(p.profileId));
  // People already shown as routes to the new appointee are not repeated below.
  const shownVia = new Set(appointed.flatMap((p) => pathsTo(p.profileId!).map((x) => x.via?.id)).filter(Boolean));
  const helpers = helpersFor(a.symbol, { event: a.category, limit: 4 + shownVia.size }).filter((h) => !shownVia.has(h.person.id)).slice(0, 4);
  const pr = a.priceReaction;
  const series = priceOf(a.symbol);

  return (
    <main>
      <Header back="/" title={null} right={<SignalBar score={a.score} tier={a.tier} />} />
      <div className="px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/company/${a.symbol}`} className="text-[15px] font-semibold underline decoration-line underline-offset-4">
            {m.name}
          </Link>
          <CategoryTag c={a.category} />
        </div>
        <h1 className="display mt-2 text-[27px] font-[650] leading-[1.1]">{a.headline}</h1>
        <p className="mt-2 text-[13px] text-ink-3">
          Filed {istTime(a.ts)} IST on NSE ({a.nseDesc})
        </p>
        {a.facts.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {a.facts.map((x) => (
              <li key={x} className="flex gap-2 text-[15px]">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                {x}
              </li>
            ))}
          </ul>
        )}
        {!a.facts.length && a.text && a.text.length > 30 && !/^[,.]/.test(a.text) && a.category !== "results" && <p className="mt-4 text-[15px] text-ink-2">{a.text}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {a.file && (
            <a href={a.file} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-sheet">
              Open the filing (PDF)
            </a>
          )}
          <Link href={`/company/${a.symbol}`} className="rounded-full border border-line bg-sheet px-4 py-2 text-[14px]">
            Research {m.short}
          </Link>
        </div>
      </div>

      {rc && (
        <Section title={rcFresh ? `First cut: ${rc.quarter}` : `Latest reported: ${rc.quarter}`} aside="Consolidated">
          <ResultsTable r={rc} />
          <p className="mt-2 text-[12px] text-ink-3">Numbers from screener.in&rsquo;s standardised results table, which mirrors the exchange filing. Open the filing to verify.</p>
        </Section>
      )}

      {appointed.map((p) => {
        const who = person(p.profileId!)!;
        const prof = PROFILES[who.name];
        return (
          <Section key={who.id} title={`Who is ${who.name}?`} aside={p.change === "appointed" ? "Incoming" : "Outgoing"}>
            <Panel className="px-4 py-4">
              <p className="text-[15px]">{prof?.summary ?? who.headline}</p>
              {prof?.highlights && (
                <ul className="mt-2 space-y-1 text-[14px] text-ink-2">
                  {prof.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                <Career p={who} />
              </div>
              {who.education.length > 0 && (
                <p className="mt-3 text-[13px] text-ink-2">
                  Education: {who.education.map((e) => `${e.org}${e.degree ? ` (${e.degree})` : ""}`).join(", ")}
                  {prof?.education_source && <span className="text-ink-3"> ({prof.education_source})</span>}
                </p>
              )}
              <p className="mt-2 text-[12px] text-ink-3">Profile disclosed in the company&rsquo;s filing under SEBI Regulation 30.</p>
            </Panel>
            <h3 className="mb-2 mt-5 text-[15px] font-semibold">How you can reach {firstName(who.name)}</h3>
            <Paths targetId={who.id} />
          </Section>
        );
      })}

      <Section title={appointed.length ? `More context on ${m.short}` : "Who can help you understand this"}>
        <HelperList helpers={helpers} company={m.short} />
      </Section>

      {(pr || series) && (
        <Section title="How the stock took it">
          <Panel className="flex items-center justify-between px-4 py-3">
            {pr ? (
              <div>
                <p className="text-[14px]">
                  {dayLabel(pr.date)}: <Delta v={pr.pct} />
                </p>
                <p className="num text-[13px] text-ink-3">{pr.volX.toFixed(1)}× the 20-day average volume</p>
              </div>
            ) : (
              <p className="text-[14px] text-ink-2">No session yet after this filing.</p>
            )}
            {series && <Sparkline values={series.close} width={120} height={36} />}
          </Panel>
        </Section>
      )}

      <Section title="Why FINN ranked this here">
        <ul className="space-y-1 text-[14px] text-ink-2">
          {a.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-ink-3">
          Materiality {a.score}/100 ({a.tier}). Category: {CATEGORY_LABEL[a.category]}.
        </p>
      </Section>

      {ev.related.length > 0 && (
        <Section title="Related filings" aside={`${ev.related.length}`}>
          <ul className="space-y-2">
            {[ev.lead, ...ev.related]
              .filter((x) => x.id !== a.id)
              .map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-[14px]">
                  <Link href={`/event/${r.id}`} className="hover:underline">
                    {r.headline}
                  </Link>
                  <span className="shrink-0 text-[12px] text-ink-3">{istTime(r.ts, false)}</span>
                </li>
              ))}
          </ul>
        </Section>
      )}
      <div className="h-8" />
    </main>
  );
}
