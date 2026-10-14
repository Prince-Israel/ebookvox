"use client";
import { useEffect, useState } from "react";
import { Banknote, Check, X } from "lucide-react";
import { Async, Banner, Button, EmptyState, Input, PageTitle, Sheet, Skeleton, cx, useToast } from "@/components/ui";
import { DataTable, Pager, filterInput } from "@/components/table";
import { StatusBadge, dateFmt } from "@/components/bits";
import { Confirm } from "@/components/Confirm";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

const TABS = [["", "All"], ["PENDING", "Pending"], ["PROCESSING", "Processing"], ["PAID", "Paid"], ["REJECTED", "Rejected"]] as const;
const destOk = (w: any) => w.destination.type === "BANK" ? /^\d{10}$/.test(w.destination.accountNumber ?? "") && !!w.destination.bankName && (w.destination.accountName ?? "").length >= 3 : /\S+@\S+\.\S+/.test(w.destination.paypalEmail ?? "");

export default function PayoutsPage() {
  const toast = useToast();
  const [status, setStatus] = useState("PROCESSING"); const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; withdrawals: any[] }>(`/api/payouts?${new URLSearchParams({ ...(status && { status }), ...(dq && { q: dq }), page: String(page) })}`, "We couldn't load payouts.");
  const [pay, setPay] = useState<any>(null); const [ref, setRef] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [rej, setRej] = useState<any>(null);
  async function markPaid(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api(`/api/payouts/${pay.id}/process`, { method: "POST", json: { action: "paid", reference: ref } }); toast("Payout marked as Paid. The publisher has been notified."); setPay(null); setRef(""); s.reload(); }
    catch (x) { setErr((x as ApiFailure).message); }
    setBusy(false);
  }
  const destText = (w: any) => w.destination.type === "BANK" ? `${w.destination.bankName ?? "—"} · ${w.destination.accountNumber ?? "—"} · ${w.destination.accountName ?? "—"}` : w.destination.paypalEmail ?? "—";
  return (
    <div>
      <PageTitle title="Publisher payouts" sub="Withdrawal requests. Pay the publisher, record the reference, then mark the payout Paid." />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Payout status">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", status === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}</div>
      <div className="mb-5"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search publisher or withdrawal ID" aria-label="Search payouts" className={`${filterInput} w-full sm:w-80`} /></div>
      <Async state={s} skeleton={<Skeleton className="h-80" />} isEmpty={(d) => d.withdrawals.length === 0} empty={<EmptyState icon={<Banknote className="size-8" />} title={status === "PROCESSING" ? "No payouts are waiting to be processed." : "No payouts here."} />}>
        {(d) => (<><DataTable rows={d.withdrawals} rowKey={(r) => r.id} cols={[
          { key: "p", header: "Publisher", primary: true, cell: (r) => <>{r.publisher.name}<span className="block break-all text-xs font-normal text-muted">{r.publisher.email}</span></> },
          { key: "a", header: "Amount", cell: (r) => <b className="tabular-nums">{formatMoney(r.amountMinor, r.currency)}</b> }, { key: "c", header: "Currency", cell: (r) => r.currency },
          { key: "m", header: "Payment method", cell: (r) => r.method === "BANK" ? "Bank transfer" : "PayPal" }, { key: "dest", header: "Destination", cell: (r) => <span className="break-words text-xs">{destText(r)}</span> },
          { key: "rq", header: "Requested", cell: (r) => dateFmt(r.requestedAt, true) }, { key: "s", header: "Status", cell: (r) => <><StatusBadge status={r.status} />{r.reason && <span className="mt-1 block max-w-48 text-xs text-danger">{r.reason}</span>}{r.payoutReference && <span className="mt-1 block text-xs text-muted">Ref {r.payoutReference}</span>}</> },
          { key: "pr", header: "Processed", cell: (r) => dateFmt(r.processedAt, true) },
        ]} actions={(r) => r.status === "PROCESSING" ? (<><Button size="sm" onClick={() => { setPay(r); setRef(""); setErr(null); }}><Check className="size-4" /> Mark Paid</Button><Button size="sm" variant="danger" onClick={() => setRej(r)}><X className="size-4" /> Reject</Button></>) : null} /><Pager page={page} total={d.total} size={25} onPage={setPage} /></>)}
      </Async>
      <Sheet open={!!pay} onClose={() => setPay(null)} title="Mark payout as Paid">
        {pay && <form onSubmit={markPaid} className="space-y-4" noValidate>
          <div className="rounded-2xl bg-surface2 p-4 text-sm"><p className="font-serif text-2xl font-semibold">{formatMoney(pay.amountMinor, pay.currency)}</p><p className="mt-1">{pay.publisher.name}</p><p className="mt-2 text-muted">{pay.method === "BANK" ? "Bank transfer to" : "PayPal to"}</p><p className="break-words font-medium">{destText(pay)}</p></div>
          {!destOk(pay) && <Banner tone="danger">The payment destination is incomplete or invalid, so this payout can't be marked Paid.</Banner>}
          {err && <Banner tone="danger">{err}</Banner>}
          <Input label="Payout reference" id="payout-ref" value={ref} onChange={(e) => setRef(e.target.value)} hint="Bank transfer reference or PayPal transaction ID — required." />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!destOk(pay) || ref.trim().length < 4}>Confirm payout is Paid</Button>
        </form>}
      </Sheet>
      <Confirm open={!!rej} danger title="Reject this payout?" confirmLabel="Reject payout" onClose={() => setRej(null)} input={{ label: "Reason (shown to the publisher)", min: 5 }} body={<>The funds return to {rej?.publisher.name}'s wallet.</>}
        onConfirm={async (reason) => { try { await api(`/api/payouts/${rej.id}/process`, { method: "POST", json: { action: "reject", reason } }); toast("Payout rejected. Funds returned to the wallet."); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}
