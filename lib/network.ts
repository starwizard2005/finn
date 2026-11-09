/**
 * The Network layer.
 *
 * Everything here is deterministic code over the investor's private graph — no person data is ever
 * sent to an LLM. Links between people are *inferred* from overlapping employers / institutions /
 * years (entity-resolved via lib/companies.ts) and always labelled as inferred, with the evidence.
 */
import networkData from "@/data/network.json";
import snapshot from "@/data/snapshot.json";
import { BY_SYMBOL, COMPANIES, metaFor, normOrg, resolveOrg } from "./companies";
import type { Announcement, Category, Edu, Helper, Link, Path, Person, Stint } from "./types";

const NOW_YEAR = new Date(snapshot.generatedAt).getFullYear();
const NOW = new Date(snapshot.generatedAt).getTime();

export const INVESTOR = networkData.investor as unknown as Person;
export const PEOPLE = networkData.people as unknown as Person[];
export const CONTACTS = PEOPLE.filter((p) => p.kind === "contact");
export const PUBLIC = PEOPLE.filter((p) => p.kind === "public");
const BY_ID: Record<string, Person> = Object.fromEntries([INVESTOR, ...PEOPLE].map((p) => [p.id, p]));
export const person = (id: string) => BY_ID[id];

// ---------- entity resolution ----------
function sameOrg(a: string, b: string): boolean {
  if (normOrg(a) === normOrg(b)) return true;
  const ra = resolveOrg(a);
  return !!ra && ra === resolveOrg(b);
}

const end = (s: { to?: number | null }) => s.to ?? NOW_YEAR;
/** "V. N. Srivatsan" -> "Srivatsan", "Dr. Arun Sharma" -> "Arun" */
export const firstName = (name: string) => {
  const parts = name.replace(/^Dr\.\s+/, "").split(" ");
  return parts.find((x) => x.replace(".", "").length > 1 && !x.endsWith(".")) ?? name;
};
const fmtSpan = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}–${hi === NOW_YEAR ? "now" : hi}`);

export function currentStint(p: Person): Stint | undefined {
  return p.career.find((s) => s.to == null) ?? p.career[p.career.length - 1];
}

export function currentSymbol(p: Person): string | null {
  const s = currentStint(p);
  return s && s.to == null ? resolveOrg(s.org) : null;
}

/** All inferred links between two people, strongest first. */
export function links(a: Person, b: Person): Link[] {
  const out: Link[] = [];
  for (const sa of a.career) {
    for (const sb of b.career) {
      if (!sameOrg(sa.org, sb.org)) continue;
      const known = sa.from != null && sb.from != null;
      const lo = Math.max(sa.from ?? -Infinity, sb.from ?? -Infinity);
      const hi = Math.min(end(sa), end(sb));
      const sameTeam = !!sa.team && !!sb.team && sa.team === sb.team;
      if (known && lo > hi) continue; // both dated, no overlap
      const years = known ? hi - lo + 1 : 0;
      let strength = known ? 0.5 + 0.1 * Math.min(years, 3) : 0.3;
      // Only overlapping at the target's brand-new employer says little about knowing them.
      const fresh = known && lo >= NOW_YEAR;
      if (fresh) strength = 0.2;
      if (sameTeam) strength += 0.2;
      // If only one side is dated, check the dated side at least overlaps the other's end year.
      if (!known && sa.to != null && sb.from != null && sa.to < sb.from) continue;
      if (!known && sb.to != null && sa.from != null && sb.to < sa.from) continue;
      out.push({
        kind: "colleague",
        org: sb.org,
        overlap: known ? fmtSpan(lo, hi) : "dates not public",
        strength: Math.min(strength, 1),
        why: known
          ? `Both at ${sb.org} ${fmtSpan(lo, hi)}${sameTeam ? `, same team (${sb.team})` : ""}${sb.role ? ` — ${firstName(b.name)} ${fresh ? "is" : "was"} ${sb.role}` : ""}`
          : `Both worked at ${sb.org}${sameTeam ? ` in ${sb.team}` : ""}; tenure overlap not confirmed`,
      });
    }
  }
  for (const ea of a.education) {
    for (const eb of b.education as Edu[]) {
      if (normOrg(ea.org) !== normOrg(eb.org)) continue;
      const dated = ea.from != null && eb.from != null;
      const close = dated && Math.abs((ea.from as number) - (eb.from as number)) <= 1;
      out.push({
        kind: close ? "classmate" : "alumni",
        org: eb.org,
        overlap: dated ? `${eb.from}–${eb.to}` : "",
        strength: close ? 0.6 : 0.15,
        why: close ? `Classmates at ${eb.org} (${eb.from}–${eb.to})` : `Fellow ${eb.org} alumni`,
      });
    }
  }
  return out.sort((x, y) => y.strength - x.strength);
}

const warmth = (c: Person) => 0.55 + 0.15 * (c.relation?.strength ?? 1);
const monthsSince = (iso: string) => Math.round((NOW - new Date(iso).getTime()) / (30.4 * 864e5));

/** How does the investor reach a target person? Direct overlap first, then one hop through a contact. */
export function pathsTo(targetId: string, limit = 3): Path[] {
  const target = BY_ID[targetId];
  if (!target) return [];
  const out: Path[] = [];
  if (target.kind === "contact") {
    return [{ target, via: null, link: null, score: 1, label: `${target.name} is in your network (${target.relation?.how})` }];
  }
  const direct = links(INVESTOR, target)[0];
  if (direct && direct.kind !== "alumni") {
    out.push({ target, via: null, link: direct, score: direct.strength * 0.9, label: `You: ${direct.why}` });
  }
  for (const c of CONTACTS) {
    const l = links(c, target)[0];
    if (!l) continue;
    const score = l.strength * warmth(c);
    out.push({ target, via: c, link: l, score, label: `${c.name} — ${l.why}` });
  }
  out.sort((a, b) => b.score - a.score);
  // Alumni ties are weak; show at most one, and only if nothing better exists.
  const strong = out.filter((p) => p.link?.kind !== "alumni");
  const res = strong.slice(0, limit);
  if (res.length < limit) {
    const alum = out.find((p) => p.link?.kind === "alumni");
    if (alum) res.push(alum);
    else if (direct?.kind === "alumni") res.push({ target, via: null, link: direct, score: 0.1, label: `You: ${direct.why}` });
  }
  return res;
}

// ---------- who can help me understand a company ----------
const ASK: Record<string, (co: string) => string> = {
  insider_former: (co) => `How is ${co} run day-to-day, and what would worry you as an insider today?`,
  insider_current: (co) => `Industry-level context only (customer demand, hiring, competitive intensity) — no ${co}-specific numbers.`,
  competitor: (co) => `Where is ${co} winning or losing deals against you, and on what — price, tech or relationships?`,
  supplier: (co) => `How are ${co}'s volumes and payment terms trending with you?`,
  customer: (co) => `Why do you buy from ${co}, and what would make you switch?`,
  partner: (co) => `How important is ${co} to your programme, and how is the partnership evolving?`,
  sector: (co) => `What is the one thing the market is missing about ${co}'s sector right now?`,
  second_degree: (co) => `Could you introduce me to someone in ${co}'s new leadership?`,
};

