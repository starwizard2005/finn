# FINN: covering note

**Prototype:** (https://finn-blond.vercel.app) (open on a phone, or at phone width) · **Repo:** https://github.com/starwizard2005/finn · **AI build history:** <SESSION_SHARE_LINK(S)>

## What I built

FINN answers three questions an investor asks all day: *what changed, does it matter, and who can I call about it?*

- **Brief (Push).** It reads every NSE filing across an 18-stock book (190 real filings from 20 Oct to 9 Nov 2026) and scores each for materiality, showing the reasons. Related filings fold into one event (a results day produces 5–8 filings; you see one card). About half the filings (100 of 190) are routine paperwork and collapse into a single line. End-of-day moves beyond thresholds you set (±X%, N× volume) are matched to the filing most likely to explain them, and FINN says plainly when no filing does ("BAJFINANCE +7.6% on 3.5× volume: no filing explains this. Worth asking why"). Quiet windows aren't left empty: "Still open from this week" carries forward what's unresolved.
- **The three treatments from the brief.** *Management change*: HDFC Bank's new MD & CEO, Anup Bagchi. The bio is read from the filing PDF, and FINN shows that two contacts overlapped with him (ICICI Pru Life 2023–26, ICICI Bank 2017–19), plus an IIT Kanpur alumni angle. *Results*: a first cut of Revenue, EBITDA, PBT and PAT, QoQ and YoY, with a one-line takeaway ("Maruti: revenue +26%, PAT −26%, margin 12→9%. Growth didn't reach the bottom line"). *Material event*: CG Power's plant-closure order and the High Court stay; FINN points to an ex-CG Power treasury contact first, then a competitor's engineer.
- **Ask (Pull).** Works on any NSE ticker, fetched live. Every number is computed by code from reported financials: trajectory, balance sheet, cash quality. The model only reads words. The hero is **promised vs delivered** from the last four earnings calls, with verbatim quotes. Kaynes guided FY26 revenue to ₹4,400 cr, cut it to ₹4,100 cr and delivered ₹3,626 cr; it promised positive operating cash flow and burned ₹600 cr. Persistent said "we don't intend doing any QIP" in August and announced a $450M equity raise in October. Navin Fluorine guided margins to ~30%, then 32–33%, and printed 34%.
- **Network.** Woven through both, and queryable on its own: who to call for a company (former insider, competitor, supplier, customer, or someone who knows the new leadership), routes to a person, coverage against your book ("Thin on consumer lending: 3% of your book, one person to call"; Reliance's energy exposure has nobody), reasons to reconnect with a ready-to-send note, and a constellation map. It also does something a contact list doesn't: it **flags contacts who are current insiders** and steers the suggested question to industry context (SEBI PIT).

## Point of view on the interaction

A **calm morning brief, not a terminal**. The headline sentence tells you how many things matter, then density encodes importance: full cards for the few that matter, one-line rows for the next tier, one collapsed sentence for the rest. Every claim can be traced: "Why FINN ranked this here", the filing PDF, the transcript quote. The Network appears as a single "thread" line on the card where it helps, instead of a separate CRM. Ask is a single box that plans into tools (research, who can help, experts, reach a person, digest) and shows you its plan.

## Key decisions and trade-offs

1. **Numbers by code, words by model.** No LLM ever produces a financial figure. That rules out hallucinated numbers and keeps cost near zero. Trade-off: segment-level and KPI data that lives only in PDFs isn't extracted yet.
2. **Rules before models.** 93% of the 190 filings (177) classify confidently from NSE's own descriptor and subject line. The model only sees the ambiguous rest, and reads PDFs only for material categories.
3. **Smart routing on the free tier.** Gemini Flash-Lite (~500 free requests a day) handles bulk extraction and the map step over transcripts. Gemini Flash (~20 free requests a day) is used once per company per quarter for the promised-vs-delivered synthesis, cached at the CDN. A code pre-filter keeps only forward-looking, quantitative sentences, cutting transcript tokens about 10×. A verifier drops any quote the model returns that isn't in the transcript.
4. **Explainable materiality over a learned ranker.** Base weight by category, modifiers for role seniority, order size, deal type, litigation severity, the price and volume reaction (credited to one filing per move), results surprise, your watched categories, and network relevance. With no labelled data yet, transparent rules beat an opaque model, and they generate training data for one later.
5. **Snapshot plus live.** A versioned JSON snapshot, refreshed daily by a GitHub Action, means the demo never breaks; any other ticker is fetched live. Each pipeline stage is fail-safe and keeps the previous data if a source blocks the runner.
6. **Infer ties, never assert them.** Links come from overlapping employer, team and years after entity resolution, and are labelled ("inferred from overlapping tenure", "dates not public"). Overlap only at a person's brand-new employer is down-weighted.

## Architecture

The diagram is in the README.

- **Data pipelines.** Yahoo (EOD), NSE announcements (cookie session) and filing PDFs (text via unpdf), screener.in (parsed with a DOM-only parser that runs in Node via linkedom), and BSE transcript PDFs. People named in filings become *public* profiles keyed by name slug and linked to the filing. Org names are entity-resolved through a company alias map, which is also how "a name in a filing" meets "a person in your network".
- **Security and privacy (real deployment).** The network is the investor's private data.
  - *Consent:* contacts come only from sources the investor imports themselves (LinkedIn data export, phone contacts, CRM or meeting log), never from scraping. Each contact keeps its import source.
  - *Minimisation:* store only name, employers, years, education and the investor's own notes. Raw imports are deleted after parsing.
  - *Storage:* per-tenant Postgres with row-level security; contact PII encrypted with per-tenant keys (KMS envelope encryption).
  - *No model sees network data:* matching runs in code, and model prompts carry only public documents and the question.
  - *Access and retention:* passkey or SSO sign-in, audit log of network queries, export and delete on request, auto-expiry of stale contacts. This aligns with India's DPDP Act (consent, purpose limitation, data-principal rights).
  - Executive profiles come from mandatory exchange disclosures (SEBI Regulation 30), which are public by law.
- **LLMs and agents.** Gemini via REST, no SDK. The model tier is chosen per step, with a fallback chain across model generations, JSON-mode outputs and an in-memory cache plus CDN caching. The "agent" is deliberately small: a planner that turns a question into tool calls, executed by code. Nothing acts autonomously.
- **Cloud.** Next.js on Vercel (static pages for the snapshot, serverless routes for live research), a GitHub Actions cron for the daily refresh, and no database in the prototype. Running cost: zero on free tiers.

## What I deliberately left out

- Real-time intraday data and push notifications. EOD is what the brief asked for; notifications would be the next step.
- Annual-report reading. Reports run to 300+ pages and need chunked map-reduce; the hooks are there.
- A BSE fallback for filings when NSE blocks cloud IPs.
- Auth and multi-user storage.
- A learned materiality model.
- A LinkedIn importer, because of terms-of-use risk. The prototype documents the export-based path instead.

## Where I'd take it next

1. Feedback loop: thumbs up or down on cards becomes labels for a learned materiality ranker per investor.
2. Read results PDFs directly to get segment and KPI cuts, cross-checked against the standardised table.
3. A "pre-meeting pack": before meeting a promoter, show their career, overlaps, related-party transactions and what they promised last time.
4. Calendar and email integration so "last contact" and "how you know them" maintain themselves.
5. Evaluations: a gold set of filings for the classifier and scorer, and a quote-faithfulness check for promised vs delivered.

## How it was built

Built with Claude as a coding agent; the session is linked above. The build environment was firewalled from market-data sites, so the real data was captured through a browser and turned into the versioned snapshot in `data/raw/` and `data/`. The three seeded promised-vs-delivered analyses were written from verbatim transcript extracts using the same map → reduce method as `lib/deep.ts`. Running `npm run refresh` with a Gemini key regenerates them with the production pipeline.
