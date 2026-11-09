"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CONTACTS, links, PUBLIC } from "@/lib/network";

/**
 * A radial map of the network: you in the middle, contacts on the inner ring grouped by their main theme
 * (closer = stronger tie), and people from this month's filings on the outer ring, joined by the inferred links.
 */
export function Constellation() {
  const [hover, setHover] = useState<string | null>(null);
  const S = 340;
  const c = S / 2;
  const { nodes, outer, edges, groups } = useMemo(() => {
    const sorted = [...CONTACTS].sort((a, b) => (a.expertise[0] ?? "").localeCompare(b.expertise[0] ?? ""));
    const nodes = sorted.map((p, i) => {
      const ang = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
      const r = 62 + (3 - (p.relation?.strength ?? 1)) * 22;
      return { p, x: c + Math.cos(ang) * r, y: c + Math.sin(ang) * r, ang };
    });
    const outer = PUBLIC.map((p) => {
      // place each public person next to the contacts that link to them
      const linked = nodes.filter((n) => links(n.p, p).some((l) => l.kind !== "alumni"));
      const ang = linked.length ? Math.atan2(linked.reduce((s, n) => s + Math.sin(n.ang), 0), linked.reduce((s, n) => s + Math.cos(n.ang), 0)) : 0;
      return { p, linked, x: c + Math.cos(ang) * 152, y: c + Math.sin(ang) * 152 };
    });
    // spread outer nodes evenly, keeping their natural order around the circle
    const order = outer.map((o) => ({ o, ang: Math.atan2(o.y - c, o.x - c) })).sort((a, b) => a.ang - b.ang);
    const start = order[0]?.ang ?? 0;
    order.forEach(({ o }, i) => {
      const ang = start + (i / order.length) * Math.PI * 2;
      o.x = c + Math.cos(ang) * 152;
      o.y = c + Math.sin(ang) * 152;
    });
    const edges = outer.flatMap((o) => o.linked.map((n) => ({ a: n, b: o })));
    const groups = Array.from(new Set(sorted.map((p) => p.expertise[0])));
    return { nodes, outer, edges, groups };
  }, [c]);

  const active = hover ? [...nodes.map((n) => n.p), ...outer.map((o) => o.p)].find((p) => p.id === hover) : null;

  return (
    <div>
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Map of your network">
        <circle cx={c} cy={c} r={152} fill="none" stroke="var(--color-line)" strokeDasharray="2 4" />
        <circle cx={c} cy={c} r={106} fill="none" stroke="var(--color-line)" />
        {nodes.map((n) => (
          <line key={`s-${n.p.id}`} x1={c} y1={c} x2={n.x} y2={n.y} stroke="var(--color-line)" strokeWidth={1} />
        ))}
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.a.x}
            y1={e.a.y}
            x2={e.b.x}
            y2={e.b.y}
            stroke={hover && (hover === e.a.p.id || hover === e.b.p.id) ? "var(--color-signal)" : "var(--color-ink-3)"}
            strokeWidth={hover && (hover === e.a.p.id || hover === e.b.p.id) ? 2 : 1}
            strokeDasharray="3 3"
          />
        ))}
        <circle cx={c} cy={c} r={13} fill="var(--color-ink)" />
        <text x={c} y={c + 4} textAnchor="middle" fontSize="10" fill="var(--color-sheet)" fontWeight="600">
          You
        </text>
        {nodes.map((n) => (
          <Link key={n.p.id} href={`/person/${n.p.id}`}>
            <circle
              cx={n.x}
              cy={n.y}
              r={4 + (n.p.relation?.strength ?? 1) * 1.6}
              fill={n.p.currentInsiderAt?.length ? "var(--color-signal)" : "var(--color-ink)"}
              stroke="var(--color-paper)"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(n.p.id)}
              onFocus={() => setHover(n.p.id)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{n.p.name}</title>
            </circle>
          </Link>
        ))}
        {outer.map((o) => (
          <Link key={o.p.id} href={`/person/${o.p.id}`}>
            <circle cx={o.x} cy={o.y} r={7} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth={1.4} strokeDasharray="2 1.5" onMouseEnter={() => setHover(o.p.id)} onMouseLeave={() => setHover(null)}>
              <title>{o.p.name}</title>
            </circle>
            <text x={o.x} y={o.y + (o.y > c ? 19 : -12)} textAnchor="middle" fontSize="9.5" fill="var(--color-ink-2)">
              {o.p.name.split(" ").slice(-1)[0]}
            </text>
          </Link>
        ))}
      </svg>
      <p className="min-h-[20px] text-center text-[13px] text-ink-2">{active ? `${active.name}, ${active.headline}` : "Tap a dot. Inner ring: your contacts, closer means closer. Outer ring: new leaders in this month's filings."}</p>
      <p className="mt-1 text-center text-[12px] text-ink-3">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-signal align-middle" /> Current insider at a stock you follow ({groups.length} areas of expertise around the ring)
      </p>
    </div>
  );
}