export function helpersFor(symbol: string, opts: { event?: Category; limit?: number } = {}): Helper[] {
  const meta = metaFor(symbol);
  const co = meta.short;
  const relSets: [Helper["angle"], string[] | undefined][] = [
    ["competitor", meta.competitors],
    ["supplier", meta.suppliers],
    ["customer", meta.customers],
    ["partner", meta.partners],
  ];
  const leadersHere = PUBLIC.filter((p) => currentSymbol(p) === symbol);
  const out: Helper[] = [];

  for (const c of CONTACTS) {
    let best: Helper | null = null;
    const consider = (h: Helper) => {
      if (!best || h.score > best.score) best = h;
    };
    const w = warmth(c);

    for (const s of c.career) {
      const sym = resolveOrg(s.org);
      if (sym === symbol) {
        if (s.to == null || c.currentInsiderAt?.includes(symbol)) {
          consider({
            person: c,
            score: 0.8 * w,
            angle: "insider_current",
            why: `Works at ${co} today (${s.role ?? "employee"})`,
            ask: ASK.insider_current(co),
            caution: "Current employee: likely holds price-sensitive information. Keep it to industry context (SEBI PIT).",
          });
        } else {
          const yrsAgo = NOW_YEAR - (s.to as number);
          const fresh = yrsAgo <= 3 ? 1 : yrsAgo <= 6 ? 0.85 : 0.7;
          consider({
            person: c,
            score: 0.95 * fresh * w,
            angle: "insider_former",
            why: `Ex-${co}: ${s.role ?? "worked there"} ${s.from ?? ""}–${s.to}`,
            ask: ASK.insider_former(co),
          });
        }
      }
      for (const [angle, orgs] of relSets) {
        if (orgs?.some((o) => sameOrg(o, s.org))) {
          const now = s.to == null;
          consider({
            person: c,
            score: (now ? 0.7 : 0.6) * w,
            angle,
            why: `${now ? "At" : "Ex-"}${now ? " " : ""}${s.org} — a ${co} ${angle}${s.role ? ` (${s.role})` : ""}`,
            ask: ASK[angle](co),
          });
        }
      }
    }
    // second degree: contact overlaps with someone who now leads the company
    for (const leader of leadersHere) {
      const l = links(c, leader)[0];
      if (l && l.kind !== "alumni") {
        consider({
          person: c,
          score: 0.62 * l.strength * w + 0.2,
          angle: "second_degree",
          why: `Overlapped with ${leader.name} at ${l.org}${l.overlap !== "dates not public" ? ` (${l.overlap})` : ""}. ${firstName(leader.name)} is now ${(leader.career.find((s) => s.to == null)?.role ?? "a leader").split(";")[0]} at ${co}.`,
          ask: `Context on ${leader.name}: how does ${leader.name.split(" ")[0]} operate, and what will change at ${co}?`,
        });
      }
    }
    // sector expertise
    const shared = c.expertise.filter((t) => meta.themes.includes(t));
    if (shared.length) {
      consider({
        person: c,
        score: (0.35 + 0.08 * shared.length) * w,
        angle: "sector",
        why: `Knows ${shared.join(", ")}`,
        ask: ASK.sector(co),
      });
    }
    if (best) out.push(best);
  }
  // Events change who is most useful: for a people-event prefer second-degree paths; for
  // litigation/regulatory prefer former insiders and regulatory experts.
  for (const h of out) {
    if (opts.event === "management_change" && h.angle === "second_degree") h.score += 0.25;
    if (opts.event === "litigation" && (h.angle === "insider_former" || h.person.expertise.includes("regulatory"))) h.score += 0.15;
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}

// ---------- theme queries & expertise map ----------
export const THEMES = Array.from(new Set(CONTACTS.flatMap((c) => c.expertise))).sort();

export function expertsOn(theme: string): Person[] {
  const t = theme.toLowerCase();
  return CONTACTS.filter((c) => c.expertise.some((e) => e === t)).sort(
    (a, b) => (b.relation?.strength ?? 0) - (a.relation?.strength ?? 0),
  );
}

export type Coverage = { theme: string; exposure: number; people: Person[]; symbols: string[] };

/** Portfolio exposure by theme vs. how many people the investor can call on it. */
export function coverage(): Coverage[] {
  const m = new Map<string, Coverage>();
  for (const c of COMPANIES.filter((x) => x.portfolio)) {
    for (const t of c.themes) {
      const cur = m.get(t) ?? { theme: t, exposure: 0, people: expertsOn(t), symbols: [] };
      cur.exposure += (c.weight ?? 0) / c.themes.length;
      cur.symbols.push(c.symbol);
      m.set(t, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.exposure - a.exposure);
}

// ---------- keep the network warm ----------
export type Nudge = { person: Person; months: number; reason: string; symbol: string; announcementId: string; draft: string };

export function keepWarm(items: (Announcement & { tier?: string })[], minMonths = 4): Nudge[] {
  const out: Nudge[] = [];
  const seen = new Set<string>();
  const material = items.filter((a) => a.tier !== "routine" && !["unclassified", "investor_meetings", "earnings_call"].includes(a.category));
  for (const c of CONTACTS) {
    const months = monthsSince(c.relation!.lastContact);
    if (months < minMonths) continue;
    for (const s of c.career) {
      const sym = resolveOrg(s.org);
      if (!sym) continue;
      const a = material.find((x) => x.symbol === sym);
      if (!a || seen.has(c.id)) continue;
      seen.add(c.id);
      const first = c.name.replace(/^Dr\. /, "").split(" ")[0];
      const formerly = s.to != null;
      out.push({
        person: c,
        months,
        symbol: sym,
        announcementId: a.id,
        reason: `${months} months since you spoke. ${formerly ? "Their former employer" : "Their employer"} ${BY_SYMBOL[sym]?.short ?? sym}: ${a.headline}`,
        draft: `Hi ${first} — it's been a while! Saw ${BY_SYMBOL[sym]?.short ?? sym}'s news (${a.headline.replace(/\.$/, "")}) and thought of you${formerly ? " given your years there" : ""}. Would love to catch up over coffee in the next couple of weeks and hear how you read it. How have you been?`,
      });
    }
  }
  return out.sort((a, b) => b.months - a.months);
}

// ---------- the "quiet advantage": things the network notices that the investor would not ----------
export type Insight = { id: string; title: string; body: string; href: string; kind: "path" | "gap" | "caution" | "cluster" };

export function insights(items: Announcement[]): Insight[] {
  const out: Insight[] = [];
  // 1. New leaders you can reach
  const appointed = items.flatMap((a) => a.people.filter((p) => p.change === "appointed" && p.profileId && BY_ID[p.profileId]).map((p) => ({ a, p })));
  const seenP = new Set<string>();
  const pathScore = new Map<string, number>();
  for (const { a, p } of appointed) {
    if (seenP.has(p.profileId!)) continue;
    seenP.add(p.profileId!);
    const paths = pathsTo(p.profileId!).filter((x) => x.link?.kind !== "alumni");
    if (!paths.length) continue;
    const best = paths[0];
    pathScore.set(`path-${p.profileId}`, best.score);
    out.push({
      id: `path-${p.profileId}`,
      kind: "path",
      title: `${paths.length} route${paths.length > 1 ? "s" : ""} to ${p.name}, new at ${metaFor(a.symbol).short}`,
      body: best.via ? `Warmest: ${best.via.name}. ${best.link!.why}.` : best.label,
      href: `/person/${p.profileId}`,
    });
  }
  out.sort((a, b) => (pathScore.get(b.id) ?? 0) - (pathScore.get(a.id) ?? 0));
  // 2. Coverage gaps
  for (const c of coverage()) {
    if (c.exposure >= 3 && c.people.length <= 1) {
      out.push({
        id: `gap-${c.theme}`,
        kind: "gap",
        title: `Thin on ${c.theme}`,
        body: `${Math.round(c.exposure)}% of your book (${c.symbols.join(", ")}) but only ${c.people.length} person you can call.`,
        href: `/network?q=${encodeURIComponent(c.theme)}`,
      });
    }
  }
  // 3. Insider caution
  const insiders = CONTACTS.filter((c) => c.currentInsiderAt?.length);
  if (insiders.length) {
    out.push({
      id: "caution-insiders",
      kind: "caution",
      title: `${insiders.length} contacts are current insiders`,
      body: `${insiders.map((c) => `${c.name} (${c.currentInsiderAt!.join(", ")})`).join(", ")}. FINN keeps them to industry context.`,
      href: "/network?q=insiders",
    });
  }
  // 4. Alumni cluster around a new leader
  for (const { p } of appointed) {
    const target = BY_ID[p.profileId!];
    for (const e of target.education) {
      const alumni = CONTACTS.filter((c) => c.education.some((x) => normOrg(x.org) === normOrg(e.org)));
      const you = INVESTOR.education.some((x) => normOrg(x.org) === normOrg(e.org));
      if (alumni.length >= 2 && you) {
        out.push({
          id: `alum-${target.id}-${normOrg(e.org)}`,
          kind: "cluster",
          title: `${target.name} is ${e.org} — so are you`,
          body: `Plus ${alumni.length} of your contacts (${alumni.map((a) => a.name.split(" ")[0]).join(", ")}). A light-touch alumni intro is credible.`,
          href: `/person/${target.id}`,
        });
      }
    }
  }
  return out;
}

/** Free-text network search: people, orgs, themes, companies. */
export function searchNetwork(q: string): { people: Person[]; theme?: string; symbol?: string } {
  const s = q.toLowerCase().trim();
  if (!s) return { people: [] };
  if (s === "insiders") return { people: CONTACTS.filter((c) => c.currentInsiderAt?.length) };
  const theme = THEMES.find((t) => s.includes(t) || t.includes(s));
  if (theme) return { people: expertsOn(theme), theme };
  const co = COMPANIES.find((c) => c.symbol.toLowerCase() === s || c.aliases.some((a) => s.includes(a.toLowerCase())));
  if (co) return { people: helpersFor(co.symbol, { limit: 8 }).map((h) => h.person), symbol: co.symbol };
  const people = PEOPLE.filter(
    (p) => p.name.toLowerCase().includes(s) || p.career.some((x) => x.org.toLowerCase().includes(s)) || p.headline.toLowerCase().includes(s),
  );
  return { people };
}
