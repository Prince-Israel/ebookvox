"use client";
import { useState } from "react";
import { Banknote } from "lucide-react";
import { Async, Banner, Button, Card, EmptyState, PageTitle, Sheet, Skeleton, Textarea, cx, useToast } from "@/components/ui";
import { StatusBadge, dateFmt } from "@/components/bits";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type W = { id: string; number: string; publisher: { publisherName: string; email: string; country: string }; amountMinor: number; currency: string; method: string; destination: any; status: string; reason: string | null; requestedAt: string; processedAt: string | null };

export default function AdminWithdrawals() {
  const [status, setStatus] = useState("PROCESSING");
  const state = useApi<{ withdrawals: W[] }>(`/api/admin/withdrawals${status ? `?status=${status}` : ""}`, "We couldn't load withdrawals. Please try again.");
  const toast = useToast();
  const [rej, setRej] = useState<W | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function act(w: W, action: "paid" | "reject", ref = reference) {
    setBusy(w.id + action); setErr(null);
    try { await api(`/api/admin/withdrawals/${w.id}`, { method: "POST", json: { action, reason, reference: ref } }); toast(action === "paid" ? "Marked as paid." : "Withdrawal rejected and funds returned."); setRej(null); setReason(""); state.reload(); }
    catch (e) { setErr((e as ApiFailure).message); toast((e as ApiFailure).message, "error"); }
    setBusy(null);
  }
  const dest = (w: W) => w.destination.type === "BANK" ? `${w.destination.bankName} · ${w.destination.accountNumber} · ${w.destination.accountName}` : `PayPal · ${w.destination.paypalEmail}`;
  return (
    <div>
      <PageTitle title="Withdrawals" sub="Pay out to the publisher's bank or PayPal, then mark the request as paid." />
      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist">{[["PROCESSING", "Processing"], ["PAID", "Paid"], ["REJECTED", "Rejected"], ["", "All"]].map(([k, l]) => <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", status === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}</div>
      <Async state={state} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.withdrawals.length === 0} empty={<EmptyState icon={<Banknote className="size-8" />} title="Nothing here" body="Withdrawal requests will appear here." />}>
        {(d) => (
          <ul className="space-y-3">{d.withdrawals.map((w) => (
            <li key={w.id}><Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-serif text-2xl font-semibold tabular-nums">{formatMoney(w.amountMinor, w.currency)}</p><p className="text-sm text-muted">{w.publisher.publisherName} · {w.publisher.email}</p></div><StatusBadge status={w.status} /></div>
              <p className="mt-2 break-words text-sm">{dest(w)}</p><p className="font-mono text-xs text-muted">{w.number} · requested {dateFmt(w.requestedAt, true)}{w.processedAt ? ` · processed ${dateFmt(w.processedAt, true)}` : ""}</p>
              {w.reason && <p className="mt-1 text-sm text-danger">{w.reason}</p>}
              {w.status === "PROCESSING" && <div className="mt-3 flex gap-2"><Button size="sm" loading={busy === w.id + "paid"} onClick={() => { const r = window.prompt("Payout reference (bank transfer or PayPal transaction ID):"); if (r) { setReference(r); void act(w, "paid", r); } }}>Mark as paid</Button><Button size="sm" variant="danger" onClick={() => { setRej(w); setErr(null); }}>Reject</Button></div>}
            </Card></li>))}</ul>
        )}
      </Async>
      <Sheet open={!!rej} onClose={() => setRej(null)} title="Reject withdrawal">
        <p className="mb-3 text-muted">The funds go back to the publisher's wallet and they will see your reason.</p>
        {err && <div className="mb-3"><Banner tone="danger">{err}</Banner></div>}
        <Textarea label="Reason" id="wd-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setRej(null)}>Cancel</Button><Button variant="danger" className="flex-1" loading={!!busy} onClick={() => rej && act(rej, "reject")}>Reject</Button></div>
      </Sheet>
    </div>
  );
}
