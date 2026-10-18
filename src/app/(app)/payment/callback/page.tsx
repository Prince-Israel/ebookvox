"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";

type Result = { status: "PAID" | "PENDING" | "FAILED"; kind?: "ORDER" | "SUBSCRIPTION" | "TOPUP"; bookId?: string; plan?: string; message?: string };

function Callback() {
  const sp = useSearchParams();
  const reference = sp.get("reference") ?? sp.get("trxref");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tries = useRef(0);

  const verify = useCallback(async () => {
    if (!reference) return setError("We couldn't find a payment reference in this link.");
    setError(null);
    try {
      const r = await api<Result>(`/api/checkout/verify?reference=${encodeURIComponent(reference)}`);
      setRes(r);
      if (r.status === "PENDING" && tries.current++ < 6) setTimeout(verify, 3000);
    } catch (e) {
      setError((e as ApiFailure).message);
    }
  }, [reference]);

  useEffect(() => { verify(); }, [verify]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card className="anim-up text-center">
        {error ? (
          <><XCircle className="mx-auto size-16 text-danger" /><h1 className="mt-4 text-3xl font-semibold">We couldn't confirm your payment</h1><p className="mt-2 text-muted">{error}</p><div className="mt-6 flex justify-center gap-3"><Button onClick={verify}>Try again</Button><Link href="/orders"><Button variant="secondary">View orders</Button></Link></div></>
        ) : !res || res.status === "PENDING" ? (
          <><Spinner className="mx-auto size-14 text-accent" /><h1 className="mt-4 text-3xl font-semibold">Verifying your payment…</h1><p className="mt-2 text-muted">{res?.message ?? "Hang tight — we're confirming with Paystack. Please don't close this page."}</p>{res && tries.current >= 6 && <div className="mt-6 flex justify-center gap-3"><Button onClick={() => { tries.current = 0; verify(); }}><Clock className="size-4" /> Check again</Button><Link href="/orders"><Button variant="secondary">View orders</Button></Link></div>}</>
        ) : res.status === "PAID" && res.kind === "SUBSCRIPTION" ? (
          <><CheckCircle2 className="mx-auto size-16 text-success" /><h1 className="mt-4 text-3xl font-semibold">You&apos;re ad-free — thank you!</h1><p className="mt-2 text-muted">Your subscription is active. Ads are switched off everywhere you sign in.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/home"><Button size="lg">Back to Home</Button></Link><Link href="/subscribe"><Button size="lg" variant="secondary">View subscription</Button></Link></div></>
        ) : res.status === "PAID" && res.kind === "TOPUP" ? (
          <><CheckCircle2 className="mx-auto size-16 text-success" /><h1 className="mt-4 text-3xl font-semibold">Wallet topped up</h1><p className="mt-2 text-muted">The money is in your wallet and ready to use.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/wallet"><Button size="lg">View wallet</Button></Link><Link href="/subscribe"><Button size="lg" variant="secondary">Go ad-free</Button></Link></div></>
        ) : res.status === "PAID" ? (
          <><CheckCircle2 className="mx-auto size-16 text-success" /><h1 className="mt-4 text-3xl font-semibold">Payment successful</h1><p className="mt-2 text-muted">Your book has been added to your library.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href={`/read/${res.bookId}`}><Button size="lg">Start reading</Button></Link><Link href="/orders"><Button size="lg" variant="secondary">View orders</Button></Link></div></>
        ) : (
          <><XCircle className="mx-auto size-16 text-danger" /><h1 className="mt-4 text-3xl font-semibold">Payment unsuccessful</h1><p className="mt-2 text-muted">{res.message ?? "The payment didn't go through."} You haven't been charged.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{res.bookId && <Link href={`/checkout/${res.bookId}`}><Button size="lg">Try again</Button></Link>}{res.kind === "SUBSCRIPTION" && <Link href="/subscribe"><Button size="lg">Try again</Button></Link>}{res.kind === "TOPUP" && <Link href="/wallet"><Button size="lg">Try again</Button></Link>}<Link href="/support"><Button size="lg" variant="secondary">Contact support</Button></Link></div></>
        )}
      </Card>
    </div>
  );
}
export default function Page() {
  return <Suspense><Callback /></Suspense>;
}
