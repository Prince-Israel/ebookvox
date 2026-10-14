"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { Async, Banner, Button, Card, PageTitle, Skeleton, useToast } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/countries";
import type { BookItem } from "@/components/BookCard";

export default function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const toast = useToast();
  const state = useApi<{ book: BookItem & { publisher: string }; owned: boolean; canBuy: boolean }>(`/api/books/${id}`, "We couldn't load your order. Please try again.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await api<{ authorizationUrl: string }>("/api/checkout", { method: "POST", json: { bookId: id } });
      window.location.href = authorizationUrl;
    } catch (e) {
      setError((e as ApiFailure).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/books/${id}`} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Back to book</Link>
      <PageTitle title="Checkout" sub="Review your order, then pay securely with Paystack." />
      <Async state={state} skeleton={<Skeleton className="h-96" />}>
        {({ book: b, owned, canBuy }) => {
          if (b.isFree || owned)
            return <Banner tone="success" action={<Link href={`/read/${id}`}><Button size="sm">Read now</Button></Link>}>{owned ? "You already own this book." : "This book is free — no payment needed."}</Banner>;
          return (
            <div className="anim-up space-y-5">
              <Card className="flex gap-5">
                <div className="w-24 shrink-0 sm:w-32"><Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">{b.category}</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight">{b.title}</h2>
                  <p className="text-muted">by {b.author}</p>
                  <p className="mt-1 text-sm text-muted">Publisher: {b.publisher}</p>
                  <p className="mt-4 font-serif text-2xl font-semibold">{b.price ? formatMoney(b.price.amountMinor, b.price.currency) : "—"}</p>
                </div>
              </Card>
              <Card>
                <h3 className="mb-3 text-lg font-semibold">Your details</h3>
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Name</dt><dd className="font-medium">{user.firstName} {user.lastName}</dd></div>
                  <div><dt className="text-muted">Email</dt><dd className="break-all font-medium">{user.email}</dd></div>
                  <div><dt className="text-muted">Phone</dt><dd className="font-medium">{user.phone ?? "—"}</dd></div>
                  <div><dt className="text-muted">Country</dt><dd className="font-medium">{countryName(user.country)}</dd></div>
                </dl>
              </Card>
              <Card>
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <span className="flex items-center gap-2 font-medium"><CreditCard className="size-5 text-accent" /> Payment method</span>
                  <span className="text-sm text-muted">Card · Bank · USSD · Transfer via Paystack</span>
                </div>
                <div className="flex items-end justify-between pt-4">
                  <span className="text-lg font-semibold">Total ({b.price?.currency})</span>
                  <span className="font-serif text-4xl font-semibold">{b.price ? formatMoney(b.price.amountMinor, b.price.currency) : "—"}</span>
                </div>
              </Card>
              {!user.emailVerified && <Banner tone="warn">Verify your email address to complete a purchase. Use the banner above to resend the link.</Banner>}
              {error && <Banner tone="danger">{error}</Banner>}
              {!canBuy && <Banner tone="danger">This book isn't available in {user.currency} yet.</Banner>}
              <Button size="lg" className="w-full" loading={busy} disabled={!canBuy || !user.emailVerified} onClick={pay}><Lock className="size-5" /> Proceed to Secure Payment</Button>
              <p className="flex items-center justify-center gap-2 text-center text-xs text-muted"><ShieldCheck className="size-4" /> Payments are processed and verified server-side by Paystack. We never see your card details.</p>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
