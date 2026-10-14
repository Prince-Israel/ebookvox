"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Banner, Button, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api, ApiFailure } from "@/lib/client";

function Form() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api("/api/auth/login", { method: "POST", json: { email, password } }); window.location.href = "/dashboard"; }
    catch (err) { setError((err as ApiFailure).message); setBusy(false); }
  }
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#3a261c] p-12 text-[#fbf1e4] lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(70% 55% at 30% 20%, #7b523f66, transparent), radial-gradient(50% 40% at 90% 100%, #ee9b6e40, transparent)" }} />
        <Logo size={46} className="relative [&_span]:text-[#fbf1e4] [&_span_span]:text-[#f6a67a]" />
        <div className="relative max-w-md"><h2 className="font-serif text-5xl font-semibold leading-tight">Your Words.<br />Our Voice.</h2><p className="mt-5 text-lg text-[#e7d3bf]">The operations centre for readers, publishers, books and payments across the Ebookvox ecosystem.</p></div>
        <p className="relative text-sm text-[#c9b49f]">Authorised administrators only. Activity is logged.</p>
      </aside>
      <section className="safe-t safe-b flex flex-col justify-center px-5 py-10 sm:px-12">
        <form onSubmit={submit} className="anim-up mx-auto w-full max-w-sm space-y-5" noValidate>
          <div className="lg:hidden"><Logo /></div>
          <div><span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-fg"><ShieldCheck className="size-6" /></span><h1 className="text-4xl font-semibold">Admin sign in</h1><p className="mt-2 text-muted">Restricted to authorised administrators.</p></div>
          {sp.get("expired") && <Banner tone="warn">Your session expired. Please sign in again.</Banner>}
          {error && <Banner tone="danger">{error}</Banner>}
          <Input label="Email" id="admin-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" id="admin-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
        </form>
      </section>
    </main>
  );
}
export default function Login() { return <Suspense><Form /></Suspense>; }
