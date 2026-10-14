"use client";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Async, Card, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

export default function SalesPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [currency, setCurrency] = useState(""); const [pub, setPub] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const pubs = useApi<{ publishers: Array<{ id: string; name: string }> }>("/api/lookup/publishers");
  const com = useApi<{ totals: Array<{ currency: string; count: number; feeMinor: number; grossMinor: number }>; recent: any[] }>("/api/commissions");
  const s = useApi<{ total: number; sales: any[]; totals: any[] }>(`/api/sales?${new URLSearchParams({ ...(dq && { q: dq }), ...(currency && { currency }), ...(pub && { publisherId: pub }), page: String(page) })}`, "We couldn't load Publisher sales.");
  return (
    <div>
      <PageTitle title="Publisher sales" sub="Every sale comes from a verified payment. Publisher share 85% · Platform share 15%." />
      {com.data && com.data.totals.length > 0 && (
        <section aria-label="Platform commission" className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Platform commission received (15%)</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{com.data.totals.map((t) => <Card key={t.currency} className="p-4"><p className="text-sm text-muted">{t.currency} · {t.count} {t.count === 1 ? "purchase" : "purchases"}</p><p className="font-serif text-2xl font-semibold tabular-nums">{formatMoney(t.feeMinor, t.currency)}</p><p className="text-xs text-muted">of {formatMoney(t.grossMinor, t.currency)} paid by readers</p></Card>)}</div>
        </section>
      )}
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sale, book, publisher" aria-label="Search sales" className={`${filterInput} w-full sm:w-72`} />
        <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }} aria-label="Currency" className={filterInput}><option value="">All currencies</option>{["NGN", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
        <select value={pub} onChange={(e) => { setPub(e.target.value); setPage(1); }} aria-label="Publisher" className={filterInput}><option value="">All publishers</option>{pubs.data?.publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.sales.length === 0} empty={<EmptyState icon={<TrendingUp className="size-8" />} title={dq || currency || pub ? "No sales match" : "No publisher sales yet."} />}>
        {(d) => (<>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{d.totals.map((t) => <Card key={t.currency} className="p-4"><p className="text-sm text-muted">{t.currency} · {t.count} sales</p><p className="font-serif text-2xl font-semibold tabular-nums">{formatMoney(t.grossMinor, t.currency)}</p><p className="text-xs text-muted">publisher {formatMoney(t.publisherMinor, t.currency)} · platform {formatMoney(t.platformMinor, t.currency)}</p></Card>)}</div>
          <DataTable rows={d.sales} rowKey={(r) => r.id} cols={[
            { key: "i", header: "Sale ID", primary: true, cell: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> }, { key: "b", header: "Book", cell: (r) => r.book.title }, { key: "p", header: "Publisher", cell: (r) => r.publisher.name }, { key: "by", header: "Buyer", cell: (r) => r.buyer },
            { key: "g", header: "Gross", cell: (r) => <span className="tabular-nums">{formatMoney(r.grossMinor, r.currency)}</span> }, { key: "ps", header: "Publisher share (85%)", cell: (r) => <b className="tabular-nums">{formatMoney(r.publisherMinor, r.currency)}</b> }, { key: "pl", header: "Platform share (15%)", cell: (r) => <span className="tabular-nums">{formatMoney(r.platformMinor, r.currency)}</span> },
            { key: "c", header: "Currency", cell: (r) => r.currency }, { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "d", header: "Date", cell: (r) => dateFmt(r.paidAt, true) },
          ]} />
          <Pager page={page} total={d.total} size={25} onPage={setPage} />
        </>)}
      </Async>
    </div>
  );
}
