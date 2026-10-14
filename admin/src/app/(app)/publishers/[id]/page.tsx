"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { Async, Badge, Button, Card, EmptyState, Skeleton, cx, useToast } from "@/components/ui";
import { MoneyList, StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { UserEditSheet } from "@/components/UserEdit";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

const TABS = ["Personal information", "Books", "Sales", "Earnings", "Wallet", "Payouts", "Support tickets"] as const;

export default function PublisherProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const s = useApi<any>(`/api/publishers/${id}`, "We couldn't load Publisher data.");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Personal information");
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  async function setStatus(st: string) { try { await api(`/api/publishers/${id}/status`, { method: "POST", json: { status: st } }); toast(st === "ACTIVE" ? "Publisher activated." : "Publisher suspended."); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); } }
  const none = (t: string) => <EmptyState icon={<span className="text-2xl">∅</span>} title={t} />;
  return (
    <div>
      <Link href="/publishers" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Publishers</Link>
      <Async state={s} skeleton={<Skeleton className="h-96" />}>
        {(d) => { const p = d.publisher; return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><h1 className="text-4xl font-semibold">{p.name}</h1><p className="mt-1 break-all text-muted">{p.email}</p><div className="mt-2 flex gap-2"><StatusBadge status={p.status} /><Badge tone={p.verified ? "success" : "warn"}>{p.verified ? "Verified" : "Unverified"}</Badge></div></div>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button>{p.status === "ACTIVE" ? <Button variant="secondary" onClick={() => setStatus("SUSPENDED")}><UserX className="size-4" /> Suspend</Button> : <Button variant="secondary" onClick={() => setStatus("ACTIVE")}><UserCheck className="size-4" /> Activate</Button>}<Button variant="danger" onClick={() => setDel(true)}><Trash2 className="size-4" /> Delete</Button></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", tab === t ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{t}</button>)}</div>
            {tab === "Personal information" && <Card><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{[["Publisher name", p.name], ["Contact", `${p.firstName} ${p.lastName}`], ["Email", p.email], ["Phone", p.phone], ["Country", `${p.country} (${p.currency})`], ["Registered", dateFmt(p.createdAt, true)], ["Payout method", p.paymentMethod ? (p.paymentMethod.type === "BANK" ? `${p.paymentMethod.bankName} · ${p.paymentMethod.accountNumber} · ${p.paymentMethod.accountName}` : p.paymentMethod.paypalEmail) : "Not set"], ["Biography", p.bio || "—"]].map(([l, v]) => <div key={l}><dt className="text-sm text-muted">{l}</dt><dd className="break-words font-medium">{v}</dd></div>)}</dl></Card>}
            {tab === "Books" && (d.books.length ? <ul className="space-y-2">{d.books.map((b: any) => <li key={b.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-4"><span className="font-medium">{b.title}<span className="block text-sm font-normal text-muted">{b.author} · {b.category}</span></span><StatusBadge status={b.status} /></Card></li>)}</ul> : none("No books yet"))}
            {tab === "Sales" && (d.sales.length ? <ul className="space-y-2">{d.sales.map((x: any) => <li key={x.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-4"><span className="font-medium">{x.book}<span className="block font-mono text-xs font-normal text-muted">{x.number} · {x.buyer} · {dateFmt(x.paidAt)}</span></span><span className="text-right text-sm tabular-nums">{formatMoney(x.grossMinor, x.currency)}<span className="block text-muted">publisher {formatMoney(x.publisherMinor, x.currency)} · platform {formatMoney(x.platformMinor, x.currency)}</span></span></Card></li>)}</ul> : none("No sales yet"))}
            {tab === "Earnings" && <Card><h2 className="mb-3 text-xl font-semibold">Total earnings (85% share)</h2><MoneyList items={d.wallets.filter((w: any) => w.earned > 0).map((w: any) => ({ currency: w.currency, amountMinor: w.earned }))} empty="No earnings yet" /></Card>}
            {tab === "Wallet" && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{d.wallets.filter((w: any) => w.earned > 0 || w.available !== 0 || w.pending > 0).map((w: any) => <Card key={w.currency} className="p-4"><p className="text-sm text-muted">{w.currency}</p><p className="font-serif text-2xl font-semibold tabular-nums">{formatMoney(w.available, w.currency)}</p><p className="text-xs text-muted">earned {formatMoney(w.earned, w.currency)} · withdrawn {formatMoney(w.withdrawn, w.currency)} · pending {formatMoney(w.pending, w.currency)}</p></Card>)}</div>{d.transactions.length ? <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">{d.transactions.map((t: any) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{t.description}<span className="block text-xs text-muted">{dateFmt(t.createdAt, true)}</span></span><b className="tabular-nums">{t.amountMinor > 0 ? "+" : ""}{formatMoney(t.amountMinor, t.currency)}</b></li>)}</ul> : none("No wallet activity")}</div>}
            {tab === "Payouts" && (d.withdrawals.length ? <ul className="space-y-2">{d.withdrawals.map((w: any) => <li key={w.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-4"><span><b className="tabular-nums">{formatMoney(w.amountMinor, w.currency)}</b><span className="block text-sm text-muted">{w.destination} · {w.number}{w.payoutReference ? ` · ref ${w.payoutReference}` : ""}</span></span><span className="flex items-center gap-3"><StatusBadge status={w.status} /><span className="text-sm text-muted">{dateFmt(w.requestedAt)}</span></span></Card></li>)}</ul> : none("No payouts yet"))}
            {tab === "Support tickets" && (d.tickets.length ? <ul className="space-y-2">{d.tickets.map((t: any) => <li key={t.id}><Link href={`/support/publisher/${t.id}`}><Card className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface2"><span className="font-medium">{t.subject}</span><span className="flex items-center gap-3"><StatusBadge status={t.status} /><span className="text-sm text-muted">{dateFmt(t.updatedAt)}</span></span></Card></Link></li>)}</ul> : none("No support tickets"))}
            <UserEditSheet kind="publishers" user={edit ? { ...p, name: p.name } : null} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); s.reload(); }} />
            <Confirm open={del} danger title="Delete this publisher?" confirmLabel="Delete publisher" onClose={() => setDel(false)} body={<>The account and personal data of {p.name} will be erased. Publishers with live books, an open payout or an unpaid balance can't be deleted.</>} onConfirm={async () => { try { await api(`/api/publishers/${id}`, { method: "DELETE" }); toast("Publisher deleted."); router.push("/publishers"); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
          </div>); }}
      </Async>
    </div>
  );
}
