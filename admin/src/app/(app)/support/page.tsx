"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Async, Badge, Banner, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";

export default function SupportPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [svc, setSvc] = useState("all"); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; tickets: any[]; unavailable: string[] }>(`/api/support?${new URLSearchParams({ service: svc, ...(status && { status }), ...(dq && { q: dq }), page: String(page) })}`, "We couldn't load support tickets.");
  return (
    <div>
      <PageTitle title="Support" sub="Reader and Publisher tickets in one inbox." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject or email" aria-label="Search tickets" className={`${filterInput} w-full sm:w-72`} />
        <select value={svc} onChange={(e) => { setSvc(e.target.value); setPage(1); }} aria-label="User type" className={filterInput}><option value="all">Readers & publishers</option><option value="reader">Readers</option><option value="publisher">Publishers</option></select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={filterInput}><option value="">All statuses</option><option value="OPEN">Open</option><option value="WAITING_USER">Waiting for User</option><option value="WAITING_PUBLISHER">Waiting for Publisher</option><option value="CLOSED">Closed</option></select>
      </FilterBar>
      {s.data?.unavailable.length ? <div className="mb-4"><Banner tone="warn">{s.data.unavailable.join(" and ")} tickets can't be loaded right now — this inbox is incomplete. <button className="underline" onClick={s.reload}>Retry</button></Banner></div> : null}
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.tickets.length === 0 && d.unavailable.length === 0} empty={<EmptyState icon={<LifeBuoy className="size-8" />} title={dq || status || svc !== "all" ? "No tickets match" : "No support tickets yet."} />}>
        {(d) => (<><DataTable rows={d.tickets} rowKey={(r) => r.service + r.id} cols={[
          { key: "n", header: "Name", primary: true, cell: (r) => <Link href={`/support/${r.service}/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
          { key: "e", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> }, { key: "t", header: "User type", cell: (r) => <Badge tone={r.service === "publisher" ? "accent" : "neutral"}>{r.userType}</Badge> },
          { key: "s", header: "Subject", cell: (r) => <Link href={`/support/${r.service}/${r.id}`} className="hover:underline">{r.subject}</Link> }, { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "m", header: "Last message", cell: (r) => <span className="line-clamp-2 max-w-64 text-muted">{r.lastFrom === "ADMIN" ? "You: " : ""}{r.lastMessage}</span> }, { key: "u", header: "Updated", cell: (r) => dateFmt(r.updatedAt, true) },
        ]} onRow={(r) => (window.location.href = `/support/${r.service}/${r.id}`)} /><Pager page={page} total={d.total} size={25} onPage={setPage} /></>)}
      </Async>
    </div>
  );
}
