import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy";
import { Career, Paths } from "@/components/people";
import { Avatar, Header, Panel, Section, Strength } from "@/components/ui";
import { COMPANIES, metaFor, resolveOrg } from "@/lib/companies";
import { ANNOUNCEMENTS, NOW } from "@/lib/data";
import { istTime } from "@/lib/format";
import { firstName, helpersFor, links, PEOPLE, person, PUBLIC } from "@/lib/network";

export function generateStaticParams() {
  return PEOPLE.map((p) => ({ id: p.id }));
}

const SOURCE: Record<string, string> = {
  linkedin_export: "your LinkedIn export",
  meeting_log: "your meeting log",
  alumni_directory: "an alumni directory",
  phone_contacts: "your phone contacts",
};

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = person(id);
  if (!p || p.id === "you") notFound();
  const months = p.relation ? Math.round((new Date(NOW).getTime() - new Date(p.relation.lastContact).getTime()) / (30.4 * 864e5)) : null;
  const helps = COMPANIES.map((c) => ({ c, h: helpersFor(c.symbol, { limit: 12 }).find((h) => h.person.id === p.id) })).filter((x) => x.h);
  const syms = new Set(p.career.map((s) => resolveOrg(s.org)).filter(Boolean));
  const news = ANNOUNCEMENTS.filter((a) => syms.has(a.symbol) && !["unclassified", "investor_meetings", "earnings_call", "postal_ballot"].includes(a.category) && !/newspaper|presentation/i.test(a.headline)).slice(0, 4);
  const bridges = p.kind === "contact" ? PUBLIC.map((t) => ({ t, l: links(p, t).find((l) => l.kind !== "alumni") })).filter((x) => x.l) : [];
  const insider = p.currentInsiderAt?.length;

  return (
    <main>
      <Header back={p.kind === "public" ? "/" : "/network"} title={null} />
      <div className="px-5">
        <div className="flex items-center gap-3">
          <Avatar name={p.name} kind={p.kind} size={52} />
          <div>
            <h1 className="display text-[26px] font-[650] leading-tight">{p.name}</h1>
            <p className="text-[14px] text-ink-2">{p.headline}</p>
          </div>
        </div>
        {p.relation && (
          <Panel className="mt-4 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">{p.relation.how}</p>
              <Strength n={p.relation.strength} />
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              Last spoke {months} month{months === 1 ? "" : "s"} ago. Known via {SOURCE[p.relation.source]}.
              {p.relation.notes && ` ${p.relation.notes}`}
            </p>
            {insider ? <p className="mt-2 rounded-[8px] bg-signal-soft px-2.5 py-1.5 text-[13px] text-caution">Current insider at {p.currentInsiderAt!.join(", ")}. FINN will steer conversations to industry context to avoid price-sensitive information.</p> : null}
            <div className="mt-2.5">
              <CopyButton
                label="Copy a catch-up note"
                text={`Hi ${firstName(p.name)}, it's been a while! ${news[0] ? `Saw the news from ${metaFor(news[0].symbol).short} and thought of you. ` : ""}Would love to catch up over coffee soon. How are things?`}
              />
            </div>
          </Panel>
        )}
        {p.kind === "public" && (
          <p className="mt-3 text-[13px] text-ink-3">
            Not in your network. Profile from {p.sourceRef ? "the company's exchange filing" : "public sources"}
            {p.sourceRef && (
              <>
                {" "}
                (
                <a className="underline" href={`https://nsearchives.nseindia.com/corporate/${p.sourceRef}.pdf`} target="_blank" rel="noreferrer">
                  open filing
                </a>
                )
              </>
            )}
            .
          </p>
        )}
      </div>

      {p.kind === "public" && (
        <Section title={`How you can reach ${firstName(p.name)}`}>
          <Paths targetId={p.id} />
        </Section>
      )}

      {helps.length > 0 && (
        <Section title={`Where ${firstName(p.name)} can help`}>
          <div className="space-y-2">
            {helps.map(({ c, h }) => (
              <Link key={c.symbol} href={`/company/${c.symbol}#people`} className="block rounded-[12px] border border-line bg-sheet px-4 py-2.5">
                <p className="text-[15px] font-semibold">
                  {c.short} <span className="text-[12px] font-normal text-ink-3">{c.portfolio ? "in your book" : "on your research list"}</span>
                </p>
                <p className="text-[14px] text-ink-2">{h!.why}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {bridges.length > 0 && (
        <Section title="People they may know in the news">
          <div className="space-y-2">
            {bridges.map(({ t, l }) => (
              <Link key={t.id} href={`/person/${t.id}`} className="block rounded-[12px] border border-line bg-sheet px-4 py-2.5">
                <p className="text-[15px] font-semibold">{t.name}</p>
                <p className="text-[14px] text-ink-2">{l!.why}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Career">
        <Career p={p} />
        {p.education.length > 0 && <p className="mt-4 text-[14px] text-ink-2">Education: {p.education.map((e) => `${e.org}${e.degree ? ` (${e.degree}${e.from ? `, ${e.from}–${e.to}` : ""})` : ""}`).join("; ")}</p>}
        {p.expertise.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.expertise.map((t) => (
              <Link key={t} href={`/network?q=${encodeURIComponent(t)}`} className="rounded-full border border-line bg-sheet px-2.5 py-0.5 text-[13px] text-ink-2">
                {t}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {news.length > 0 && (
        <Section title="Recent news at their companies">
          <ul className="space-y-2 text-[14px]">
            {news.map((a) => (
              <li key={a.id}>
                <Link href={`/event/${a.id}`} className="hover:underline">
                  <span className="font-semibold">{metaFor(a.symbol).short}</span> {a.headline}
                </Link>
                <span className="block text-[12px] text-ink-3">{istTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {p.source === "synthetic" && <p className="px-5 pt-6 text-[12px] text-ink-3">Synthetic demo profile.</p>}
      <div className="h-8" />
    </main>
  );
}
