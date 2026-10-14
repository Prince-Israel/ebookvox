"use client";
import Link from "next/link";
import { Async, Card, PageTitle, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

export default function AdminHome() {
  const s = useApi<{ publishers: number; reviewing: number; live: number; openTickets: number; pendingWithdrawals: number; sales: Array<{ currency: string; count: number; grossMinor: number; platformMinor: number; publisherMinor: number }> }>("/api/admin/stats", "We couldn't load platform statistics.");
  return (
    <div>
      <PageTitle title="Admin overview" sub="Review books, process payouts and answer publishers." />
      <Async state={s} skeleton={<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div>}>
        {(d) => (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {([["Publishers", d.publishers, "/admin/publishers"], ["Awaiting review", d.reviewing, "/admin/review"], ["Live books", d.live, "/admin/review?s=all"], ["Pending withdrawals", d.pendingWithdrawals, "/admin/withdrawals"], ["Open tickets", d.openTickets, "/admin/support"]] as const).map(([l, v, h]) => (
              <Link key={l} href={h}><Card className="h-full transition hover:-translate-y-0.5"><p className="text-sm text-muted">{l}</p><p className="mt-1 font-serif text-4xl font-semibold">{v}</p></Card></Link>
            ))}
            <Card><p className="text-sm text-muted">Platform revenue (15%)</p>{d.sales.length === 0 ? <p className="mt-1 text-muted">No sales yet</p> : d.sales.map((x) => <p key={x.currency} className="mt-1 font-serif text-xl font-semibold">{formatMoney(x.platformMinor, x.currency)} <span className="text-sm font-normal text-muted">of {formatMoney(x.grossMinor, x.currency)}</span></p>)}</Card>
          </div>
        )}
      </Async>
    </div>
  );
}
