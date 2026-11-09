import { cr } from "@/lib/format";
import type { ResultsCard } from "@/lib/research";
import { Delta, Panel } from "./ui";

export function ResultsTable({ r }: { r: ResultsCard }) {
  return (
    <Panel className="overflow-hidden">
      <table className="num w-full text-[14px]">
        <caption className="sr-only">Headline numbers for {r.quarter}</caption>
        <thead>
          <tr className="text-[12px] text-ink-3">
            <th className="px-4 pb-1.5 pt-3 text-left font-normal">{r.quarter}</th>
            <th className="px-2 pb-1.5 pt-3 text-right font-normal">₹ cr</th>
            <th className="px-2 pb-1.5 pt-3 text-right font-normal">QoQ</th>
            <th className="px-4 pb-1.5 pt-3 text-right font-normal">YoY</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l) => (
            <tr key={l.label} className="border-t border-line">
              <td className="px-4 py-2.5">
                {l.label}
                {l.note && <span className="block text-[11px] leading-tight text-ink-3">{l.note}</span>}
              </td>
              <td className="px-2 py-2.5 text-right">{cr(l.cur).replace("₹", "").replace(" cr", "")}</td>
              <td className="px-2 py-2.5 text-right">
                <Delta v={l.qoq} d={0} />
              </td>
              <td className="px-4 py-2.5 text-right font-semibold">
                <Delta v={l.yoy} d={0} />
              </td>
            </tr>
          ))}
          {r.margin && r.margin.cur != null && (
            <tr className="border-t border-line text-ink-2">
              <td className="px-4 py-2.5">EBITDA margin</td>
              <td className="px-2 py-2.5 text-right">{r.margin.cur}%</td>
              <td className="px-2 py-2.5 text-right">
                <Delta v={r.margin.prev != null ? r.margin.cur - r.margin.prev : null} d={0} suffix=" pt" />
              </td>
              <td className="px-4 py-2.5 text-right">
                <Delta v={r.margin.yoyPrev != null ? r.margin.cur - r.margin.yoyPrev : null} d={0} suffix=" pt" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {r.takeaway && <p className="border-t border-line bg-paper/60 px-4 py-3 text-[14px]">{r.takeaway}</p>}
    </Panel>
  );
}
