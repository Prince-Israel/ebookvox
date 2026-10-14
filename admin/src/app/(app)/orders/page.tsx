"use client";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Async, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

export default function OrdersPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState(""); const [currency, setCurrency] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; orders: any[] }>(`/api/orders?${new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), ...(currency && { currency }), page: String(page) })}`, "We couldn't load orders.");
  return (
    <div>
      <PageTitle title="Orders" sub="Book purchases made by readers." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, reference, buyer or book" aria-label="Search orders" className={`${filterInput} w-full sm:w-80`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={filterInput}><option value="">All statuses</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option></select>
        <select value={currency} onChange={(e) => { setCurrency(e.target.value); setPage(1); }} aria-label="Currency" className={filterInput}><option value="">All currencies</option>{["NGN", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.orders.length === 0} empty={<EmptyState icon={<ShoppingBag className="size-8" />} title={dq || status || currency ? "No orders match" : "No orders have been placed yet."} />}>
        {(d) => (<><DataTable rows={d.orders} rowKey={(r) => r.id} cols={[
          { key: "n", header: "Order", primary: true, cell: (r) => <span className="font-mono text-xs font-semibold">{r.number}</span> }, { key: "u", header: "Buyer", cell: (r) => <>{r.user.name}<span className="block break-all text-xs text-muted">{r.user.email}</span></> },
          { key: "b", header: "Book", cell: (r) => r.book.title }, { key: "pu", header: "Publisher", cell: (r) => r.book.publisher },
          { key: "a", header: "Amount", cell: (r) => <span className="tabular-nums">{formatMoney(r.amountMinor, r.currency)}</span> }, { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "r", header: "Reference", cell: (r) => <span className="break-all font-mono text-xs">{r.reference}</span> }, { key: "d", header: "Date", cell: (r) => dateFmt(r.paidAt ?? r.createdAt, true) },
        ]} /><Pager page={page} total={d.total} size={25} onPage={setPage} /></>)}
      </Async>
    </div>
  );
}
