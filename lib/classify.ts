import type { Category } from "./types";

/**
 * Rules-first classifier for exchange announcements -> the reference document's categories.
 *
 * Why rules first: NSE already tags every filing with a `desc` (e.g. "Change in Management"), and the
 * subject line is formulaic. ~90% of filings can be classified for free, deterministically and instantly.
 * Only the leftovers (returned with `confident=false`) are sent to the cheap LLM in the pipeline.
 *
 * Adaptation of the reference taxonomy: order wins get their own `order_win` category (instead of
 * living inside `press_release`) because for EPC / EMS names they are a primary signal.
 */
type Rule = [RegExp, Category];

const TEXT_RULES: Rule[] = [
  [/change in (the )?(managing director|chief executive|md|ceo|cfo|chief financial|key managerial|directors?)|appointment of (mr|ms|mrs|dr)|resign|retire|superannuat|assumed (office|charge)/i, "management_change"],
  [/insolvency|nclt|nclat|high court|supreme court|stay order|closure of (manufacturing )?operations|show cause|penalt|regulator|halt .*production|quality lapse|tax demand|notices? received|orders? passed/i, "litigation"],
  [/initial public offer|\bipo\b|qip|qualified institution|rights issue|preferential (issue|allot)|fund ?rais|non[- ]convertible|commercial paper|\bncd/i, "fund_raise"],
  [/trading in equity shares of .* will commence/i, "fund_raise"],
  [/business transfer agreement|share purchase agreement|acquisition|acquire|amalgamation|merger|demerger|slump sale|divest|sale of (entire )?stake|joint venture|wholly owned subsidiary|strike off/i, "m_and_a"],
  [/capacity (addition|expansion|enhancement)|capex|greenfield|brownfield/i, "capex"],
  [/credit rating|rating agency|crisil|icra|care ratings|india ratings/i, "credit_rating"],
  [/pledge|encumbrance/i, "pledging"],
  [/insider trading|reg(ulation)? 7\(2\)|sast/i, "insider_trading"],
  [/bonus|stock split|sub-division/i, "bonus_split"],
  [/interim dividend|final dividend|record date.*dividend|dividend/i, "dividend"],
  [/postal ballot/i, "postal_ballot"],
  [/extraordinary general meeting|annual general meeting|\begm\b|\bagm\b/i, "agm_egm"],
];

const DESC_RULES: Record<string, Category> = {
  "Change in Management": "management_change",
  "Change in Director(s)": "management_change",
  Appointment: "management_change",
  Retirement: "management_change",
  Resignation: "management_change",
  Cessation: "management_change",
  "Change in Auditors": "unclassified", // the reference doc puts auditor appointments in routine paperwork
  Acquisition: "m_and_a",
  "Sale or disposal": "m_and_a",
  "Other Restructuring": "m_and_a",
  "Bagging/Receiving of orders/contracts": "order_win",
  "Capacity addition": "capex",
  "Action(s) taken or orders passed": "litigation",
  "Corporate Insolvency Resolution Process": "litigation",
  "Credit Rating": "credit_rating",
  Dividend: "dividend",
  "Investor Presentation": "results",
  "ESOP/ESOS/ESPS": "unclassified",
  "Certificate under SEBI (Depositories and Participants) Regulations, 2018": "unclassified",
  "Monitoring Agency Report": "unclassified",
  "Statement of deviation(s) or variation(s) under Reg. 32": "unclassified",
};

const RESULTS = /financial results|results (for|presentation)|analyst presentation|investor presentation|quarterly report w\.r\.t\. financial results|shareholders? letter|quickresults/i;
const CALL = /transcript|recording|earnings call|analyst meet held|investor ?s?'? call held|conference call conducted/i;
const MEET = /schedule of (analyst|meet)|investor(s)? (meet|conference|forum)|institutional investors'? meeting|analyst\(s\)\/investor\(s\) meet|outcome of analyst/i;
const ROUTINE = /newspaper|address of (rta|registrar)|iepf|depositor|reg(ulation)? 74|special window|loss of shares|trading window|compliance certificate|redemption of commercial paper|certificate pursuant to sebi circular|statutory auditors?|auditor rotation|half[- ]yearly communication/i;
const LISTING = /initial public offer|\bipo\b|trading in equity shares of .* will commence|first and final call|call money/i;

