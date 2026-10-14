"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Banner, Button, Input } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { method: "POST", json: { email } });
      setDone(true);
    } catch (err) {
      setError((err as ApiFailure).message);
    }
    setBusy(false);
  }

  if (done)
    return (
      <div className="anim-up text-center">
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-accent-soft text-accent-fg"><MailCheck className="size-10" /></div>
        <h1 className="text-3xl font-semibold">Check your email</h1>
        <p className="mt-3 text-muted">If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It's valid for one hour.</p>
        <Link href="/sign-in" className="mt-8 inline-block font-semibold text-accent hover:underline">Back to sign in</Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="anim-up space-y-5" noValidate>
      <div>
        <h1 className="text-4xl font-semibold">Forgot password?</h1>
        <p className="mt-2 text-muted">Enter your email and we'll send you a reset link.</p>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}
      <Input label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      <p className="text-center text-sm"><Link href="/sign-in" className="font-semibold text-accent hover:underline">Back to sign in</Link></p>
    </form>
  );
}
