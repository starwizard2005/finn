import { NextResponse } from "next/server";
import { planRules, type Plan } from "@/lib/ask";
import { COMPANIES } from "@/lib/companies";
import { generateJSON, hasKey } from "@/lib/llm";
import { THEMES } from "@/lib/network";

/**
 * POST {q} -> Plan. Rules first; the fast model is only consulted when rules can't parse the question.
 * Privacy: the model sees the question, the ticker list and theme names, never the investor's contacts.
 */
export async function POST(req: Request) {
  const { q } = (await req.json()) as { q: string };
  const rules = planRules(q ?? "");
  if (rules || !hasKey()) return NextResponse.json(rules ?? { steps: [], understood: "", by: "rules" });
  try {
    const r = await generateJSON<Plan>({
      tier: "fast",
      system: "You route an investor's question to tools. Reply with JSON only.",
      prompt: `Tools: research(symbol, section in [promises,bullbear,cash,balance,trajectory,numbers]), who_can_help(symbol), experts(theme), digest(hours), screen(metric in [cash_conversion,leverage,revenue_growth,profit_growth,margin_change]) to rank all holdings.
Known companies: ${COMPANIES.map((c) => `${c.symbol}=${c.short}`).join(", ")}. Any other valid NSE symbol is allowed for research.
Themes: ${THEMES.join(", ")}.
Question: "${q}"
Return {"steps":[{"tool":"research","symbol":"KAYNES","section":"promises"}],"understood":"one short line"}`,
      maxTokens: 300,
    });
    return NextResponse.json({ ...r.data, by: "model" });
  } catch {
    return NextResponse.json({ steps: [], understood: "", by: "rules" });
  }
}
