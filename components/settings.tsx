"use client";
import { useEffect, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/classify";
import { DEFAULT_THRESHOLDS } from "@/lib/push";
import type { Category, Thresholds } from "@/lib/types";

const KEY = "finn.thresholds.v1";

/** Per-device preferences. Kept in localStorage only (never sent to a server). */
export function useThresholds(): [Thresholds, (t: Thresholds) => void] {
  const [th, setTh] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setTh({ ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const save = (t: Thresholds) => {
    setTh(t);
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {}
  };
  return [th, save];
}

const WATCHABLE: Category[] = ["results", "management_change", "m_and_a", "litigation", "fund_raise", "capex", "order_win", "credit_rating", "pledging", "insider_trading", "dividend", "bonus_split"];

export function SettingsSheet({ open, onClose, th, onChange }: { open: boolean; onClose: () => void; th: Thresholds; onChange: (t: Thresholds) => void }) {
  if (!open) return null;
  const toggle = (c: Category) => onChange({ ...th, categories: th.categories.includes(c) ? th.categories.filter((x) => x !== c) : [...th.categories, c] });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30" onClick={onClose} role="dialog" aria-modal aria-label="Alert settings">
      <div className="rise max-h-[88dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[22px] bg-sheet px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="display text-[22px] font-[650]">What counts as unusual</h2>
        <p className="mt-1 text-[14px] text-ink-2">FINN watches end-of-day price and volume for every holding and re-ranks your brief as you change these.</p>

        <label className="mt-6 block">
          <div className="flex justify-between text-[15px]">
            <span>Price move in a day</span>
            <span className="num font-semibold">±{th.pricePct}%</span>
          </div>
          <input type="range" min={2} max={10} step={0.5} value={th.pricePct} onChange={(e) => onChange({ ...th, pricePct: Number(e.target.value) })} className="mt-2 w-full accent-[var(--color-ink)]" />
        </label>
        <label className="mt-5 block">
          <div className="flex justify-between text-[15px]">
            <span>Volume vs 20-day average</span>
            <span className="num font-semibold">{th.volumeX}×</span>
          </div>
          <input type="range" min={1.5} max={5} step={0.25} value={th.volumeX} onChange={(e) => onChange({ ...th, volumeX: Number(e.target.value) })} className="mt-2 w-full accent-[var(--color-ink)]" />
        </label>

        <h3 className="mt-7 text-[15px] font-semibold">Filings to escalate</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {WATCHABLE.map((c) => {
            const on = th.categories.includes(c);
            return (
              <button key={c} onClick={() => toggle(c)} aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-[14px] ${on ? "border-ink bg-ink text-sheet" : "border-line text-ink-2"}`}>
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>

        <h3 className="mt-7 text-[15px] font-semibold">Your data</h3>
        <ul className="mt-2 space-y-1.5 text-[14px] text-ink-2">
          <li>Your network is matched against filings in code on FINN&rsquo;s server. Names and contacts are never sent to an AI model.</li>
          <li>These preferences live only on this device.</li>
          <li>The network in this demo is synthetic. Market data and filings are real (NSE, BSE, Yahoo Finance, screener.in).</li>
        </ul>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              try {
                localStorage.removeItem(KEY);
              } catch {}
              onChange(DEFAULT_THRESHOLDS);
            }}
            className="flex-1 rounded-full border border-line py-3 text-[15px]"
          >
            Reset to defaults
          </button>
          <button onClick={onClose} className="flex-1 rounded-full bg-ink py-3 text-[15px] font-semibold text-sheet">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
