"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2, UserCheck, UserRound, UserX } from "lucide-react";
import { Async, Badge, Button, EmptyState, PageTitle, Skeleton, useToast } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { MoneyList, StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { UserEditSheet } from "@/components/UserEdit";
import { api, ApiFailure, useApi } from "@/lib/client";

type P = { id: string; name: string; firstName: string; lastName: string; email: string; phone: string; country: string; status: string; verified: boolean; bio: string; createdAt: string; wallet: Array<{ currency: string; availableMinor: number; earnedMinor: number }> };

export default function PublishersPage() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; publishers: P[] }>(`/api/publishers?${new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), page: String(page) })}`, "We couldn't load publishers.");
  const [edit, setEdit] = useState<P | null>(null);
  const [del, setDel] = useState<P | null>(null);
  async function setStatusFor(p: P, st: "ACTIVE" | "SUSPENDED") { try { await api(`/api/publishers/${p.id}/status`, { method: "POST", json: { status: st } }); toast(st === "SUSPENDED" ? `${p.name} was suspended.` : `${p.name} was activated.`); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); } }
  return (
    <div>
      <PageTitle title="Publishers" sub="Publishers registered on the Publisher platform." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" aria-label="Search publishers" className={`${filterInput} w-full sm:w-80`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={filterInput}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.publishers.length === 0} empty={<EmptyState icon={<UserRound className="size-8" />} title={dq || status ? "No publishers match" : "No publishers have registered yet."} />}>
        {(d) => (<>
          <DataTable rows={d.publishers} rowKey={(r) => r.id} cols={[
            { key: "n", header: "Name", primary: true, cell: (r) => <Link href={`/publishers/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
            { key: "e", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> }, { key: "p", header: "Phone", cell: (r) => r.phone }, { key: "c", header: "Country", cell: (r) => r.country },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "v", header: "Verification", cell: (r) => <Badge tone={r.verified ? "success" : "warn"}>{r.verified ? "Verified" : "Unverified"}</Badge> },
            { key: "w", header: "Wallet balance", cell: (r) => <MoneyList items={r.wallet.map((w) => ({ currency: w.currency, amountMinor: w.availableMinor }))} empty="No balance" /> },
            { key: "t", header: "Total earnings", cell: (r) => <MoneyList items={r.wallet.map((w) => ({ currency: w.currency, amountMinor: w.earnedMinor }))} empty="No earnings" /> }, { key: "d", header: "Registered", cell: (r) => dateFmt(r.createdAt) },
          ]} actions={(r) => (<>
            <Link href={`/publishers/${r.id}`}><Button size="sm" variant="secondary"><Eye className="size-4" /> View</Button></Link>
            <Button size="sm" variant="secondary" onClick={() => setEdit(r)}><Pencil className="size-4" /> Edit</Button>
            {r.status === "ACTIVE" ? <Button size="sm" variant="secondary" onClick={() => setStatusFor(r, "SUSPENDED")}><UserX className="size-4" /> Suspend</Button> : <Button size="sm" variant="secondary" onClick={() => setStatusFor(r, "ACTIVE")}><UserCheck className="size-4" /> Activate</Button>}
            <Button size="sm" variant="danger" onClick={() => setDel(r)}><Trash2 className="size-4" /> Delete</Button>
          </>)} />
          <Pager page={page} total={d.total} size={25} onPage={setPage} />
        </>)}
      </Async>
      <UserEditSheet kind="publishers" user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />
      <Confirm open={!!del} danger title="Delete this publisher?" confirmLabel="Delete publisher" onClose={() => setDel(null)} body={<>{del?.name}'s account and personal data will be erased. Publishers with live books, an open payout or an unpaid balance can't be deleted — suspend them instead.</>} onConfirm={async () => { try { await api(`/api/publishers/${del!.id}`, { method: "DELETE" }); toast("Publisher deleted."); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}
