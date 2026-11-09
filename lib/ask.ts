/**
 * "Ask FINN": turn a free-text question into a short plan of tool calls.
 *
 * Tools (all deterministic, all local):
 *   research(symbol, section?)  -> /company/SYMBOL#section
 *   who_can_help(symbol)        -> ranked helpers for a company
 *   experts(theme)              -> people in the network for a theme
 *   reach(person)               -> paths to a person
 *   digest(hours)               -> the brief for a window
 *
 * The planner is rules-first (instant, free, offline). When a Gemini key is configured, /api/ask
 * lets the fast model produce the same plan for questions the rules can't parse.
 */
import { COMPANIES } from "./companies";
import { PEOPLE, THEMES } from "./network";

export type Step =
  | { tool: "research"; symbol: string; section?: string }
  | { tool: "who_can_help"; symbol: string }
  | { tool: "experts"; theme: string }
  | { tool: "reach"; personId: string }
  | { tool: "digest"; hours: number };

export type Plan = { steps: Step[]; understood: string; by: "rules" | "model" };

const SECTION: [RegExp, string, string][] = [
  [/promis|deliver|guid|said vs|walk the talk|credib/i, "promises", "promised vs delivered"],
  [/bull|bear|case for|case against|thesis/i, "bullbear", "bull vs bear"],
  [/cash|fcf|conversion/i, "cash", "cash quality"],
  [/debt|leverage|balance sheet|working capital/i, "balance", "balance sheet"],
  [/grow|trajectory|trend|margin/i, "trajectory", "trajectory"],
  [/quarter|results|numbers/i, "numbers", "latest numbers"],
];

export function findCompany(q: string) {
  const s = q.toLowerCase();
  // longest alias first so "Kaynes Technology" beats "Kaynes"
  const cands = COMPANIES.flatMap((c) => [c.symbol, c.short, c.name, ...c.aliases].map((a) => ({ c, a: a.toLowerCase() }))).sort((x, y) => y.a.length - x.a.length);
  for (const { c, a } of cands) {
    if (a.length < 3) continue;
    const re = new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(s)) return c;
  }
  return null;
}

export function planRules(q: string): Plan | null {
  const s = q.trim();
  if (!s) return null;
  const lower = s.toLowerCase();

  const p = PEOPLE.find((x) => lower.includes(x.name.toLowerCase()) || (x.name.split(" ").length > 1 && lower.includes(x.name.split(" ").slice(-1)[0].toLowerCase()) && x.kind === "public"));
  if (p) return { steps: [{ tool: "reach", personId: p.id }], understood: `How you can reach ${p.name}`, by: "rules" };

  const wantsPeople = /who (do i|should i|can|knows?)|expert|call|introduc|someone|contact|network|reach/i.test(lower);
  const theme = THEMES.find((t) => lower.includes(t));
  const co = findCompany(s);

  if (co && wantsPeople) return { steps: [{ tool: "who_can_help", symbol: co.symbol }], understood: `Who in your network can help on ${co.short}`, by: "rules" };
  if (theme && (wantsPeople || !co)) return { steps: [{ tool: "experts", theme }], understood: `Your go-to people on ${theme}`, by: "rules" };
  if (co) {
    const sec = SECTION.find(([re]) => re.test(lower));
    return { steps: [{ tool: "research", symbol: co.symbol, section: sec?.[1] }], understood: `Research ${co.short}${sec ? `: ${sec[2]}` : ""}`, by: "rules" };
  }
  if (/what changed|today|brief|digest|this week|news/i.test(lower)) {
    const hours = /week/.test(lower) ? 168 : /month|3 weeks/.test(lower) ? 504 : 24;
    return { steps: [{ tool: "digest", hours }], understood: `Your brief for the last ${hours === 24 ? "24 hours" : hours === 168 ? "7 days" : "3 weeks"}`, by: "rules" };
  }
  // A bare NSE-looking symbol: research it live.
  const tick = s.match(/\b[A-Z][A-Z0-9&-]{2,14}\b/);
  if (tick) {
    const sec = SECTION.find(([re]) => re.test(lower));
    return { steps: [{ tool: "research", symbol: tick[0], section: sec?.[1] }], understood: `Research ${tick[0]} (any NSE symbol works)`, by: "rules" };
  }
  return null;
}

export function hrefFor(step: Step): string {
  switch (step.tool) {
    case "research":
      return `/company/${encodeURIComponent(step.symbol)}${step.section ? `#${step.section}` : ""}`;
    case "who_can_help":
      return `/company/${step.symbol}#people`;
    case "experts":
      return `/network?q=${encodeURIComponent(step.theme)}`;
    case "reach":
      return `/person/${step.personId}`;
    case "digest":
      return `/`;
  }
}
