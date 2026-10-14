"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Async, Button, Card, EmptyState, PageTitle, Skeleton, cx } from "@/components/ui";
import { dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type W = { currency: string; available: number; earned: number; withdrawn: number; pending: number; minWithdrawal: number };
type Tx = { id: string; type: string; currency: string; amountMinor: number; description: string; createdAt: string };
const TYPE: Record<string, string> = { SALE_CREDIT: "Sale credit", WITHDRAWAL_HOLD: "Withdrawal requested", WITHDRAWAL_REFUND: "Withdrawal refunded", PAYOUT_COMPLETED: "Payout completed" };

export default function WalletPage() {
  const state = useApi<{ primaryCurrency: string; wallets: W[]; transactions: Tx[] }>("/api/wallet", "We couldn't load your wallet. Please try again.");
  const [cur, setCur] = useState<string | null>(null);
  return (
    <div>
      <PageTitle title="Wallet" sub="Balances are kept per currency — readers pay in their own." action={<Link href="/payouts"><Button>Withdraw funds</Button></Link>} />
      <Async state={state} skeleton={<div className="space-y-4"><Skeleton className="h-44" /><Skeleton className="h-72" /></div>}>
        {(d) => {
          const active = cur ?? (d.wallets.find((w) => w.currency === d.primaryCurrency) ?? d.wallets[0]).currency;
          const w = d.wallets.find((x) => x.currency === active)!;
          const tx = d.transactions.filter((t) => t.currency === active);
          const visible = d.wallets.filter((x) => x.currency === d.primaryCurrency || x.earned > 0 || x.available !== 0 || x.pending > 0);
          return (
            <div className="space-y-6">
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Wallet currency">
                {visible.map((x) => <button key={x.currency} role="tab" aria-selected={active === x.currency} onClick={() => setCur(x.currency)} className={cx("h-11 shrink-0 rounded-full px-5 text-sm font-semibold", active === x.currency ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{x.currency}</button>)}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <div className="col-span-2 rounded-3xl bg-primary p-6 text-primary-fg shadow-card lg:col-span-1"><p className="text-sm opacity-80">Available balance</p><p className="mt-1 font-serif text-3xl font-semibold tabular-nums">{formatMoney(w.available, active)}</p></div>
                <Card className="p-5"><p className="text-sm text-muted">Total earned</p><p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{formatMoney(w.earned, active)}</p></Card>
                <Card className="p-5"><p className="text-sm text-muted">Total withdrawn</p><p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{formatMoney(w.withdrawn, active)}</p></Card>
                <Card className="p-5"><p className="text-sm text-muted">Pending withdrawals</p><p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{formatMoney(w.pending, active)}</p></Card>
              </div>
              <h2 className="text-2xl font-semibold">Transaction history · {active}</h2>
              {tx.length === 0 ? <EmptyState icon={<Wallet className="size-8" />} title="No transactions yet" body="Sales credits and withdrawals will be listed here, each with its own record." /> : (
                <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
                  {tx.map((t) => (
                    <li key={t.id} className="flex items-center gap-4 p-4">
                      <span className={cx("grid size-10 shrink-0 place-items-center rounded-full", t.amountMinor >= 0 ? "bg-success-soft text-success" : "bg-warn-soft text-warn")}>{t.amountMinor >= 0 ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}</span>
                      <div className="min-w-0 flex-1"><p className="font-medium">{TYPE[t.type] ?? t.type}</p><p className="truncate text-sm text-muted">{t.description}</p><p className="text-xs text-muted">{dateFmt(t.createdAt, true)}</p></div>
                      <p className={cx("shrink-0 font-semibold tabular-nums", t.amountMinor > 0 ? "text-success" : t.amountMinor < 0 ? "text-warn" : "text-muted")}>{t.amountMinor > 0 ? "+" : ""}{formatMoney(t.amountMinor, t.currency)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
