"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Async, Badge, Button, Card, EmptyState, Skeleton, cx, useToast } from "@/components/ui";
import { StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { UserEditSheet } from "@/components/UserEdit";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type D = { user: any; orders: any[]; library: any[]; tickets: any[]; activity: Array<{ at: string; text: string }> };
const TABS = ["Personal Information", "Account Status", "Purchase History", "Orders", "Library", "Support Tickets", "Activity"] as const;

export default function UserProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const s = useApi<D>(`/api/users/${id}`, "We couldn't load this user.");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Personal Information");
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  async function setStatus(st: "ACTIVE" | "SUSPENDED") { try { await api(`/api/users/${id}/status`, { method: "POST", json: { status: st } }); toast(st === "ACTIVE" ? "User activated." : "User suspended."); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); } }
  const empty = (t: string) => <EmptyState icon={<span className="text-2xl">∅</span>} title={t} />;
  return (
    <div>
      <Link href="/users" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Users</Link>
      <Async state={s} skeleton={<Skeleton className="h-96" />}>
        {(d) => { const u = d.user; return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h1 className="text-4xl font-semibold">{u.name}</h1><p className="mt-1 break-all text-muted">{u.email}</p><div className="mt-2 flex gap-2"><StatusBadge status={u.status} />{u.emailVerified ? <Badge tone="success">Email verified</Badge> : <Badge tone="warn">Email unverified</Badge>}</div></div>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>{u.status === "ACTIVE" ? <Button variant="secondary" onClick={() => setStatus("SUSPENDED")}><UserX className="size-4" /> Suspend</Button> : <Button variant="secondary" onClick={() => setStatus("ACTIVE")}><UserCheck className="size-4" /> Activate</Button>}<Button variant="danger" onClick={() => setDel(true)}><Trash2 className="size-4" /> Delete</Button></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", tab === t ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{t}</button>)}</div>
            {tab === "Personal Information" && <Card><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{[["Name", u.name], ["Email", u.email], ["Phone", u.phone ?? "—"], ["Country", u.country], ["Currency", u.currency], ["Registered", dateFmt(u.createdAt, true)]].map(([l, v]) => <div key={l}><dt className="text-sm text-muted">{l}</dt><dd className="break-all font-medium">{v}</dd></div>)}</dl></Card>}
            {tab === "Account Status" && <Card><div className="flex flex-wrap items-center gap-3"><StatusBadge status={u.status} /><span className="text-sm text-muted">{u.status === "SUSPENDED" ? `Suspended on ${dateFmt(u.suspendedAt, true)}. The user cannot sign in.` : "The account is in good standing."}</span></div></Card>}
            {tab === "Purchase History" && (d.library.filter((l) => l.source === "PURCHASE").length ? <ul className="space-y-2">{d.library.filter((l) => l.source === "PURCHASE").map((l) => <li key={l.bookId}><Card className="flex flex-wrap justify-between gap-2 p-4"><span className="font-medium">{l.title}<span className="block text-sm font-normal text-muted">{l.author}</span></span><span className="text-sm text-muted">Purchased {dateFmt(l.addedAt)} · {Math.round(l.percent)}% read</span></Card></li>)}</ul> : empty("No purchases yet"))}
            {tab === "Orders" && (d.orders.length ? <ul className="space-y-2">{d.orders.map((o) => <li key={o.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-4"><span><span className="font-medium">{o.book.title}</span><span className="block font-mono text-xs text-muted">{o.number} · {o.reference}</span></span><span className="flex items-center gap-3"><span className="tabular-nums">{formatMoney(o.amountMinor, o.currency)}</span><StatusBadge status={o.status} /><span className="text-sm text-muted">{dateFmt(o.createdAt)}</span></span></Card></li>)}</ul> : empty("No orders"))}
            {tab === "Library" && (d.library.length ? <ul className="grid gap-2 sm:grid-cols-2">{d.library.map((l) => <li key={l.bookId}><Card className="p-4"><p className="font-medium">{l.title}</p><p className="text-sm text-muted">{l.author} · {l.source === "PURCHASE" ? "Purchased" : "Free"}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-primary" style={{ width: `${l.percent}%` }} /></div><p className="mt-1 text-xs text-muted">{Math.round(l.percent)}% · last opened {dateFmt(l.lastOpenedAt)}</p></Card></li>)}</ul> : empty("The library is empty"))}
            {tab === "Support Tickets" && (d.tickets.length ? <ul className="space-y-2">{d.tickets.map((t) => <li key={t.id}><Link href={`/support/reader/${t.id}`}><Card className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface2"><span className="font-medium">{t.subject}</span><span className="flex items-center gap-3"><StatusBadge status={t.status} /><span className="text-sm text-muted">{dateFmt(t.updatedAt)}</span></span></Card></Link></li>)}</ul> : empty("No support tickets"))}
            {tab === "Activity" && (d.activity.length ? <ol className="space-y-2">{d.activity.map((a, i) => <li key={i} className="flex gap-4 rounded-2xl border border-line bg-surface p-3 text-sm"><span className="w-36 shrink-0 text-muted">{dateFmt(a.at, true)}</span><span>{a.text}</span></li>)}</ol> : empty("No activity"))}
            <UserEditSheet user={edit ? u : null} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); s.reload(); }} />
            <Confirm open={del} danger title="Delete this user?" confirmLabel="Delete user" onClose={() => setDel(false)} body={<>This erases {u.name}'s personal data and library. Order records are kept, anonymised. This can't be undone.</>} onConfirm={async () => { try { await api(`/api/users/${id}`, { method: "DELETE" }); toast("User deleted."); router.push("/users"); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
          </div>); }}
      </Async>
    </div>
  );
}
