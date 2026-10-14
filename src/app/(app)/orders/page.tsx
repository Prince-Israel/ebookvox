"use client";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Async, Badge, Button, EmptyState, PageTitle, Skeleton, when } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type Order = { id: string; number: string; reference: string; status: "PAID" | "PENDING" | "FAILED"; amountMinor: number; currency: string; createdAt: string; paidAt: string | null; failureReason: string | null; book: { id: string; title: string; author: string; coverHue: number; coverUrl: string | null } };
const TONE = { PAID: "success", PENDING: "warn", FAILED: "danger" } as const;
const LABEL = { PAID: "Paid", PENDING: "Pending", FAILED: "Failed" } as const;

export default function OrdersPage() {
  const state = useApi<{ orders: Order[] }>("/api/orders", "We couldn't load your orders. Please try again.");
  return (
    <div>
      <PageTitle title="Orders" sub="Your purchases and payment history." />
      <Async state={state} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>}
        isEmpty={(d) => d.orders.length === 0}
        empty={<EmptyState icon={<Receipt className="size-8" />} title="No orders yet" body="When you buy a book, your receipt and payment reference will appear here." action={<Link href="/books"><Button>Browse books</Button></Link>} />}>
        {(d) => (
          <ul className="space-y-3">
            {d.orders.map((o) => (
              <li key={o.id} className="flex gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
                <div className="w-16 shrink-0 sm:w-20"><Cover title={o.book.title} author={o.book.author} hue={o.book.coverHue} url={o.book.coverUrl} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><Link href={`/books/${o.book.id}`} className="block truncate font-serif text-lg font-semibold hover:underline">{o.book.title}</Link><p className="text-xs text-muted">Order {o.number}</p></div>
                    <Badge tone={TONE[o.status]}>{LABEL[o.status]}</Badge>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3 sm:block"><dt className="text-muted">Amount</dt><dd className="font-semibold">{formatMoney(o.amountMinor, o.currency)}</dd></div>
                    <div className="flex justify-between gap-3 sm:block"><dt className="text-muted">Currency</dt><dd className="font-medium">{o.currency}</dd></div>
                    <div className="flex justify-between gap-3 sm:block sm:col-span-2"><dt className="text-muted">Payment reference</dt><dd className="break-all font-mono text-xs">{o.reference}</dd></div>
                    <div className="flex justify-between gap-3 sm:block"><dt className="text-muted">Date</dt><dd>{when(o.paidAt ?? o.createdAt)}</dd></div>
                  </dl>
                  {o.status === "FAILED" && o.failureReason && <p className="mt-2 text-sm text-danger">{o.failureReason}</p>}
                  <div className="mt-3 flex gap-2">
                    {o.status === "PENDING" && <Link href={`/payment/callback?reference=${o.reference}`}><Button size="sm" variant="secondary">Check payment</Button></Link>}
                    {o.status === "PAID" && <Link href={`/read/${o.book.id}`}><Button size="sm">Read</Button></Link>}
                    {o.status === "FAILED" && <Link href={`/checkout/${o.book.id}`}><Button size="sm" variant="secondary">Try again</Button></Link>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
