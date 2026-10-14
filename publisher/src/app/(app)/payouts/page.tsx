"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { Async, Banner, Button, Card, EmptyState, Input, PageTitle, Select, Skeleton, useToast } from "@/components/ui";
import { StatusBadge, dateFmt } from "@/components/bits";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Wd = { id: string; number: string; amountMinor: number; currency: string; method: string; destination: string; status: string; reason: string | null; requestedAt: string; processedAt: string | null };
type W = { currency: string; available: number; minWithdrawal: number; pending: number };

export default function PayoutsPage() {
  const toast = useToast();
  const list = useApi<{ withdrawals: Wd[] }>("/api/withdrawals", "We couldn't load your payout history. Please try again.");
  const wallet = useApi<{ primaryCurrency: string; wallets: W[] }>("/api/wallet", "We couldn't load your balance.");
  const pm = useApi<{ required: string; method: unknown }>("/api/payment-method", "We couldn't load your payment method.");
  const [currency, setCurrency] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());

  const w = wallet.data && (wallet.data.wallets.find((x) => x.currency === (currency ?? wallet.data!.primaryCurrency)) ?? wallet.data.wallets[0]);
  const processing = list.data?.withdrawals.some((x) => x.status === "PROCESSING");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!w) return;
    setBusy(true);
    setErr(null);
    try {
      await api("/api/withdrawals", { method: "POST", json: { currency: w.currency, amount: Number(amount), idempotencyKey: key.current } });
      toast("Withdrawal requested — status: Processing.");
      key.current = crypto.randomUUID();
      setAmount("");
      list.reload();
      wallet.reload();
    } catch (e2) { setErr((e2 as ApiFailure).message); }
    setBusy(false);
  }

  return (
    <div>
      <PageTitle title="Payouts" sub="Request a withdrawal and follow its status." />
      <div className="mb-8 grid gap-4 lg:grid-cols-[24rem_1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold">Request withdrawal</h2>
          <Async state={wallet} skeleton={<Skeleton className="h-52" />}>
            {(d) => (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {pm.data && !pm.data.method && <Banner tone="warn" action={<Link href="/payment-method" className="underline">Add one</Link>}>You need a payment method first.</Banner>}
                {processing && <Banner tone="warn">You have a withdrawal being processed. You can request another once it's paid or rejected.</Banner>}
                {err && <Banner tone="danger">{err}</Banner>}
                <Select label="Currency" id="wd-currency" value={w?.currency} onChange={(e) => setCurrency(e.target.value)}>{d.wallets.map((x) => <option key={x.currency} value={x.currency}>{x.currency} — {formatMoney(x.available, x.currency)} available</option>)}</Select>
                <Input label={`Amount (${w?.currency})`} id="wd-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" hint={w ? `Minimum ${formatMoney(w.minWithdrawal, w.currency)} · available ${formatMoney(w.available, w.currency)}` : undefined} />
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!amount || !!processing || (pm.data ? !pm.data.method : false)}>Request withdrawal</Button>
              </form>
            )}
          </Async>
        </Card>
        <Card className="hidden content-center lg:grid">
          <p className="font-serif text-2xl font-semibold">How payouts work</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted"><li>Funds move out of your wallet the moment you request.</li><li>Our team processes the payout to your bank or PayPal.</li><li>Status becomes <strong className="text-fg">Paid</strong> — or <strong className="text-fg">Rejected</strong> with a reason, and the funds return to your wallet.</li></ol>
        </Card>
      </div>
      <h2 className="mb-4 text-2xl font-semibold">Payout history</h2>
      <Async state={list} skeleton={<Skeleton className="h-48" />} isEmpty={(d) => d.withdrawals.length === 0}
        empty={<EmptyState icon={<Banknote className="size-8" />} title="No payouts yet" body="Your withdrawal requests and their status will appear here." />}>
        {(d) => (
          <>
            <div className="hidden overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:block">
              <table className="w-full text-left text-sm"><thead className="bg-surface2 text-xs uppercase tracking-wider text-muted"><tr>{["Withdrawal ID", "Amount", "Currency", "Method", "Requested", "Status", "Processed"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">{d.withdrawals.map((x) => <tr key={x.id}><td className="px-4 py-3 font-mono text-xs">{x.number}</td><td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(x.amountMinor, x.currency)}</td><td className="px-4 py-3">{x.currency}</td><td className="px-4 py-3">{x.method === "BANK" ? "Bank transfer" : "PayPal"}<span className="block text-xs text-muted">{x.destination}</span></td><td className="whitespace-nowrap px-4 py-3 text-muted">{dateFmt(x.requestedAt, true)}</td><td className="px-4 py-3"><StatusBadge status={x.status} />{x.reason && <span className="mt-1 block max-w-48 text-xs text-danger">{x.reason}</span>}</td><td className="whitespace-nowrap px-4 py-3 text-muted">{dateFmt(x.processedAt, true)}</td></tr>)}</tbody></table>
            </div>
            <ul className="space-y-3 md:hidden">{d.withdrawals.map((x) => (
              <li key={x.id}><Card className="p-4"><div className="flex items-start justify-between gap-2"><p className="font-serif text-xl font-semibold tabular-nums">{formatMoney(x.amountMinor, x.currency)}</p><StatusBadge status={x.status} /></div>
                <p className="font-mono text-xs text-muted">{x.number}</p><p className="mt-2 text-sm">{x.method === "BANK" ? "Bank transfer" : "PayPal"} · {x.destination}</p><p className="text-xs text-muted">Requested {dateFmt(x.requestedAt, true)}{x.processedAt ? ` · processed ${dateFmt(x.processedAt, true)}` : ""}</p>{x.reason && <p className="mt-1 text-sm text-danger">{x.reason}</p>}</Card></li>))}</ul>
          </>
        )}
      </Async>
    </div>
  );
}