export function classify(nseDesc: string, text: string): { category: Category; confident: boolean } {
  const t = `${text}`;

  // 1. Exchange descriptor that maps 1:1
  if (DESC_RULES[nseDesc]) {
    let c = DESC_RULES[nseDesc];
    if (nseDesc === "Allotment of Securities" || nseDesc === "ESOP/ESOS/ESPS") c = /non[- ]convertible/i.test(t) ? "fund_raise" : "unclassified";
    return { category: c, confident: true };
  }
  if (nseDesc === "Allotment of Securities") return { category: /non[- ]convertible/i.test(t) ? "fund_raise" : "unclassified", confident: true };

  // 2. Earnings-related descriptors
  if (nseDesc === "Analysts/Institutional Investor Meet/Con. Call Updates") {
    if (/board of directors .* scheduled .* (financial )?results/i.test(t)) return { category: "results", confident: true };
    if (CALL.test(t)) return { category: "earnings_call", confident: true };
    if (MEET.test(t)) return { category: "investor_meetings", confident: true };
    return { category: "investor_meetings", confident: false };
  }
  if (nseDesc === "Outcome of Board Meeting") {
    if (/dividend/i.test(t) && !RESULTS.test(t)) return { category: "dividend", confident: true };
    return { category: "results", confident: RESULTS.test(t) || /outcome of board meeting/i.test(t) };
  }
  if (nseDesc === "Copy of Newspaper Publication") return { category: RESULTS.test(t) ? "results" : "unclassified", confident: true };
  if (nseDesc === "Shareholders meeting") return { category: /postal ballot/i.test(t) ? "postal_ballot" : "agm_egm", confident: true };
  if (nseDesc === "Record Date") return { category: /dividend/i.test(t) ? "dividend" : /bonus|split/i.test(t) ? "bonus_split" : "unclassified", confident: true };
  if (nseDesc === "News Verification" || nseDesc.startsWith("Rumour Verification")) {
    return { category: /halt|order|regulat|quality|ban|raid|penalt/i.test(t) ? "litigation" : "press_release", confident: true };
  }

  // 3. Free-text descriptors ("General Updates", "Updates", "Press Release")
  if (ROUTINE.test(t) && !/financial results for the (period|quarter)/i.test(t)) return { category: "unclassified", confident: true };
  if (LISTING.test(t)) return { category: "fund_raise", confident: true };
  if (RESULTS.test(t)) return { category: "results", confident: true };
  if (CALL.test(t)) return { category: "earnings_call", confident: true };
  if (MEET.test(t)) return { category: "investor_meetings", confident: true };
  for (const [re, c] of TEXT_RULES) if (re.test(t)) return { category: c, confident: true };
  if (ROUTINE.test(t)) return { category: "unclassified", confident: true };
  if (nseDesc === "Press Release") return { category: "press_release", confident: true };

  // Nothing matched: generic "Updates"/"General Updates" with an uninformative subject.
  return { category: /^~?\s*'?(general )?updates'?\.?$/i.test(t.trim()) ? "unclassified" : "press_release", confident: false };
}

export const CATEGORY_LABEL: Record<Category, string> = {
  results: "Results",
  m_and_a: "M&A",
  fund_raise: "Fund raise",
  management_change: "Management",
  litigation: "Legal / regulatory",
  insider_trading: "Insider trade",
  earnings_call: "Earnings call",
  investor_meetings: "Investor meet",
  credit_rating: "Credit rating",
  dividend: "Dividend",
  bonus_split: "Bonus / split",
  capex: "Capex",
  press_release: "Business update",
  postal_ballot: "Postal ballot",
  agm_egm: "AGM / EGM",
  pledging: "Pledging",
  order_win: "Order win",
  unclassified: "Routine",
};

/** "Sep 2026" -> "Q2 FY27" (Indian fiscal year, April–March). */
export function fyQuarter(period: string): string {
  const m = period.match(/(Mar|Jun|Sep|Dec)\w*\s+(\d{4})/i);
  if (!m) return period;
  const mon = m[1].toLowerCase();
  const y = Number(m[2]);
  const q = { jun: 1, sep: 2, dec: 3, mar: 4 }[mon as "jun"]!;
  const fy = mon === "mar" ? y : y + 1;
  return `Q${q} FY${String(fy).slice(2)}`;
}

/** A readable one-line headline when we only have the exchange's subject line. */
/** Quarter most recently reported at time `ts` (results are filed in the month(s) after quarter end). */
export function reportedQuarter(ts: string): string {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  if (m >= 10) return fyQuarter(`Sep ${y}`);
  if (m >= 7) return fyQuarter(`Jun ${y}`);
  if (m >= 4) return fyQuarter(`Mar ${y}`);
  return fyQuarter(`Dec ${y - 1}`);
}

export function headlineFrom(nseDesc: string, text: string, category: Category, ts = new Date().toISOString()): string {
  const Q = reportedQuarter(ts);
  let t = text
    .replace(/^~\s*,?\s*/, "")
    .replace(/^[A-Z][\w&.()' -]*?(Limited|Ltd\.?)\s+has\s+(submitted|informed|filed)( to)?( the)?( with)? exchange\s*(about|regarding|a copy|copy of)?\s*/i, "")
    .replace(/^'|'\.?$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (category === "results") {
    if (/approved the unaudited financial results|financial results for the (period|quarter)|outcome of board meeting held|un-?audited financial results of the company/i.test(t)) return `${Q} results filed`;
    if (/^(investor|analyst) presentation|results presentation/i.test(t.replace(/^general updates-\s*/i, ""))) return "Results presentation";
    if (/newspaper/i.test(t)) return "Results newspaper ad";
    if (/press release|media release/i.test(t)) return "Results press release";
    if (/quarterly report/i.test(t)) return "Quarterly report (results)";
    if (/board of directors .* scheduled/i.test(t)) return `Board meeting scheduled to approve ${Q} results`;
  }
  t = t.replace(/^(a )?press release dated .+?, titled\s*/i, "").replace(/^["“]|["”]\.?$/g, "").replace(/^that /i, "");
  if (category === "postal_ballot") return /notice/i.test(t) ? "Postal ballot notice" : "Postal ballot: voting results";
  if (category === "agm_egm") return /proceedings/i.test(t) ? "EGM proceedings" : "EGM: voting results";
  if (category === "results" && /financial results for the (period|quarter)/i.test(t)) return `${Q} results filed`;
  if (/^Transcript\.?$/i.test(t) || /earnings call transcript/i.test(t)) return "Earnings-call transcript filed";
  if (/^Link of Recording/i.test(t)) return "Earnings-call recording posted";
  if (/^Schedule of meet/i.test(t)) return "Investor meeting scheduled";
  if (t.length < 4 || /^(general )?updates\.?$/i.test(t)) return nseDesc;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 140 ? t.slice(0, 137).replace(/\s+\S*$/, "") + "…" : t;
}
