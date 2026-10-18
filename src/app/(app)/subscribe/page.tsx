"use client";
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CreditCard, Headphones, Sparkles, Wallet } from "lucide-react";
import { Async, Badge, Banner, Button, Card, PageTitle, Skeleton, cx, useToast, when } from "@/components/ui";
import { AuthPrompt } from "@/components/AuthPrompt";
import { useAuth } from "@/components/UserContext";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { countryName } from "@/lib/countries";

type Plan = { plan: "MONTHLY" | "YEARLY"; label: string; blurb: string; currency: string; amountMinor: number; perMonthMinor: number };
type D = {
  currency: string; country: string | null; plans: Plan[]; signedIn: boolean; adFree: boolean; walletMinor: number;
  subscription: { plan: "MONTHLY" | "YEARLY"; currentPeriodEnd: string; autoRenew: boolean } | null;
  payments: Array<{ id: string; plan: string; amountMinor: number; currency: string; method: string; periodEnd: string; createdAt: string }>;
};

export default function SubscribePage() {
  const state = useApi<D>("/api/subscription", "We couldn't load the subscription plans. Please try again.");
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState<"MONTHLY" | "YEARLY">("YEARLY");
  const [method, setMethod] = useState<"wallet" | "card">("card");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);

  async function subscribe(d: D) {
    if (!user) return setPrompt(true);
    setBusy(true);
    try {
      const r = await api<{ status: string; authorizationUrl?: string }>("/api/subscription/subscribe", { method: "POST", json: { plan, method } });
      if (r.authorizationUrl) { window.location.href = r.authorizationUrl; return; }
      toast("You're ad-free — thank you!");
      await Promise.all([refresh(), state.reload()]);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
    setBusy(false);
  }
  async function autoRenew(enabled: boolean) {
    try { await api("/api/subscription/auto-renew", { method: "POST", json: { enabled } }); toast(enabled ? "Renewal from your wallet is on." : "Renewal from your wallet is off."); state.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Go ad-free" sub={state.data ? `Prices shown in ${state.data.currency}${state.data.country ? ` · ${countryName(state.data.country)}` : ""}` : "No ads. Just listening."} />
      <Async state={state} skeleton={<div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>}>
        {(d) => {
          const chosen = d.plans.find((p) => p.plan === plan)!;
          const enough = d.walletMinor >= chosen.amountMinor;
          return (
            <div className="space-y-6">
              {d.adFree && d.subscription && (
                <Card className="border-success/40 bg-success-soft">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="size-7 shrink-0 text-success" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold">You&apos;re ad-free</h2>
                      <p className="text-sm text-muted">{d.subscription.plan === "YEARLY" ? "Yearly" : "Monthly"} plan · active until <strong className="text-fg">{new Date(d.subscription.currentPeriodEnd).toDateString()}</strong>. Subscribing again adds time to what you have left.</p>
                      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium">
                        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={d.subscription.autoRenew} onChange={(e) => autoRenew(e.target.checked)} />
                        Renew automatically from my wallet when it ends
                      </label>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <ul className="grid gap-3 text-sm sm:grid-cols-3">
                  {[[Sparkles, "No banner ads", "Header and footer ads disappear on Home."], [Headphones, "No ads before reading", "The video ad before the voice starts is gone."], [BadgeCheck, "Everywhere you sign in", "Web, Android and iPhone — one subscription."]].map(([Icon, t, s]) => {
                    const I = Icon as typeof Sparkles;
                    return <li key={t as string} className="flex gap-3"><I className="mt-0.5 size-5 shrink-0 text-accent" /><span><b className="block">{t as string}</b><span className="text-muted">{s as string}</span></span></li>;
                  })}
                </ul>
              </Card>

              <section aria-labelledby="plans">
                <h2 id="plans" className="mb-3 text-sm font-bold uppercase tracking-[0.2em]">Choose a plan</h2>
                <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
                  {d.plans.map((p) => (
                    <button key={p.plan} role="radio" aria-checked={plan === p.plan} onClick={() => setPlan(p.plan)} className={cx("relative rounded-3xl border-2 p-5 text-left transition", plan === p.plan ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface2")}>
                      {p.plan === "YEARLY" && <span className="absolute -top-3 right-4"><Badge tone="success">Save 10%</Badge></span>}
                      <p className="font-semibold">{p.label}</p>
                      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums sm:text-3xl">{formatMoney(p.perMonthMinor, p.currency)}<span className="whitespace-nowrap text-sm font-normal text-muted"> / month</span></p>
                      <p className="mt-1 text-sm text-muted">{p.plan === "YEARLY" ? `Billed once: ${formatMoney(p.amountMinor, p.currency)} a year` : "Billed every month"}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">$2.00 a month, or $1.80 a month on the yearly plan, converted to {d.currency} at today&apos;s international exchange rate.</p>
              </section>

              <section aria-labelledby="pay">
                <h2 id="pay" className="mb-3 text-sm font-bold uppercase tracking-[0.2em]">Pay with</h2>
                <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-2">
                  <button role="radio" aria-checked={method === "card"} onClick={() => setMethod("card")} className={cx("flex items-center gap-3 rounded-3xl border-2 p-4 text-left transition", method === "card" ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface2")}>
                    <CreditCard className="size-6 shrink-0 text-accent" /><span><b className="block">Card</b><span className="text-sm text-muted">Secure checkout by Paystack</span></span>
                  </button>
                  <button role="radio" aria-checked={method === "wallet"} onClick={() => setMethod("wallet")} className={cx("flex items-center gap-3 rounded-3xl border-2 p-4 text-left transition", method === "wallet" ? "border-accent bg-accent-soft" : "border-line bg-surface hover:bg-surface2")}>
                    <Wallet className="size-6 shrink-0 text-accent" /><span><b className="block">Wallet</b><span className="text-sm text-muted">Balance {user ? formatMoney(d.walletMinor, d.currency) : "— sign in"}</span></span>
                  </button>
                </div>
                {method === "wallet" && user && !enough && <div className="mt-3"><Banner tone="warn" action={<Link href="/wallet"><Button size="sm" variant="secondary">Top up</Button></Link>}>Your wallet has {formatMoney(d.walletMinor, d.currency)} — you need {formatMoney(chosen.amountMinor, d.currency)}.</Banner></div>}
              </section>

              <Button size="lg" className="w-full" loading={busy} disabled={method === "wallet" && !!user && !enough} onClick={() => subscribe(d)}>
                {d.adFree ? "Add more time" : "Subscribe"} · {formatMoney(chosen.amountMinor, chosen.currency)}{plan === "YEARLY" ? " / year" : " / month"}
              </Button>
              <p className="text-center text-xs text-muted">A subscription isn&apos;t renewed from your card without you — it simply ends and the ads come back. Turn on wallet renewal above if you&apos;d like it to continue.</p>

              {d.payments.length > 0 && (
                <section aria-labelledby="hist">
                  <h2 id="hist" className="mb-3 text-sm font-bold uppercase tracking-[0.2em]">Payments</h2>
                  <ul className="space-y-2">{d.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
                      <span className="min-w-0"><b>{p.plan === "YEARLY" ? "Yearly" : "Monthly"}</b> · {p.method === "WALLET" ? "Wallet" : "Card"}<span className="block text-xs text-muted">{when(p.createdAt)} · until {new Date(p.periodEnd).toDateString()}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(p.amountMinor, p.currency)}</span>
                    </li>
                  ))}</ul>
                </section>
              )}
            </div>
          );
        }}
      </Async>
      <AuthPrompt open={prompt} onClose={() => setPrompt(false)} next="/subscribe" reason="Create a free account or sign in to subscribe and switch the ads off." />
    </div>
  );
}
