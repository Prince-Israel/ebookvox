"use client";
import { useState } from "react";
import { AlertTriangle, BookOpen, Coins, RotateCw, ShoppingBag, UserRound, Users } from "lucide-react";
import { Button, Card, PageTitle, Skeleton, cx } from "@/components/ui";
import { BarList, MultiLine } from "@/components/charts";
import { StatusBadge, dateFmt } from "@/components/bits";
import { useAdmin } from "@/components/AdminContext";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type R<T> = { ok: true; data: T } | { ok: false; service: string; error: string } | null;
type Dash = {
  range: string; allowed: Record<string, boolean>;
  reader: R<{ users: { total: number; active: number; suspended: number }; books: { total: number; approved: number; pending: number; reader: number; publisher: number }; orders: { total: number; paid: number; pending: number; failed: number }; revenue: Array<{ currency: string; grossMinor: number; sales: number }>; categories: Array<{ category: string; count: number }>; series: Array<{ date: string; registrations: number; active: number; suspended: number }> }>;
  publisher: R<{ publishers: { total: number; active: number; suspended: number }; books: { total: number; reviewing: number; approved: number; rejected: number; drafts: number } }>;
  recentReader: R<{ books: Array<any> }>; recentPublisher: R<{ books: Array<any> }>;
};
const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"]] as const;

function StatCard({ title, Icon, children, unavailable, onRetry }: { title: string; Icon: typeof Users; children?: React.ReactNode; unavailable?: string | null; onRetry: () => void }) {
  return (
    <Card className="p-5" aria-label={title}>
      <div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent-fg"><Icon className="size-5" /></span><span className="text-xs font-bold uppercase tracking-[0.15em] text-muted">{title}</span></div>
      {unavailable ? (
        <div role="status" className="space-y-2"><p className="flex items-center gap-2 font-serif text-2xl font-semibold text-muted"><AlertTriangle className="size-5 text-warn" /> Unavailable</p><p className="text-sm text-muted">{unavailable}</p><Button size="sm" variant="secondary" onClick={onRetry}><RotateCw className="size-4" /> Retry</Button></div>
      ) : children}
    </Card>
  );
}
const Big = ({ v }: { v: number | string }) => <p className="font-serif text-4xl font-semibold tabular-nums">{typeof v === "number" ? v.toLocaleString() : v}</p>;
const Sub = ({ items }: { items: Array<[string, number | string]> }) => <dl className="mt-3 space-y-1.5 text-sm">{items.map(([l, v]) => <div key={l} className="flex justify-between gap-2 border-t border-line pt-1.5"><dt className="text-muted">{l}</dt><dd className="font-semibold tabular-nums">{typeof v === "number" ? v.toLocaleString() : v}</dd></div>)}</dl>;

