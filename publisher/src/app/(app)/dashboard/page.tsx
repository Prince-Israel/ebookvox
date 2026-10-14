"use client";
import Link from "next/link";
import { useState } from "react";
import { BookOpen, CheckCircle2, Clock, Coins, Hourglass, ShoppingBag, Upload, Wallet, XCircle, PiggyBank } from "lucide-react";
import { Async, Button, Card, EmptyState, PageTitle, Skeleton, cx } from "@/components/ui";
import { BarList, LineChart } from "@/components/charts";
import { MoneyStack, dateFmt } from "@/components/bits";
import { useUser } from "@/components/UserContext";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Data = {
  range: string; currency: string; primaryCurrency: string;
  books: { total: number; approved: number; reviewing: number; rejected: number; drafts: number };
  lifetime: Array<{ currency: string; sales: number; earningsMinor: number }>;
  wallets: Array<{ currency: string; available: number; earned: number; withdrawn: number; pending: number }>;
  series: Array<{ date: string; sales: number; earnings: number }>;
  top: Array<{ bookId: string; title: string; sales: number; earningsMinor: number }>;
  periodSales: number; periodEarningsMinor: number;
};
const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"]] as const;

function Stat({ label, Icon, children, tone }: { label: string; Icon: typeof Wallet; children: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3"><span className={cx("grid size-10 place-items-center rounded-2xl bg-accent-soft text-accent-fg", tone)}><Icon className="size-5" /></span><span className="text-sm font-medium text-muted">{label}</span></div>
      {children}
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const [range, setRange] = useState("30d");
  const [currency, setCurrency] = useState(user.currency);
  const state = useApi<Data>(`/api/dashboard?range=${range}&currency=${currency}`, "We couldn't load your dashboard. Please try again.");
  const num = (v: number) => <p className="font-serif text-4xl font-semibold tabular-nums">{v.toLocaleString()}</p>;

  return (
    <div>
      <PageTitle title={`Welcome, ${user.firstName}`} sub="Here's how your books are performing." action={<Link href="/books/new"><Button><Upload className="size-5" /> Upload book</Button></Link>} />
      <Async state={state} skeleton={<div className="space-y-6"><div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-72" /></div>}>
        {(d) => {
          const cur = d.currency;
          const tot = (f: (w: Data["wallets"][number]) => number) => d.wallets.map((w) => ({ currency: w.currency, amountMinor: f(w) }));
          const sales = d.lifetime.reduce((a, l) => a + l.sales, 0);
          const noBooks = d.books.total === 0;
          return (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Stat label="Total books" Icon={BookOpen}>{num(d.books.total)}</Stat>
                <Stat label="Approved books" Icon={CheckCircle2}>{num(d.books.approved)}</Stat>
                <Stat label="Under review" Icon={Hourglass}>{num(d.books.reviewing)}</Stat>
                <Stat label="Rejected books" Icon={XCircle}>{num(d.books.rejected)}</Stat>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                <Stat label="Total sales" Icon={ShoppingBag}>{num(sales)}</Stat>
                <Stat label="Total earnings" Icon={Coins}><MoneyStack primary={d.primaryCurrency} values={d.lifetime.map((l) => ({ currency: l.currency, amountMinor: l.earningsMinor }))} /></Stat>
                <Stat label="Available wallet balance" Icon={Wallet}><MoneyStack primary={d.primaryCurrency} values={tot((w) => w.available)} /></Stat>
                <Stat label="Pending withdrawal" Icon={Clock}><MoneyStack primary={d.primaryCurrency} values={tot((w) => w.pending)} /></Stat>
                <Stat label="Total withdrawn" Icon={PiggyBank}><MoneyStack primary={d.primaryCurrency} values={tot((w) => w.withdrawn)} /></Stat>
                <Stat label={`Sales · ${RANGES.find((r) => r[0] === d.range)?.[1]}`} Icon={ShoppingBag}>{num(d.periodSales)}<p className="text-sm text-muted">{formatMoney(d.periodEarningsMinor, cur)} earned</p></Stat>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Time range">
                  {RANGES.map(([k, l]) => <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition", range === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}
                </div>
                <label className="flex items-center gap-2 text-sm text-muted">Charts in
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 rounded-full border border-line bg-surface px-3 font-medium text-fg" aria-label="Chart currency">{["NGN", "USD", "GBP", "EUR"].map((c) => <option key={c}>{c}</option>)}</select>
                </label>
              </div>

              {noBooks ? (
                <EmptyState icon={<BookOpen className="size-8" />} title="Publish your first book" body="Upload a PDF, DOCX or TXT with a cover, submit it for review, and start earning once it's live." action={<Link href="/books/new"><Button>Upload a book</Button></Link>} />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card><h2 className="mb-1 text-xl font-semibold">Sales over time</h2><p className="mb-3 text-sm text-muted">Books sold · {cur}</p>
                    <LineChart title="Sales over time" data={d.series.map((s) => ({ label: dateFmt(s.date).replace(/ \d{4}$/, ""), value: s.sales }))} format={(v) => `${Math.round(v)} sold`} /></Card>
                  <Card><h2 className="mb-1 text-xl font-semibold">Earnings over time</h2><p className="mb-3 text-sm text-muted">Your 85% share · {cur}</p>
                    <LineChart title="Earnings over time" data={d.series.map((s) => ({ label: dateFmt(s.date).replace(/ \d{4}$/, ""), value: s.earnings }))} format={(v) => formatMoney(Math.round(v), cur).replace(` ${cur}`, "")} /></Card>
                  <Card><h2 className="mb-4 text-xl font-semibold">Books sold</h2>
                    {d.top.length ? <BarList items={d.top.map((t) => ({ label: t.title, value: t.sales }))} format={(v) => `${v} sold`} /> : <p className="text-sm text-muted">No sales in this period.</p>}</Card>
                  <Card><h2 className="mb-4 text-xl font-semibold">Top performing books</h2>
                    {d.top.length ? <BarList items={d.top.map((t) => ({ label: t.title, value: t.earningsMinor }))} format={(v) => formatMoney(v, cur)} /> : <p className="text-sm text-muted">No earnings in this period.</p>}</Card>
                </div>
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
