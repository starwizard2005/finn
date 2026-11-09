/** Sanity checks on the engines with the real snapshot. `npm test` */
import assert from "node:assert";
import { classify } from "../lib/classify";
import { digest, FUNDAMENTALS } from "../lib/data";
import { coverage, helpersFor, insights, keepWarm, links, pathsTo, person } from "../lib/network";
import { analyse, resultsCard } from "../lib/research";
import { ANNOUNCEMENTS } from "../lib/data";

// classifier
assert.equal(classify("Change in Management", "x").category, "management_change");
assert.equal(classify("General Updates", "Change in Managing Director and Chief Executive Officer of the Bank").category, "management_change");
assert.equal(classify("Copy of Newspaper Publication", "Copy of Newspaper Publication").category, "unclassified");
assert.equal(classify("Bagging/Receiving of orders/contracts", "x").category, "order_win");

const d = digest(24 * 21);
console.log(`\n21-day digest: ${d.total} filings -> ${d.events.length} events, ${d.moves.length} move alerts`);
for (const e of d.events.slice(0, 14)) console.log(`${String(e.lead.score).padStart(3)} ${e.lead.tier.padEnd(8)} ${e.lead.symbol.padEnd(10)} ${e.lead.headline.slice(0, 70)}  (+${e.related.length})`);
console.log("\nmoves:");
for (const m of d.moves.slice(0, 10)) console.log(`${m.date} ${m.symbol.padEnd(10)} ${m.pct.toFixed(1).padStart(6)}% ${m.volX.toFixed(1)}x  ${m.explanation ?? ""}`);

const d24 = digest(24);
console.log(`\n24h: ${d24.total} filings, ${d24.events.length} events; top: ${d24.events[0]?.lead.headline}`);

console.log("\nPaths to Anup Bagchi:");
for (const p of pathsTo("anup-bagchi")) console.log(`  ${p.score.toFixed(2)} ${p.label}`);
console.log("Paths to Rajat Shah:");
for (const p of pathsTo("rajat-shah")) console.log(`  ${p.score.toFixed(2)} ${p.label}`);

for (const s of ["KAYNES", "CGPOWER", "HDFCBANK", "PERSISTENT", "SUNPHARMA"]) {
  console.log(`\nWho can help on ${s}:`);
  for (const h of helpersFor(s, { limit: 4 })) console.log(`  ${h.score.toFixed(2)} ${h.angle.padEnd(16)} ${h.person.name}: ${h.why}${h.caution ? " [CAUTION]" : ""}`);
}
console.log("\nInsights:");
for (const i of insights(ANNOUNCEMENTS)) console.log(`  [${i.kind}] ${i.title} — ${i.body}`);
console.log("\nKeep warm:");
for (const n of keepWarm(d.events.map((e) => e.lead)).slice(0, 5)) console.log(`  ${n.person.name}: ${n.reason}`);
console.log("\nCoverage:");
for (const c of coverage().slice(0, 8)) console.log(`  ${c.theme.padEnd(20)} ${c.exposure.toFixed(1)}%  ${c.people.length} people`);

console.log("\nResults cards:");
for (const s of ["MARUTI", "HDFCBANK", "NAVINFLUOR"]) {
  const r = resultsCard(FUNDAMENTALS[s])!;
  console.log(` ${s} ${r.quarter}: ${r.lines.map((l) => `${l.label} ${l.cur} (QoQ ${l.qoq?.toFixed(1)}%, YoY ${l.yoy?.toFixed(1)}%)`).join("; ")}\n   -> ${r.takeaway}`);
}
console.log("\nKAYNES analysis:");
for (const sec of analyse(FUNDAMENTALS.KAYNES)) console.log(` ${sec.title}: ${sec.bullets.map((b) => b.text).join(" | ")}`);
assert.ok(links(person("vivek-iyer"), person("anup-bagchi")).length > 0);
// Ask planner
import("../lib/ask").then(({ planRules, hrefFor }) => {
  const cases: [string, string][] = [
    ["Did Kaynes deliver what it promised?", "/company/KAYNES#promises"],
    ["Persistent: bull vs bear", "/company/PERSISTENT#bullbear"],
    ["Who can introduce me to Anup Bagchi?", "/person/anup-bagchi"],
    ["Who knows specialty chemicals?", "/network?q=specialty%20chemicals"],
    ["Who should I call about CG Power?", "/company/CGPOWER#people"],
    ["TATAELXSI cash quality", "/company/TATAELXSI#cash"],
    ["what changed this week", "/"],
  ];
  for (const [q, want] of cases) {
    const p = planRules(q);
    assert.equal(p && hrefFor(p.steps[0]), want, q);
  }
  console.log("ask planner: 7/7 routed correctly");
  console.log("\nall assertions passed");
});
