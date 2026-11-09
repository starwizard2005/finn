/**
 * The investor's universe: portfolio + ad-hoc research names.
 * Relationship maps (competitors / suppliers / customers / partners) are what let the Network answer
 * "who has worked at a competitor, supplier or customer" — not just "who worked there".
 * Any NSE ticker works for Pull; unknown tickers simply have no relationship map.
 */
export type CompanyMeta = {
  symbol: string;
  short: string;
  name: string;
  sector: string;
  themes: string[]; // matched against people's expertise tags
  aliases: string[]; // used for entity resolution when matching employers
  competitors?: string[]; // org names (not necessarily listed)
  suppliers?: string[];
  customers?: string[];
  partners?: string[];
  portfolio: boolean;
  research?: boolean;
  weight?: number; // % of portfolio (mock)
};

export const COMPANIES: CompanyMeta[] = [
  { symbol: "RELIANCE", short: "Reliance", name: "Reliance Industries", sector: "Conglomerate", themes: ["energy", "telecom", "retail"], aliases: ["Reliance Industries", "Reliance", "RIL", "Jio Platforms", "Reliance Jio", "Jio", "Reliance Retail"], competitors: ["Bharti Airtel"], portfolio: true, weight: 8 },
  { symbol: "HDFCBANK", short: "HDFC Bank", name: "HDFC Bank", sector: "Banks", themes: ["banking", "retail lending", "sme lending"], aliases: ["HDFC Bank", "HDFC Ltd", "Housing Development Finance Corporation"], competitors: ["ICICI Bank", "Kotak Mahindra Bank", "Axis Bank"], portfolio: true, weight: 9 },
  { symbol: "INFY", short: "Infosys", name: "Infosys", sector: "IT Services", themes: ["it services", "banking software"], aliases: ["Infosys", "Infosys Finacle", "Finacle"], competitors: ["TCS", "Wipro", "HCLTech", "Persistent Systems"], portfolio: true, weight: 6 },
  { symbol: "BHARTIARTL", short: "Airtel", name: "Bharti Airtel", sector: "Telecom", themes: ["telecom"], aliases: ["Bharti Airtel", "Airtel", "Airtel Africa"], competitors: ["Reliance Jio", "Vodafone Idea"], portfolio: true, weight: 7 },
  { symbol: "LT", short: "L&T", name: "Larsen & Toubro", sector: "Capital Goods / EPC", themes: ["infrastructure", "epc", "metro rail"], aliases: ["Larsen & Toubro", "L&T", "L&T Construction"], competitors: ["Tata Projects", "Afcons"], portfolio: true, weight: 6 },
  { symbol: "TITAN", short: "Titan", name: "Titan Company", sector: "Consumer Discretionary", themes: ["consumer", "jewellery", "retail"], aliases: ["Titan Company", "Titan", "Tanishq", "CaratLane"], competitors: ["Kalyan Jewellers", "Malabar Gold"], portfolio: true, weight: 5 },
  { symbol: "SUNPHARMA", short: "Sun Pharma", name: "Sun Pharmaceutical", sector: "Pharma", themes: ["pharma", "us generics", "regulatory"], aliases: ["Sun Pharmaceutical", "Sun Pharma", "Ranbaxy"], competitors: ["Dr. Reddy's", "Cipla", "Lupin"], portfolio: true, weight: 5 },
  { symbol: "MARUTI", short: "Maruti", name: "Maruti Suzuki", sector: "Autos", themes: ["autos", "ev"], aliases: ["Maruti Suzuki", "Maruti", "Suzuki Motor"], competitors: ["Hyundai Motor India", "Tata Motors", "Mahindra & Mahindra"], suppliers: ["Subros", "Bosch"], portfolio: true, weight: 5 },
  { symbol: "BAJFINANCE", short: "Bajaj Fin", name: "Bajaj Finance", sector: "NBFC", themes: ["consumer lending", "retail lending"], aliases: ["Bajaj Finance", "Bajaj Finserv"], competitors: ["HDFC Bank", "Shriram Finance"], portfolio: true, weight: 6 },
  { symbol: "ETERNAL", short: "Eternal", name: "Eternal (Zomato)", sector: "Internet", themes: ["consumer internet", "quick commerce"], aliases: ["Eternal", "Zomato", "Blinkit", "District"], competitors: ["Swiggy", "Zepto"], portfolio: true, weight: 4 },
  { symbol: "TRENT", short: "Trent", name: "Trent", sector: "Retail", themes: ["retail", "apparel"], aliases: ["Trent", "Westside", "Zudio"], competitors: ["Reliance Retail", "Aditya Birla Fashion"], portfolio: true, weight: 4 },
  { symbol: "DIXON", short: "Dixon", name: "Dixon Technologies", sector: "EMS", themes: ["ems", "electronics", "semiconductors"], aliases: ["Dixon Technologies", "Dixon"], competitors: ["Kaynes Technology", "Syrma SGS", "Amber Enterprises"], customers: ["Samsung", "Motorola", "HP", "Asus"], portfolio: true, weight: 5 },
  { symbol: "POLYCAB", short: "Polycab", name: "Polycab India", sector: "Cables & Electricals", themes: ["cables", "electricals"], aliases: ["Polycab India", "Polycab"], competitors: ["KEI Industries", "Havells", "Finolex Cables"], portfolio: true, weight: 4 },
  { symbol: "KAYNES", short: "Kaynes", name: "Kaynes Technology", sector: "EMS", themes: ["ems", "electronics", "semiconductors", "osat"], aliases: ["Kaynes Technology", "Kaynes"], competitors: ["Dixon Technologies", "Syrma SGS", "Cyient DLM"], customers: ["Indian Railways", "Bosch"], portfolio: true, research: true, weight: 3 },
  { symbol: "CGPOWER", short: "CG Power", name: "CG Power & Industrial Solutions", sector: "Capital Goods", themes: ["power equipment", "semiconductors", "osat"], aliases: ["CG Power", "CG Power and Industrial Solutions", "Crompton Greaves", "Axiro Semiconductor"], competitors: ["Siemens", "ABB India", "Hitachi Energy"], partners: ["Renesas"], portfolio: true, weight: 4 },
  { symbol: "DEEPAKNTR", short: "Deepak Nitrite", name: "Deepak Nitrite", sector: "Chemicals", themes: ["specialty chemicals", "phenolics"], aliases: ["Deepak Nitrite", "Deepak Phenolics"], competitors: ["Aarti Industries", "SRF"], portfolio: true, weight: 3 },
  { symbol: "NAVINFLUOR", short: "Navin Fluorine", name: "Navin Fluorine International", sector: "Chemicals", themes: ["specialty chemicals", "fluorochemicals", "cdmo"], aliases: ["Navin Fluorine", "Navin Fluorine International", "NFIL"], competitors: ["SRF", "Gujarat Fluorochemicals"], partners: ["Chemours", "Honeywell"], portfolio: true, research: true, weight: 3 },
  { symbol: "CREDITACC", short: "CreditAccess", name: "CreditAccess Grameen", sector: "Microfinance", themes: ["rural lending", "microfinance"], aliases: ["CreditAccess Grameen", "CreditAccess", "Grameen Koota"], competitors: ["Bandhan Bank", "Ujjivan Small Finance Bank", "Spandana Sphoorty"], portfolio: true, weight: 3 },
  // Ad-hoc research, outside the portfolio
  { symbol: "PERSISTENT", short: "Persistent", name: "Persistent Systems", sector: "IT Services", themes: ["it services", "digital engineering"], aliases: ["Persistent Systems", "Persistent"], competitors: ["Coforge", "LTIMindtree", "Infosys", "Nagarro"], partners: ["Salesforce", "AWS"], portfolio: false, research: true },
];

export const BY_SYMBOL = Object.fromEntries(COMPANIES.map((c) => [c.symbol, c]));
export const PORTFOLIO = COMPANIES.filter((c) => c.portfolio);
export const RESEARCH = COMPANIES.filter((c) => c.research);

export function metaFor(symbol: string): CompanyMeta {
  return (
    BY_SYMBOL[symbol] ?? {
      symbol,
      short: symbol,
      name: symbol,
      sector: "—",
      themes: [],
      aliases: [symbol],
      portfolio: false,
    }
  );
}

/** Normalise an organisation name for entity resolution ("ICICI Securities Ltd." -> "icici securities"). */
export function normOrg(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .replace(/\b(limited|ltd|pvt|private|inc|corp|corporation|company|co|india|the|international|industries|technologies|systems)\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Which listed company (if any) does an org string refer to? */
export function resolveOrg(org: string): string | null {
  const n = normOrg(org);
  for (const c of COMPANIES) {
    for (const a of c.aliases) {
      const na = normOrg(a);
      if (na && (n === na || n.startsWith(na + " ") || (na.length > 4 && n.includes(na)))) return c.symbol;
    }
  }
  return null;
}
