"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Receipt } from "lucide-react";
import { Async, Banner, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

const KIND: Record<string, string> = { PURCHASE: "Book purchase", SALE: "Sale", REFUND: "Refund", PAYOUT: "Payout", FAILED_PAYMENT: "Failed payment" };

function List() {
  const [q, setQ] = useState(useSearchParams().get("q") ?? ""); const [dq, setDq] = useState(q);
  const [type, setType] = useState(""); const [status, setStatus] = useState(""); const [currency, setCurrency] = useState(""); const [pub, setPub] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const pubs = useApi<{ publishers: Array<{ id: string; name: string }> }>("/api/lookup/publishers");
  const s = useApi<{ total: number; transactions: any[]; unavailable: string[] }>(`/api/transactions?${new URLSearchParams({ ...(dq && { q: dq }), ...(type && { type }), ...(status && { status }), ...(currency && { currency }), ...(pub && { publisherId: pub }), ...(from && { from: new Date(from).toISOString() }), ...(to && { to: new Date(to + "T23:59:59").toISOString() }), page: String(page) })}`, "We couldn't load transactions.");
  const set = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { fn(e.target.value); setPage(1); };
  return (
    <div>
      <PageTitle title="Transactions" sub="Purchases, publisher sales, payouts and failed payments in one ledger." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID, user, book" aria-label="Search transactions" className={`${filterInput} w-full sm:w-64`} />
        <select value={type} onChange={set(setType)} aria-label="Type" className={filterInput}><option value="">All types</option><option value="PURCHASE">Book purchase</option><option value="SALE">Sale</option><option value="REFUND">Refund</option><option value="PAYOUT">Payout</option><option value="FAILED">Failed payment</option></select>
        <select value={status} onChange={set(setStatus)} aria-label="Status" className={filterInput}><option value="">All statuses</option>{["PAID", "PENDING", "FAILED", "PROCESSING", "REJECTED"].map((x) => <option key={x} value={x}>{x.charAt(0) + x.slice(1).toLowerCase()}</option>)}</select>
        <select value={currency} onChange={set(setCurrency)} aria-label="Currency" className={filterInput}><option value="">All currencies</option>{["NGN", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
        <select value={pub} onChange={set(setPub)} aria-label="Publisher" className={filterInput}><option value="">All publishers</option>{pubs.data?.publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-muted">From <input type="date" value={from} onChange={set(setFrom)} aria-label="From date" className={filterInput} /></label>
        <label className="flex items-center gap-2 text-sm text-muted">To <input type="date" value={to} onChange={set(setTo)} aria-label="To date" className={filterInput} /></label>
      </FilterBar>
      {s.data?.unavailable.length ? <div className="mb-4"><Banner tone="warn">{s.data.unavailable.join(" and ")} data is unavailable right now, so this list is incomplete. <button className="underline" onClick={s.reload}>Retry</button></Banner></div> : null}
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.transactions.length === 0 && d.unavailable.length === 0} empty={<EmptyState icon={<Receipt className="size-8" />} title={dq || type || status || currency || pub || from || to ? "No transactions match" : "No transactions yet."} body={type === "REFUND" ? "No refunds have been issued." : undefined} />}>
        {(d) => (<><DataTable rows={d.transactions} rowKey={(r) => r.kind + r.id} cols={[
          { key: "i", header: "Transaction ID", primary: true, cell: (r) => <span className="font-mono text-xs font-semibold">{r.id}</span> }, { key: "t", header: "Type", cell: (r) => KIND[r.kind] },
          { key: "u", header: "User", cell: (r) => r.user }, { key: "b", header: "Book", cell: (r) => r.book ?? "—" }, { key: "p", header: "Publisher", cell: (r) => r.publisher },
          { key: "a", header: "Amount", cell: (r) => <span className="tabular-nums">{formatMoney(r.amountMinor, r.currency)}{r.grossMinor ? <span className="block text-xs text-muted">gross {formatMoney(r.grossMinor, r.currency)}</span> : null}</span> },
          { key: "c", header: "Currency", cell: (r) => r.currency }, { key: "pr", header: "Provider", cell: (r) => r.provider }, { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "d", header: "Date", cell: (r) => dateFmt(r.date, true) },
        ]} /><Pager page={page} total={d.total} size={25} onPage={setPage} /></>)}
      </Async>
    </div>
  );
}
export default function TransactionsPage() { return <Suspense><List /></Suspense>; }
