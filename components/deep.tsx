"use client";
import { useState } from "react";
import type { DeepAnalysis, PromiseItem } from "@/lib/types";
import { Panel } from "./ui";

const VERDICT: Record<PromiseItem["verdict"], { label: string; cls: string }> = {
  beat: { label: "Beat", cls: "bg-gain text-sheet" },
  delivered: { label: "Delivered", cls: "bg-gain/15 text-gain" },
  partly: { label: "Partly", cls: "bg-signal-soft text-caution" },
  missed: { label: "Missed", cls: "bg-loss text-sheet" },
  pending: { label: "Pending", cls: "border border-line text-ink-2" },
};

export function DeepPanel({ symbol, seeded, hasCalls }: { symbol: string; seeded: DeepAnalysis | null; hasCalls: boolean }) {
  const [deep, setDeep] = useState<DeepAnalysis | null>(seeded);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");

  async function run() {
    setState("loading");
    try {
      const r = await fetch(`/api/deep/${symbol}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDeep(j);
      setState("idle");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }

  if (!deep)
    return (
      <Panel className="px-4 py-4">
        <p className="text-[15px]">FINN can read the last four earnings-call transcripts, pull out every number management promised, and check it against what the company reported.</p>
        <p className="mt-1.5 text-[13px] text-ink-3">About 30 seconds. Uses primary sources only: transcripts filed with the exchange and reported financials.</p>
        <button disabled={state === "loading" || !hasCalls} onClick={run} className="mt-3 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-sheet disabled:opacity-50">
          {state === "loading" ? "Reading transcripts…" : hasCalls ? "Read the transcripts" : "No transcripts listed for this company"}
        </button>
        {state === "error" && <p className="mt-2 text-[13px] text-loss">{err}</p>}
      </Panel>
    );

  const tally = deep.promises.reduce<Record<string, number>>((m, p) => ((m[p.verdict] = (m[p.verdict] ?? 0) + 1), m), {});
  return (
    <div>
      <p className="mb-3 text-[14px] text-ink-2">
        {deep.promises.length} commitments from the last {deep.sources.length} calls:{" "}
        {(["beat", "delivered", "partly", "missed", "pending"] as const)
          .filter((k) => tally[k])
          .map((k) => `${tally[k]} ${VERDICT[k].label.toLowerCase()}`)
          .join(", ")}
        .
      </p>
      <div className="space-y-2.5">
        {deep.promises.map((p, i) => (
          <Panel key={i} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-semibold">{p.topic}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${VERDICT[p.verdict].cls}`}>{VERDICT[p.verdict].label}</span>
            </div>
            <dl className="mt-1.5 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[14px]">
              <dt className="text-ink-3">Promised</dt>
              <dd>
                {p.promised} <span className="text-[12px] text-ink-3">({p.when})</span>
              </dd>
              <dt className="text-ink-3">Delivered</dt>
              <dd>{p.delivered}</dd>
            </dl>
            {p.evidence.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] text-ink-2 underline decoration-line underline-offset-4">In their words ({p.evidence.length})</summary>
                <div className="mt-2 space-y-2">
                  {p.evidence.map((e, j) => (
                    <blockquote key={j} className="border-l-2 border-signal pl-3 text-[13px] text-ink-2">
                      “{e.quote.trim()}”<span className="mt-0.5 block text-[12px] text-ink-3">{e.source}</span>
                    </blockquote>
                  ))}
                </div>
              </details>
            )}
          </Panel>
        ))}
      </div>

      {deep.guidance.length > 0 && (
        <>
          <h3 id="guidance" className="display mb-2 mt-7 text-[17px] font-[650]">
            Live guidance
          </h3>
          <Panel className="divide-y divide-line">
            {deep.guidance.map((g, i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="flex justify-between gap-3 text-[14px]">
                  <span className="font-semibold">{g.metric}</span>
                  <span className="text-right text-[13px] text-ink-2">{g.status}</span>
                </div>
                <p className="text-[13px] text-ink-2">
                  {g.target} <span className="text-ink-3">({g.said})</span>
                </p>
              </div>
            ))}
          </Panel>
        </>
      )}

      {deep.narrativeVsNumbers.length > 0 && (
        <>
          <h3 className="display mb-2 mt-7 text-[17px] font-[650]">Narrative vs numbers</h3>
          <ul className="space-y-2">
            {deep.narrativeVsNumbers.map((x, i) => (
              <li key={i} className="flex gap-2 text-[15px]">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
                {x}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 id="bullbear" className="display mb-2 mt-7 scroll-mt-16 text-[17px] font-[650]">
        Bull vs bear
      </h3>
      <div className="grid grid-cols-1 gap-2.5">
        <Panel className="px-4 py-3">
          <p className="text-[13px] font-semibold text-gain">The bull case</p>
          <ul className="mt-1 space-y-1.5 text-[14px]">
            {deep.bull.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-[13px] font-semibold text-loss">The bear case</p>
          <ul className="mt-1 space-y-1.5 text-[14px]">
            {deep.bear.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">
        {deep.generatedBy}. Sources:{" "}
        {deep.sources.map((s, i) => (
          <span key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
              {s.label.replace("Earnings call transcript — ", "")}
            </a>
            {i < deep.sources.length - 1 ? ", " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
