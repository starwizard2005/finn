import Link from "next/link";
import { firstName, pathsTo, person } from "@/lib/network";
import type { Helper, Person } from "@/lib/types";
import { CopyButton } from "./copy";
import { Avatar, Panel, Strength } from "./ui";

const ANGLE: Record<Helper["angle"], string> = {
  insider_former: "Former insider",
  insider_current: "Current insider",
  competitor: "Competitor view",
  supplier: "Supplier view",
  customer: "Customer view",
  partner: "Partner view",
  sector: "Sector expert",
  second_degree: "Knows the new leadership",
};

export function HelperList({ helpers, company }: { helpers: Helper[]; company: string }) {
  if (!helpers.length)
    return <p className="text-[14px] text-ink-2">Nobody in your network has worked at {company}, its competitors, suppliers or customers. Ask in Network to find the closest experts.</p>;
  return (
    <div className="space-y-2.5">
      {helpers.map((h, i) => (
        <Panel key={h.person.id} className="px-4 py-3">
          <div className="flex items-start gap-3">
            <Avatar name={h.person.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/person/${h.person.id}`} className="text-[15px] font-semibold hover:underline">
                  {h.person.name}
                </Link>
                {h.person.relation && <Strength n={h.person.relation.strength} />}
              </div>
              <p className="text-[12px] text-ink-3">
                {ANGLE[h.angle]}
                {i === 0 && ", best placed"}
              </p>
              <p className="mt-1 text-[14px]">{h.why}</p>
              {h.caution && <p className="mt-1.5 rounded-[8px] bg-signal-soft px-2.5 py-1.5 text-[13px] text-caution">{h.caution}</p>}
              <p className="mt-1.5 text-[13px] text-ink-2">Ask: “{h.ask}”</p>
              <div className="mt-2">
                <CopyButton
                  label="Copy a message"
                  text={`Hi ${firstName(h.person.name)}, hope you're well! I'm spending time on ${company} and you're the first person I thought of. Would you have 20 minutes this week? I'd love your read on one question: ${h.ask}`}
                />
              </div>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function Paths({ targetId }: { targetId: string }) {
  const t = person(targetId);
  const paths = pathsTo(targetId);
  if (!t) return null;
  if (!paths.length) return <p className="text-[14px] text-ink-2">No one in your network overlaps with {t.name} yet.</p>;
  return (
    <ol className="space-y-2.5">
      {paths.map((p, i) => (
        <li key={i}>
          <Panel className="px-4 py-3">
            <div className="flex items-center gap-2 text-[14px]">
              <span className="font-semibold">You</span>
              <Arrow />
              {p.via ? (
                <>
                  <Link href={`/person/${p.via.id}`} className="font-semibold hover:underline">
                    {p.via.name}
                  </Link>
                  <Arrow dashed />
                </>
              ) : null}
              <span className="font-semibold">{t.name}</span>
            </div>
            <p className="mt-1.5 text-[14px] text-ink-2">{p.link?.why}</p>
            <p className="mt-1 text-[12px] text-ink-3">
              {p.link?.kind === "alumni" ? "Weak tie: shared alma mater" : p.link?.overlap === "dates not public" ? "Inferred from employer history; dates not public" : "Inferred from overlapping tenure"}
              {p.via?.relation && `. You and ${firstName(p.via.name)}: ${/^[A-Z][a-z]/.test(p.via.relation.how) ? p.via.relation.how.charAt(0).toLowerCase() + p.via.relation.how.slice(1) : p.via.relation.how}`}
            </p>
          </Panel>
        </li>
      ))}
    </ol>
  );
}

const Arrow = ({ dashed }: { dashed?: boolean }) => (
  <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden>
    <path d="M1 4h18" stroke="var(--color-ink-3)" strokeWidth="1.4" strokeDasharray={dashed ? "3 2" : undefined} />
    <path d="M16 1l3 3-3 3" stroke="var(--color-ink-3)" strokeWidth="1.4" fill="none" />
  </svg>
);

export function Career({ p }: { p: Person }) {
  return (
    <ol className="relative ml-1.5 border-l border-line pl-4">
      {[...p.career].reverse().map((s, i) => (
        <li key={i} className="relative pb-3 last:pb-0">
          <span className={`absolute -left-[21px] top-[6px] h-2.5 w-2.5 rounded-full border-2 border-paper ${s.to == null ? "bg-signal" : "bg-ink-3"}`} />
          <p className="text-[14px] font-semibold">{s.org}</p>
          <p className="text-[13px] text-ink-2">
            {[s.role, s.from || s.to ? `${s.from ?? "?"}–${s.to ?? "now"}` : null].filter(Boolean).join(", ") || "Role and dates not disclosed"}
          </p>
        </li>
      ))}
    </ol>
  );
}
