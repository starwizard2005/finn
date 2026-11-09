// ---------- Market data ----------
export type Table = { periods: string[]; rows: Record<string, (number | null)[]> };

export type Fundamentals = {
  symbol: string;
  name: string;
  source: string;
  fetchedAt: string;
  about: string;
  keyPoints: string;
  ratios: Record<string, number | null>;
  growth: Record<string, Record<string, number | null>>;
  quarters: Table | null;
  annual: Table | null;
  balance: Table | null;
  cashflow: Table | null;
  efficiency: Table | null;
  concalls: { period: string; transcript: string | null; ppt: string | null }[];
  annualReports: { year: number; url: string }[];
  isBank: boolean;
};

export type PriceSeries = { symbol: string; dates: string[]; close: number[]; volume: number[] };

// ---------- Push ----------
export type Category =
  | "results"
  | "m_and_a"
  | "fund_raise"
  | "management_change"
  | "litigation"
  | "insider_trading"
  | "earnings_call"
  | "investor_meetings"
  | "credit_rating"
  | "dividend"
  | "bonus_split"
  | "capex"
  | "press_release"
  | "postal_ballot"
  | "agm_egm"
  | "pledging"
  | "order_win"
  | "unclassified";

export type Tier = "critical" | "notable" | "routine";

export type PersonMention = {
  name: string;
  role?: string;
  change: "appointed" | "ceased";
  profileId?: string; // id into network public profiles
};

export type Announcement = {
  id: string;
  symbol: string;
  ts: string; // ISO with +05:30
  nseDesc: string;
  text: string;
  file: string | null; // full URL to the filing PDF
  category: Category;
  headline: string;
  facts: string[];
  people: PersonMention[];
  extractedFromPdf: boolean;
};

export type ScoredAnnouncement = Announcement & {
  score: number;
  tier: Tier;
  reasons: string[];
  priceReaction?: { pct: number; volX: number; date: string } | null;
};

export type MoveAlert = {
  id: string;
  symbol: string;
  date: string;
  kind: "price" | "volume" | "both";
  pct: number;
  volX: number;
  close: number;
  explanation?: string; // linked announcement headline, if any
  linkedAnnouncementId?: string;
};

export type Thresholds = { pricePct: number; volumeX: number; categories: Category[] };

// ---------- Network ----------
export type Stint = { org: string; role?: string | null; from?: number | null; to?: number | null; team?: string };
export type Edu = { org: string; degree?: string; from?: number | null; to?: number | null };

export type Person = {
  id: string;
  name: string;
  kind: "contact" | "public";
  headline: string;
  location?: string;
  career: Stint[];
  education: Edu[];
  expertise: string[]; // theme tags
  // contact-only
  relation?: {
    how: string; // how the investor knows them
    strength: 1 | 2 | 3; // 3 = close
    lastContact: string; // ISO date
    source: "linkedin_export" | "meeting_log" | "alumni_directory" | "phone_contacts";
    notes?: string;
  };
  knows?: { id: string; context: string; strength: 1 | 2 | 3 }[]; // explicit ties the investor told FINN about
  currentInsiderAt?: string[]; // symbols where this person is a current employee/insider
  source: "synthetic" | "filing" | "public_profile";
  sourceRef?: string;
};

export type Link = {
  kind: "colleague" | "classmate" | "alumni" | "explicit";
  org: string;
  overlap: string; // human text e.g. "2017–2022"
  strength: number; // 0..1
  why: string;
};

export type Path = {
  target: Person;
  via: Person | null; // null => direct contact
  link: Link | null; // link between via (or investor) and target
  score: number;
  label: string;
};

export type Helper = {
  person: Person;
  score: number;
  angle: "insider_former" | "insider_current" | "competitor" | "supplier" | "customer" | "partner" | "sector" | "second_degree";
  why: string;
  ask: string;
  caution?: string;
};

// ---------- Pull ----------
export type Metric = { label: string; value: string; sub?: string; tone?: "good" | "bad" | "neutral" };

export type Evidence = { quote: string; source: string }; // source like "Q4FY26 call (May 2026)"

export type PromiseItem = {
  topic: string;
  promised: string;
  when: string; // when it was said
  delivered: string;
  verdict: "delivered" | "missed" | "partly" | "pending" | "beat";
  evidence: Evidence[];
};

export type DeepAnalysis = {
  symbol: string;
  generatedAt: string;
  generatedBy: string; // model id or "seed"
  sources: { label: string; url: string }[];
  businessSnapshot?: string[];
  guidance: { metric: string; target: string; said: string; status: string }[];
  promises: PromiseItem[];
  narrativeVsNumbers: string[];
  bull: string[];
  bear: string[];
};