export default function DashboardPage() {
  const { admin } = useAdmin();
  const [range, setRange] = useState("30d");
  const s = useApi<Dash>(`/api/dashboard?range=${range}`, "We couldn't load the dashboard. Please try again.");
  const d = s.data;
  const rd = d?.reader && d.reader.ok ? d.reader.data : null;
  const pd = d?.publisher && d.publisher.ok ? d.publisher.data : null;
  const rErr = d?.reader && !d.reader.ok ? d.reader.error : null;
  const pErr = d?.publisher && !d.publisher.ok ? d.publisher.error : null;
  const down = [rErr, pErr].filter(Boolean) as string[];

  const recent = d ? [
    ...(d.recentReader?.ok ? d.recentReader.data.books.map((b: any) => ({ key: "r" + b.id, title: b.title, author: b.author, source: b.source === "PUBLISHER" ? "Publisher" : "Reader", status: b.status, at: b.approvedAt ?? b.createdAt })) : []),
    ...(d.recentPublisher?.ok ? d.recentPublisher.data.books.map((b: any) => ({ key: "p" + b.id, title: b.title, author: b.author, source: "Publisher", status: b.status, at: b.updatedAt })) : []),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8) : [];
  const catTotal = rd?.categories.reduce((a, c) => a + c.count, 0) ?? 0;

  return (
    <div className="space-y-8">
      <PageTitle title={`Welcome, ${admin.name.split(" ")[0]}`} sub="Live operations across Reader, Publisher and payments." />
      {d && down.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          <AlertTriangle className="size-5 shrink-0" /><span className="min-w-0 flex-1">{down.join(" ")} Figures that depend on it are shown as unavailable — not as zero.</span>
          <Button size="sm" variant="secondary" onClick={s.reload}><RotateCw className="size-4" /> Retry</Button>
        </div>
      )}
      {!d ? (
        s.error ? <div role="alert" className="rounded-3xl border border-danger/30 bg-danger-soft p-8 text-center"><p className="font-medium">{s.error}</p><Button className="mt-4" variant="secondary" onClick={s.reload}>Try again</Button></div> :
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {d.allowed.users && <StatCard title="Total users" Icon={Users} unavailable={rErr} onRetry={s.reload}>{rd && <><Big v={rd.users.total} /><Sub items={[["Active", rd.users.active], ["Suspended", rd.users.suspended]]} /></>}</StatCard>}
          {d.allowed.books && <StatCard title="Total books" Icon={BookOpen} unavailable={rErr ?? pErr} onRetry={s.reload}>{rd && pd && <>
            <Big v={rd.books.total + pd.books.reviewing + pd.books.rejected} /><Sub items={[["Reader books", rd.books.reader], ["Publisher books", rd.books.publisher + pd.books.reviewing + pd.books.rejected], ["Approved", rd.books.approved]]} /></>}</StatCard>}
          {d.allowed.orders && <StatCard title="Total orders" Icon={ShoppingBag} unavailable={rErr} onRetry={s.reload}>{rd && <><Big v={rd.orders.total} /><Sub items={[["Paid", rd.orders.paid], ["Pending", rd.orders.pending], ["Failed", rd.orders.failed]]} /></>}</StatCard>}
          {d.allowed.publishers && <StatCard title="Total publishers" Icon={UserRound} unavailable={pErr} onRetry={s.reload}>{pd && <><Big v={pd.publishers.total} /><Sub items={[["Active", pd.publishers.active], ["Suspended", pd.publishers.suspended]]} /></>}</StatCard>}
          {d.allowed.revenue && <StatCard title="Gross revenue" Icon={Coins} unavailable={rErr} onRetry={s.reload}>{rd && (rd.revenue.length === 0 ? <><Big v="₦0" /><p className="mt-2 text-sm text-muted">No paid orders yet</p></> : <div className="space-y-2">{rd.revenue.map((r) => <div key={r.currency}><p className="font-serif text-2xl font-semibold tabular-nums">{formatMoney(r.grossMinor, r.currency)}</p><p className="text-xs text-muted">{r.sales.toLocaleString()} {r.sales === 1 ? "sale" : "sales"} · {r.currency}</p></div>)}</div>)}</StatCard>}
        </div>
      )}

      {d?.allowed.charts && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Time range">{RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition", range === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}</div>
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card><h2 className="mb-1 text-xl font-semibold">User growth</h2><p className="mb-3 text-sm text-muted">Registrations, active users (sign-ins) and suspensions</p>
              {rErr ? <p role="status" className="py-10 text-center text-sm text-muted">User growth is unavailable. {rErr}</p> : rd ? <MultiLine title="User growth" labels={rd.series.map((x) => dateFmt(x.date).replace(/ \d{4}$/, ""))} series={[{ name: "Registrations", color: "var(--primary)", values: rd.series.map((x) => x.registrations) }, { name: "Active users", color: "var(--accent)", values: rd.series.map((x) => x.active) }, { name: "Suspended", color: "var(--muted)", dash: "5 4", values: rd.series.map((x) => x.suspended) }]} /> : <Skeleton className="h-56" />}</Card>
            <Card><h2 className="mb-4 text-xl font-semibold">Book categories</h2>
              {rErr ? <p role="status" className="text-sm text-muted">Unavailable. {rErr}</p> : rd ? (rd.categories.length ? <BarList items={rd.categories.slice(0, 8).map((c) => ({ label: c.category, value: c.count }))} format={(v) => `${v} · ${catTotal ? Math.round((v / catTotal) * 100) : 0}%`} /> : <p className="text-sm text-muted">No approved books yet.</p>) : <Skeleton className="h-56" />}</Card>
          </div>
          <Card>
            <h2 className="mb-4 text-xl font-semibold">Recent book activity</h2>
            {recent.length === 0 ? <p className="text-sm text-muted">{d.recentReader && !d.recentReader.ok ? "Book activity is unavailable right now." : "No book activity yet."}</p> : (
              <ul className="divide-y divide-line">{recent.map((b) => <li key={b.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{b.title}</p><p className="truncate text-sm text-muted">{b.author} · {b.source}</p></div><StatusBadge status={b.status} /><span className="w-28 text-right text-sm text-muted">{dateFmt(b.at)}</span></li>)}</ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
