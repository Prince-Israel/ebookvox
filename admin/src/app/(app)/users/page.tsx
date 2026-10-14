"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Skeleton, useToast } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { UserEditSheet } from "@/components/UserEdit";
import { api, ApiFailure, useApi } from "@/lib/client";

export type U = { id: string; name: string; firstName: string; lastName: string; email: string; phone: string | null; country: string; status: string; createdAt: string; orders: number; purchasedBooks: number };

export default function UsersPage() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; users: U[] }>(`/api/users?${new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), page: String(page) })}`, "We couldn't load users.");
  const [edit, setEdit] = useState<U | null>(null);
  const [del, setDel] = useState<U | null>(null);
  async function setStatusFor(u: U, st: "ACTIVE" | "SUSPENDED") {
    try { await api(`/api/users/${u.id}/status`, { method: "POST", json: { status: st } }); toast(st === "SUSPENDED" ? `${u.name} was suspended.` : `${u.name} was activated.`); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); }
  }
  return (
    <div>
      <PageTitle title="Users" sub="Readers registered on the Reader platform." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" aria-label="Search users" className={`${filterInput} w-full sm:w-80`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={filterInput}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(d) => d.users.length === 0} empty={<EmptyState icon={<Users className="size-8" />} title={dq || status ? "No users match" : "No users have registered yet."} body={dq || status ? "Try a different search or filter." : undefined} />}>
        {(d) => (<>
          <DataTable rows={d.users} rowKey={(r) => r.id} cols={[
            { key: "n", header: "Name", primary: true, cell: (r) => <Link href={`/users/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
            { key: "e", header: "Email", cell: (r) => <span className="break-all">{r.email}</span> }, { key: "p", header: "Phone", cell: (r) => r.phone ?? "—" }, { key: "c", header: "Country", cell: (r) => r.country },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "d", header: "Registered", cell: (r) => dateFmt(r.createdAt) },
            { key: "o", header: "Orders", cell: (r) => r.orders, className: "tabular-nums" }, { key: "b", header: "Purchased books", cell: (r) => r.purchasedBooks, className: "tabular-nums" },
          ]} actions={(r) => (<>
            <Link href={`/users/${r.id}`}><Button size="sm" variant="secondary"><Eye className="size-4" /> View</Button></Link>
            <Button size="sm" variant="secondary" onClick={() => setEdit(r)}><Pencil className="size-4" /> Edit</Button>
            {r.status === "ACTIVE" ? <Button size="sm" variant="secondary" onClick={() => setStatusFor(r, "SUSPENDED")}><UserX className="size-4" /> Suspend</Button> : <Button size="sm" variant="secondary" onClick={() => setStatusFor(r, "ACTIVE")}><UserCheck className="size-4" /> Activate</Button>}
            <Button size="sm" variant="danger" onClick={() => setDel(r)}><Trash2 className="size-4" /> Delete</Button>
          </>)} />
          <Pager page={page} total={d.total} size={25} onPage={setPage} />
        </>)}
      </Async>
      <UserEditSheet user={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />
      <Confirm open={!!del} danger title="Delete this user?" confirmLabel="Delete user" onClose={() => setDel(null)}
        body={<>This erases {del?.name}'s personal data and library and signs them out. Their order records are kept, anonymised, for financial reporting. This can't be undone.</>}
        onConfirm={async () => { try { await api(`/api/users/${del!.id}`, { method: "DELETE" }); toast("User deleted."); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}
