"use client";
import { useEffect, useState } from "react";
import { Crown, Eye } from "lucide-react";
import { Async, Badge, Button, Card, EmptyState, PageTitle, Sheet, Skeleton, cx } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { dateFmt } from "@/components/bits";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Sub = { id: string; userId: string; name: string; email: string; country: string; currency: string; plan: "MONTHLY" | "YEARLY"; status: "ACTIVE" | "EXPIRED"; startedAt: string; currentPeriodEnd: string; autoRenew: boolean; payments: number; paid: Record<string, number>; lastPayment: { method: string; amountMinor: number; currency: string; at: string } | null };
type List = { total: number; subscribers: Sub[]; totals: { activeCount: number; activeMonthly: number; activeYearly: number; everSubscribed: number; monthlyRecurringUsdMinor: number; revenue: Array<{ currency: string; amountMinor: number; usdMinor: number; payments: number }> } };
type Detail = {
  subscriber: Sub & { phone: string | null; joined: string; userStatus: string; emailVerified: boolean };
  payments: Array<{ id: string; plan: string; amountMinor: number; currency: string; usdMinor: number; method: string; reference: string; periodStart: string; periodEnd: string; at: string }>;
  wallet: { balances: Array<{ currency: string; amountMinor: number }>; recent: Array<{ id: string; type: string; currency: string; amountMinor: number; description: string; at: string }> };
};
const money = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => formatMoney(v, c)).join(" · ") || "—";

export default function SubscribersPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState(""); const [plan, setPlan] = useState(""); const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<List>(`/api/subscribers?${new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), ...(plan && { plan }), page: String(page) })}`, "We couldn't load subscribers.");
  const d = useApi<Detail>(open ? `/api/subscribers/${open}` : null, "We couldn't load this subscriber.");
  return (
    <div>
      <PageTitle title="Subscribers" sub="Readers on the ad-free plan ($2 a month, or $1.80 a month billed yearly)." />
      {s.data && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4"><p className="text-sm text-muted">Active subscribers</p><p className="font-serif text-3xl font-semibold tabular-nums">{s.data.totals.activeCount}</p><p className="text-xs text-muted">{s.data.totals.activeMonthly} monthly · {s.data.totals.activeYearly} yearly</p></Card>
          <Card className="p-4"><p className="text-sm text-muted">Monthly recurring revenue</p><p className="font-serif text-3xl font-semibold tabular-nums">{formatMoney(s.data.totals.monthlyRecurringUsdMinor, "USD")}</p><p className="text-xs text-muted">dollar value of active plans</p></Card>
          <Card className="p-4"><p className="text-sm text-muted">Ever subscribed</p><p className="font-serif text-3xl font-semibold tabular-nums">{s.data.totals.everSubscribed}</p></Card>
          <Card className="p-4"><p className="text-sm text-muted">Collected so far</p><div className="space-y-0.5 font-semibold tabular-nums">{s.data.totals.revenue.length ? s.data.totals.revenue.map((r) => <p key={r.currency}>{formatMoney(r.amountMinor, r.currency)} <span className="text-xs font-normal text-muted">· {r.payments} payments</span></p>) : <p>—</p>}</div></Card>
        </div>
      )}
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search subscribers" className={`${filterInput} w-full sm:w-72`} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={filterInput}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option></select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} aria-label="Plan" className={filterInput}><option value="">All plans</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(x) => x.subscribers.length === 0} empty={<EmptyState icon={<Crown className="size-8" />} title={dq || status || plan ? "No subscribers match" : "No subscribers yet."} />}>
        {(x) => (<>
          <DataTable rows={x.subscribers} rowKey={(r) => r.id} cols={[
            { key: "n", header: "Subscriber", primary: true, cell: (r) => <span><b>{r.name}</b><span className="block text-xs text-muted">{r.email}</span></span> },
            { key: "c", header: "Country", cell: (r) => r.country },
            { key: "p", header: "Plan", cell: (r) => (r.plan === "YEARLY" ? "Yearly" : "Monthly") },
            { key: "s", header: "Status", cell: (r) => <Badge tone={r.status === "ACTIVE" ? "success" : "neutral"}>{r.status === "ACTIVE" ? "Active" : "Expired"}</Badge> },
            { key: "e", header: "Renews / ended", cell: (r) => dateFmt(r.currentPeriodEnd) },
            { key: "a", header: "Wallet renewal", cell: (r) => (r.autoRenew ? "On" : "Off") },
            { key: "m", header: "Last payment", cell: (r) => (r.lastPayment ? `${formatMoney(r.lastPayment.amountMinor, r.lastPayment.currency)} · ${r.lastPayment.method === "WALLET" ? "Wallet" : "Card"}` : "—") },
            { key: "t", header: "Total paid", cell: (r) => money(r.paid) },
          ]} actions={(r) => <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}><Eye className="size-4" /> Details</Button>} />
          <Pager page={page} total={x.total} size={25} onPage={setPage} />
        </>)}
      </Async>

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Subscriber details">
        <Async state={d} skeleton={<Skeleton className="h-64" />}>
          {(x) => (
            <div className="space-y-6 text-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{x.subscriber.name}</h3><Badge tone={x.subscriber.status === "ACTIVE" ? "success" : "neutral"}>{x.subscriber.status === "ACTIVE" ? "Active" : "Expired"}</Badge></div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                  {[["Email", `${x.subscriber.email}${x.subscriber.emailVerified ? " ✓" : " (unverified)"}`], ["Phone", x.subscriber.phone ?? "—"], ["Country / currency", `${x.subscriber.country} · ${x.subscriber.currency}`], ["Joined", dateFmt(x.subscriber.joined)], ["Plan", x.subscriber.plan === "YEARLY" ? "Yearly" : "Monthly"], ["First subscribed", dateFmt(x.subscriber.startedAt)], [x.subscriber.status === "ACTIVE" ? "Active until" : "Ended", dateFmt(x.subscriber.currentPeriodEnd)], ["Wallet renewal", x.subscriber.autoRenew ? "On" : "Off"], ["Account", x.subscriber.userStatus]].map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
                </dl>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted">Payments ({x.payments.length})</h4>
                <ul className="space-y-2">{x.payments.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-line bg-surface2/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3"><b>{p.plan === "YEARLY" ? "Yearly" : "Monthly"} · {p.method === "WALLET" ? "Wallet" : "Card"}</b><span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span></div>
                    <p className="text-xs text-muted">{dateFmt(p.at, true)} · covers {dateFmt(p.periodStart)} → {dateFmt(p.periodEnd)} · ≈ {formatMoney(p.usdMinor, "USD")}</p>
                    <p className="break-all font-mono text-[11px] text-muted">{p.reference}</p>
                  </li>
                ))}</ul>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted">Wallet</h4>
                <p className="mb-2 font-semibold">{x.wallet.balances.length ? x.wallet.balances.map((b) => formatMoney(b.amountMinor, b.currency)).join(" · ") : "Empty"}</p>
                <ul className="space-y-1.5">{x.wallet.recent.map((t) => <li key={t.id} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate">{t.description} · <span className="text-muted">{dateFmt(t.at)}</span></span><span className={cx("shrink-0 font-semibold tabular-nums", t.amountMinor >= 0 && "text-success")}>{t.amountMinor >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amountMinor), t.currency)}</span></li>)}</ul>
              </div>
            </div>
          )}
        </Async>
      </Sheet>
    </div>
  );
}
