"use client";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Async, Card, EmptyState, PageTitle, Skeleton, cx } from "@/components/ui";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type S = { id: string; number: string; book: { id: string; title: string }; buyer: string; currency: string; earnedMinor: number; status: string; paidAt: string };
type D = { sales: S[]; totals: Array<{ currency: string; count: number; earnedMinor: number }> };
const RANGES = [["", "All time"], ["7d", "7 days"], ["30d", "30 days"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"]] as const;

export default function SalesPage() {
  const [range, setRange] = useState("");
  const state = useApi<D>(`/api/sales${range ? `?range=${range}` : ""}`, "We couldn't load your sales. Please try again.");
  return (
    <div>
      <PageTitle title="Sales" sub="Every sale is a verified Reader payment. Amounts shown are your earnings, paid in your own currency." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Time range">
        {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", range === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}
      </div>
      <Async state={state} skeleton={<Skeleton className="h-80" />} isEmpty={(d) => d.sales.length === 0}
        empty={<EmptyState icon={<ShoppingBag className="size-8" />} title="No sales yet" body="When readers buy your approved books, each sale appears here with your earnings." />}>
        {(d) => (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {d.totals.map((t) => <Card key={t.currency} className="p-5"><p className="text-sm text-muted">{t.currency} · {t.count} {t.count === 1 ? "sale" : "sales"}</p><p className="font-serif text-3xl font-semibold tabular-nums">{formatMoney(t.earnedMinor, t.currency)}</p><p className="text-sm text-muted">your earnings</p></Card>)}
            </div>
            <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface2 text-xs uppercase tracking-wider text-muted"><tr>{["Sale ID", "Book", "Buyer", "You earn", "Date", "Status"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">{d.sales.map((s) => (
                  <tr key={s.id}><td className="px-4 py-3 font-mono text-xs">{s.number}</td><td className="max-w-48 truncate px-4 py-3 font-medium">{s.book.title}</td><td className="px-4 py-3">{s.buyer}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(s.earnedMinor, s.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dateFmt(s.paidAt)}</td><td className="px-4 py-3"><StatusBadge status={s.status} /></td></tr>))}</tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">{d.sales.map((s) => (
              <li key={s.id}><Card className="p-4">
                <div className="flex items-start justify-between gap-2"><p className="font-serif text-lg font-semibold leading-snug">{s.book.title}</p><StatusBadge status={s.status} /></div>
                <p className="text-xs text-muted">{s.number} · {dateFmt(s.paidAt)} · {s.buyer}</p>
                <dl className="mt-3 text-sm"><dt className="text-xs text-muted">You earn</dt><dd className="font-semibold tabular-nums">{formatMoney(s.earnedMinor, s.currency)}</dd></dl>
              </Card></li>))}</ul>
          </div>
        )}
      </Async>
    </div>
  );
}
