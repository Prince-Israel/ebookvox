"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, Button, Input } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";

function Form() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/auth/signin", { method: "POST", json: { email, password } });
      window.location.href = sp.get("next")?.startsWith("/") ? sp.get("next")! : "/dashboard";
    } catch (err) {
      const f = err as ApiFailure;
      setError(f.message);
      setFields(f.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <div className="anim-up">
      <h1 className="text-4xl font-semibold">Publisher sign in</h1>
      <p className="mb-6 mt-2 text-muted">Sign in to manage your books, sales and payouts.</p>
      {sp.get("expired") && <div className="mb-4"><Banner tone="warn">Your session expired. Please sign in again.</Banner></div>}
      {sp.get("reset") && <div className="mb-4"><Banner tone="success">Password updated. You can sign in now.</Banner></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && !fields.email && !fields.password && <Banner tone="danger">{error}</Banner>}
        <Input label="Email" name="email" id="signin-email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required />
        <div>
          <Input label="Password" name="current-password" id="signin-password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required />
          <div className="mt-2 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-muted"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Show password</label>
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">Forgot password?</Link>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign In</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">New publisher? <Link href="/sign-up" className="font-semibold text-accent hover:underline">Create publisher account</Link></p>
    </div>
  );
}

export default function SignIn() {
  return <Suspense><Form /></Suspense>;
}
