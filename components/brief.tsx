"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/classify";
import { metaFor } from "@/lib/companies";
import { digest, networkTouch, NOW, priceOf } from "@/lib/data";
import { dayLabel, istTime } from "@/lib/format";
import { keepWarm } from "@/lib/network";
import type { Event } from "@/lib/push";
import type { Category, MoveAlert } from "@/lib/types";
import { SettingsSheet, useThresholds } from "./settings";
import { CategoryTag, Delta, SignalBar, Sparkline, Wordmark } from "./ui";

const WINDOWS = [
  { h: 24, label: "24 hours", since: "since yesterday" },
  { h: 72, label: "3 days", since: "in the last 3 days" },
  { h: 168, label: "7 days", since: "this week" },
  { h: 504, label: "3 weeks", since: "in 3 weeks" },
];
const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];

const cleanReason = (r: string) => r.replace(/\s*\([+−-]?\d+\)$/, "");

export function Brief() {
  const [win, setWin] = useState(0);
  const [th, setTh] = useThresholds();
  const [open, setOpen] = useState(false);
  const W = WINDOWS[win];
  const d = useMemo(() => digest(W.h, th), [W.h, th]);
  const week = useMemo(() => (W.h < 168 ? digest(168, th) : null), [W.h, th]);

  const critical = d.events.filter((e) => e.lead.tier === "critical");
  const notable = d.events.filter((e) => e.lead.tier === "notable");
  const routine = d.events.filter((e) => e.lead.tier === "routine");
  const top = critical.slice(0, 5);
  const shown = new Set(d.events.map((e) => e.lead.id));
  const carry = (week?.events ?? []).filter((e) => e.lead.tier === "critical" && !shown.has(e.lead.id)).slice(0, 3);
  const nudge = keepWarm(d.events.concat(week?.events ?? []).map((e) => e.lead))[0];

  const routineByCat = routine.reduce<Record<string, number>>((m, e) => {
    const k = CATEGORY_LABEL[e.lead.category as Category];
    m[k] = (m[k] ?? 0) + 1 + e.related.length;
    return m;
  }, {});
  const routineCount = Object.values(routineByCat).reduce((a, b) => a + b, 0);

  return (
    <main>
      <header className="px-5 pt-[calc(18px+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <Wordmark />
          <button onClick={() => setOpen(true)} className="rounded-full border border-line bg-sheet px-3 py-1.5 text-[13px] text-ink-2">
            Alert settings
          </button>
        </div>
        <p className="mt-5 text-[13px] text-ink-3">As of {istTime(NOW)} IST, after the close</p>
        <h1 className="display rise mt-1 text-[38px] font-[680] leading-[1.02]">
          {top.length === 0 ? `Nothing critical ${W.since}.` : `${WORDS[Math.min(top.length, 5)]} ${top.length === 1 ? "matters" : "matter"} ${W.since}.`}
        </h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {d.total} filings across your 18 holdings, folded into {d.events.length} events. {routineCount > 0 && `${routineCount} are routine paperwork, tucked away at the bottom.`}
        </p>
        <div role="tablist" aria-label="Time window" className="scroll-x -mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          {WINDOWS.map((w, i) => (
            <button key={w.h} role="tab" aria-selected={i === win} onClick={() => setWin(i)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] ${i === win ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink-2"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </header>

      {top.length > 0 && (
        <section className="mt-5 space-y-3 px-5">
          {top.map((e, i) => (
            <EventCard key={e.key} e={e} big={i < 3} />
          ))}
        </section>
      )}

      {carry.length > 0 && (
        <section className="px-5 pt-7">
          <h2 className="display text-[19px] font-[650]">Still open from this week</h2>
          <p className="mb-3 text-[14px] text-ink-2">Nothing in this window beats these. They may still need your attention.</p>
          <div className="space-y-2">
            {carry.map((e) => (
              <EventRow key={e.key} e={e} />
            ))}
          </div>
        </section>
      )}

      <Moves moves={d.moves} pricePct={th.pricePct} volumeX={th.volumeX} />

      {notable.length > 0 && (
        <section className="px-5 pt-7">
          <h2 className="display mb-3 text-[19px] font-[650]">Also worth a look</h2>
          <div className="space-y-2">
            {notable.slice(0, 12).map((e) => (
              <EventRow key={e.key} e={e} />
            ))}
          </div>
          {notable.length > 12 && <p className="mt-2 text-[13px] text-ink-3">+{notable.length - 12} more lower down the list</p>}
        </section>
      )}

      {routineCount > 0 && (
        <section className="px-5 pt-7">
          <details className="group rounded-[14px] border border-dashed border-line px-4 py-3">
            <summary className="cursor-pointer text-[14px] text-ink-2">
              <span className="font-semibold text-ink">{routineCount} routine filings</span> hidden:{" "}
              {Object.entries(routineByCat)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `${n} ${k.toLowerCase()}`)
                .join(", ")}
              . <span className="underline">Show</span>
            </summary>
            <ul className="mt-3 space-y-2">
              {routine.map((e) => (
                <li key={e.key} className="text-[13px] text-ink-2">
                  <Link href={`/event/${e.lead.id}`} className="hover:underline">
                    <span className="font-medium text-ink">{metaFor(e.lead.symbol).short}</span> {e.lead.headline}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {nudge && (
        <section className="px-5 pt-7">
          <Link href={`/person/${nudge.person.id}`} className="block rounded-[14px] bg-ink px-4 py-4 text-sheet">
            <p className="text-[13px] text-sheet/70">A reason to reconnect</p>
            <p className="mt-1 text-[16px] font-semibold">{nudge.person.name}</p>
            <p className="mt-1 text-[14px] text-sheet/85">{nudge.reason}</p>
          </Link>
        </section>
      )}

      <SettingsSheet open={open} onClose={() => setOpen(false)} th={th} onChange={setTh} />
    </main>
  );
}

function EventCard({ e, big }: { e: Event; big: boolean }) {
  const a = e.lead;
  const m = metaFor(a.symbol);
  const touch = networkTouch(a);
  const why = a.reasons
    .filter((r) => !/category you asked|filing PDF|Large position/.test(r) && !(touch && r.startsWith(touch)))
    .slice(0, 3)
    .map(cleanReason);
  return (
    <Link href={`/event/${a.id}`} className="block rounded-[16px] border border-line bg-sheet px-4 pb-3.5 pt-3 transition-colors active:bg-paper">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold">{m.short}</span>
          <CategoryTag c={a.category} />
        </div>
        <SignalBar score={a.score} tier={a.tier} />
      </div>
      <p className={`display mt-2 font-[620] leading-[1.18] ${big ? "text-[20px]" : "text-[17px]"}`}>{a.headline}</p>
      {why.length > 0 && <p className="mt-1.5 text-[13px] text-ink-2">{why.join(". ")}.</p>}
      {touch && (
        <p className="mt-2.5 flex items-start gap-2 border-t border-line pt-2.5 text-[13px] text-ink">
          <ThreadIcon />
          <span>{touch}</span>
        </p>
      )}
      <p className="mt-2 flex justify-between text-[12px] text-ink-3">
        <span>{istTime(a.ts)}</span>
        {e.related.length > 0 && <span>+{e.related.length} related filing{e.related.length > 1 ? "s" : ""}</span>}
      </p>
    </Link>
  );
}

function EventRow({ e }: { e: Event }) {
  const a = e.lead;
  return (
    <Link href={`/event/${a.id}`} className="flex items-start gap-3 rounded-[12px] px-1 py-1.5 active:bg-sheet">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: a.tier === "critical" ? "var(--color-signal)" : "var(--color-ink-3)" }} />
      <span className="min-w-0 flex-1">
        <span className="text-[14px] font-semibold">{metaFor(a.symbol).short}</span> <span className="text-[14px]">{a.headline}</span>
        <span className="mt-0.5 block text-[12px] text-ink-3">
          {CATEGORY_LABEL[a.category]}, {istTime(a.ts, false)}
          {e.related.length ? `, +${e.related.length} related` : ""}
        </span>
      </span>
    </Link>
  );
}

function Moves({ moves, pricePct, volumeX }: { moves: MoveAlert[]; pricePct: number; volumeX: number }) {
  if (!moves.length) return null;
  return (
    <section className="px-5 pt-7">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="display text-[19px] font-[650]">Unusual moves</h2>
        <span className="text-[13px] text-ink-3">
          ±{pricePct}% or {volumeX}× volume
        </span>
      </div>
      <div className="divide-y divide-line rounded-[14px] border border-line bg-sheet">
        {moves.slice(0, 6).map((m) => {
          const p = priceOf(m.symbol);
          const i = p ? p.dates.indexOf(m.date) : -1;
          return (
            <Link key={m.id} href={m.linkedAnnouncementId ? `/event/${m.linkedAnnouncementId}` : `/company/${m.symbol}`} className="block px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[15px] font-semibold">{metaFor(m.symbol).short}</span>{" "}
                  <span className="text-[13px] text-ink-3">{dayLabel(m.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {p && i > 0 && <Sparkline values={p.close.slice(Math.max(0, i - 20), i + 1)} width={64} height={22} />}
                  <span className="text-right text-[14px]">
                    <Delta v={m.pct} />
                    <span className="num block text-[12px] text-ink-3">{m.volX.toFixed(1)}× vol</span>
                  </span>
                </div>
              </div>
              <p className="mt-1 text-[13px] text-ink-2">{m.explanation ? `After: ${m.explanation}` : "No filing explains this move. Worth asking why."}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function ThreadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="mt-[1px] shrink-0" aria-hidden>
      <circle cx="3.5" cy="4" r="2" fill="var(--color-ink)" />
      <circle cx="12.5" cy="12" r="2" fill="none" stroke="var(--color-ink)" strokeWidth="1.4" />
      <path d="M4.8 5.4C7 8 9 9.5 11 10.8" stroke="var(--color-signal)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
