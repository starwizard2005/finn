/** Fetch a filing / transcript PDF and extract its text (no LLM involved). */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export async function pdfText(url: string, maxPages = 60, timeoutMs = 20000): Promise<string> {
  const referer = url.includes("bseindia") ? "https://www.bseindia.com/" : url.includes("nseindia") ? "https://www.nseindia.com/" : undefined;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/pdf,*/*", ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`PDF ${res.status}: ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(buf);
  const { text } = await extractText(doc, { mergePages: true });
  const t = Array.isArray(text) ? text.join(" ") : text;
  return t.replace(/\s+/g, " ").slice(0, maxPages * 4000);
}

/** Cheap pre-filter: keep only sentences that look forward-looking AND quantitative. Cuts tokens ~10×. */
export function forwardLooking(t: string, max = 60): string[] {
  const fw = /(guid|target|expect|aspir|anticipat|outlook|going forward|we will|we should|should be|would be|next year|FY ?'?\d{2}|by the end|on track|confident|in the range|range of|run.?rate|commit)/i;
  const qn = /(\d+\s?%|crore|cr\b|margin|revenue|EBITDA|working capital|cash flow|receivable|order book|debt|capex|growth|\$ ?\d|million|billion|bps|basis point)/i;
  return t
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .filter((x) => x.length > 40 && x.length < 450 && fw.test(x) && qn.test(x))
    .slice(0, max);
}
