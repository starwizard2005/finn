"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ANNOUNCEMENTS, digest } from "@/lib/data";
import { metaFor } from "@/lib/companies";
import { CONTACTS, coverage, currentStint, helpersFor, insights, keepWarm, searchNetwork, THEMES } from "@/lib/network";
import type { Person } from "@/lib/types";
import { Constellation } from "./constellation";
import { CopyButton } from "./copy";
import { Avatar, Panel, Strength, Wordmark } from "./ui";

const KIND_ICON: Record<string, string> = { path: "Route", gap: "Gap", caution: "Careful", cluster: "Common ground" };

export function NetworkView() {
  const params = useSearchParams();
  const router = useRouter();
  const q0 = params.get("q") ?? "";
  const [q, setQ] = useState(q0);
  const res = useMemo(() => (q0 ? searchNetwork(q0) : null), [q0]);
  const ins = useMemo(() => insights(ANNOUNCEMENTS), []);
  const nudges = useMemo(() => keepWarm(digest(504).events.map((e) => e.lead)).slice(0, 4), []);
  const cov = useMemo(() => coverage().slice(0, 10), []);
  const maxExp = Math.max(...cov.map((c) => c.exposure));

  return (
    <main>
      <header className="px-5 pt-[calc(18px+env(safe-area-inset-top))]">
        <Wordmark />
        <h1 className="display mt-5 text-[34px] font-[680] leading-[1.03]">Who you know, matched to what&rsquo;s happening.</h1>
        <p className="mt-2 text-[15px] text-ink-2">{CONTACTS.length} people, read against your 18 holdings and every filing this month.</p>
      </header>

      <form
        className="mt-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/network?q=${encodeURIComponent(q)}`);
        }}
      >
        <label htmlFor="nq" className="sr-only">
          Search your network
        </label>
        <div className="flex items-center gap-2 rounded-[16px] border border-ink bg-sheet px-3.5 py-1.5">
          <input id="nq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Who knows… rural lending, Tetra Pak, Kaynes" className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-ink-3" />
          <button className="rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-semibold text-sheet">Find</button>
        </div>
        <div className="scroll-x -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
          {THEMES.filter((t) => ["specialty chemicals", "semiconductors", "rural lending", "banking", "it services", "power equipment"].includes(t)).map((t) => (
            <Link key={t} href={`/network?q=${encodeURIComponent(t)}`} className="shrink-0 rounded-full border border-line bg-sheet px-3 py-1 text-[13px] text-ink-2">
              {t}
            </Link>
          ))}
        </div>
      </form>

      {res && (
        <section className="px-5 pt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="display text-[19px] font-[650]">
              {res.theme ? `Your people on ${res.theme}` : res.symbol ? `Who can help on ${metaFor(res.symbol).short}` : `Matches for “${q0}”`}
            </h2>
            <Link href="/network" className="text-[13px] text-ink-3 underline">
              Clear
            </Link>
          </div>
          {res.people.length === 0 ? (
            <p className="text-[14px] text-ink-2">No one yet. That&rsquo;s a gap worth filling: try a conference or an expert network.</p>
          ) : (
            <div className="space-y-2">
              {res.people.map((p) => (
                <PersonRow key={p.id} p={p} why={res.symbol ? helpersFor(res.symbol, { limit: 10 }).find((h) => h.person.id === p.id)?.why : undefined} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="px-5 pt-7">
        <h2 className="display mb-3 text-[19px] font-[650]">What FINN noticed</h2>
        <div className="space-y-2.5">
          {ins.map((i) => (
            <Link key={i.id} href={i.href} className="block">
              <Panel className={`px-4 py-3 ${i.kind === "caution" ? "border-signal" : ""}`}>
                <p className="text-[12px] text-ink-3">{KIND_ICON[i.kind]}</p>
                <p className="text-[15px] font-semibold">{i.title}</p>
                <p className="mt-0.5 text-[14px] text-ink-2">{i.body}</p>
              </Panel>
            </Link>
          ))}
        </div>
      </section>

      {nudges.length > 0 && (
        <section className="px-5 pt-7">
          <h2 className="display text-[19px] font-[650]">Reasons to reconnect</h2>
          <p className="mb-3 text-[14px] text-ink-2">You haven&rsquo;t spoken in a while, and their company just made news.</p>
          <div className="space-y-2.5">
            {nudges.map((n) => (
              <Panel key={n.person.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={n.person.name} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/person/${n.person.id}`} className="text-[15px] font-semibold hover:underline">
                      {n.person.name}
                    </Link>
                    <p className="text-[12px] text-ink-3">{n.months} months since you last spoke</p>
                  </div>
                </div>
                <p className="mt-2 text-[14px]">
                  {metaFor(n.symbol).short}:{" "}
                  <Link href={`/event/${n.announcementId}`} className="underline decoration-line underline-offset-4">
                    {n.reason.split(": ").slice(1).join(": ")}
                  </Link>
                </p>
                <div className="mt-2">
                  <CopyButton text={n.draft} label="Copy a catch-up note" />
                </div>
              </Panel>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pt-7">
        <h2 className="display text-[19px] font-[650]">Coverage vs your book</h2>
        <p className="mb-3 text-[14px] text-ink-2">Bar: share of your portfolio in a theme. Dots: people you can call on it.</p>
        <Panel className="divide-y divide-line">
          {cov.map((c) => (
            <Link key={c.theme} href={`/network?q=${encodeURIComponent(c.theme)}`} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-[118px] shrink-0 text-[14px]">{c.theme}</span>
              <span className="relative h-2 flex-1 rounded-full bg-paper">
                <span className={`absolute inset-y-0 left-0 rounded-full ${c.people.length <= 1 ? "bg-signal" : "bg-ink/70"}`} style={{ width: `${(c.exposure / maxExp) * 100}%` }} />
              </span>
              <span className="flex w-[52px] justify-end gap-[3px]">
                {c.people.length === 0 ? <span className="text-[12px] text-loss">none</span> : c.people.slice(0, 5).map((p) => <span key={p.id} className="h-[7px] w-[7px] rounded-full bg-ink" />)}
              </span>
            </Link>
          ))}
        </Panel>
      </section>

      <section className="px-5 pt-7">
        <h2 className="display mb-1 text-[19px] font-[650]">Your network at a glance</h2>
        <Constellation />
      </section>

      <section className="px-5 pt-6">
        <details>
          <summary className="cursor-pointer text-[14px] text-ink-2 underline">Everyone in your network ({CONTACTS.length})</summary>
          <div className="mt-3 space-y-2">
            {[...CONTACTS]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <PersonRow key={p.id} p={p} />
              ))}
          </div>
        </details>
        <p className="mt-6 text-[12px] text-ink-3">
          Demo data: these contacts are synthetic people with realistic careers. The executives on the outer ring are real, taken from their companies&rsquo; filings. Links between them are inferred from overlapping employers and years, never asserted.
        </p>
      </section>
      <div className="h-6" />
    </main>
  );
}

function PersonRow({ p, why }: { p: Person; why?: string }) {
  const s = currentStint(p);
  return (
    <Link href={`/person/${p.id}`} className="flex items-center gap-3 rounded-[12px] border border-line bg-sheet px-3 py-2.5">
      <Avatar name={p.name} kind={p.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{p.name}</span>
          {p.relation && <Strength n={p.relation.strength} />}
        </span>
        <span className="block truncate text-[13px] text-ink-2">{why ?? p.headline ?? s?.org}</span>
      </span>
    </Link>
  );
}
