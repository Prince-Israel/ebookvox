"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Async, Banner, Button, Card, EmptyState, Input, PageTitle, Skeleton, cx, useToast, when } from "@/components/ui";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type D = { currency: string; balances: Array<{ currency: string; amountMinor: number }>; transactions: Array<{ id: string; type: string; currency: string; amountMinor: number; description: string; createdAt: string }> };
// quick amounts in the currency of where the reader is now (major units)
const PRESETS: Record<string, number[]> = { NGN: [1000, 2000, 5000, 10000], USD: [2, 5, 10, 20], GBP: [2, 5, 10, 20], EUR: [2, 5, 10, 20] };

export default function WalletPage() {
  const state = useApi<D>("/api/wallet", "We couldn't load your wallet. Please try again.");
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function topUp(d: D) {
    setErr(null);
    const minor = Math.round(Number(amount) * 100);
    if (!minor) return setErr("Enter how much to add.");
    setBusy(true);
    try {
      const r = await api<{ authorizationUrl: string }>("/api/wallet/topup", { method: "POST", json: { amountMinor: minor } });
      window.location.href = r.authorizationUrl;
    } catch (e) {
      setErr((e as ApiFailure).fields?.amount ?? (e as ApiFailure).message);
      toast((e as ApiFailure).message, "error");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Wallet" sub="Add funds once, then pay for your subscription in one tap." />
      <Async state={state} skeleton={<div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-56" /></div>}>
        {(d) => {
          const here = d.balances.find((b) => b.currency === d.currency)?.amountMinor ?? 0;
          const others = d.balances.filter((b) => b.currency !== d.currency);
          return (
            <div className="space-y-6">
              <Card className="bg-[#3a261c] text-[#fbf1e4]">
                <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-white/15"><Wallet className="size-6" /></div>
                  <div><p className="text-sm opacity-80">Balance ({d.currency})</p><p className="font-serif text-4xl font-semibold tabular-nums">{formatMoney(here, d.currency)}</p></div></div>
                {others.length > 0 && <p className="mt-3 text-xs opacity-80">Also holding: {others.map((b) => formatMoney(b.amountMinor, b.currency)).join(" · ")} (from other countries — spendable when you're back there)</p>}
              </Card>

              <Card>
                <h2 className="mb-3 text-xl font-semibold">Add funds</h2>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(PRESETS[d.currency] ?? PRESETS.USD).map((p) => (
                    <button key={p} onClick={() => setAmount(String(p))} className={cx("h-11 rounded-full px-4 text-sm font-semibold tabular-nums", Number(amount) === p ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{formatMoney(p * 100, d.currency)}</button>
                  ))}
                </div>
                <Input label={`Amount (${d.currency})`} id="topup-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} error={err ?? undefined} placeholder="0.00" />
                <Button size="lg" className="mt-4 w-full" loading={busy} disabled={!amount} onClick={() => topUp(d)}>Pay {amount ? formatMoney(Math.round(Number(amount) * 100), d.currency) : ""} by card</Button>
                <p className="mt-2 text-xs text-muted">Funds are added in {d.currency} (the currency of where you are now) after Paystack confirms the payment. Wallet money can pay for your ad-free subscription.</p>
              </Card>

              <Banner tone="info" action={<Link href="/subscribe"><Button size="sm" variant="secondary">Go ad-free</Button></Link>}>Switch the ads off for $2 a month ($1.80 on the yearly plan).</Banner>

              <section aria-labelledby="wtx">
                <h2 id="wtx" className="mb-3 text-sm font-bold uppercase tracking-[0.2em]">History</h2>
                {d.transactions.length === 0 ? <EmptyState icon={<Wallet className="size-8" />} title="No wallet activity yet" body="Top-ups and subscription payments show up here." /> : (
                  <ul className="space-y-2">{d.transactions.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                      <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", t.amountMinor >= 0 ? "bg-success-soft text-success" : "bg-surface2 text-muted")}>{t.amountMinor >= 0 ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
                      <span className="min-w-0 flex-1"><b className="block truncate">{t.description}</b><span className="text-xs text-muted">{when(t.createdAt)}</span></span>
                      <span className={cx("shrink-0 font-semibold tabular-nums", t.amountMinor >= 0 ? "text-success" : "")}>{t.amountMinor >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amountMinor), t.currency)}</span>
                    </li>
                  ))}</ul>
                )}
              </section>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
