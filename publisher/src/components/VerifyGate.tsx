"use client";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { Banner, Button, Card } from "./ui";
import { Logo } from "./Logo";
import { useUser } from "./UserContext";
import { api, ApiFailure } from "@/lib/client";

/** Unverified publishers see only this screen — the API also refuses them (server-side). */
export function VerifyGate() {
  const { user } = useUser();
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    try { await api("/api/auth/resend", { method: "POST" }); setMsg({ tone: "success", text: "A new verification link is on its way." }); }
    catch (e) { setMsg({ tone: "danger", text: (e as ApiFailure).message }); }
    setBusy(false);
  }
  async function out() { try { await api("/api/auth/signout", { method: "POST" }); } catch {} window.location.href = "/sign-in"; }
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo size={40} className="mx-auto" />
        <Card>
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-accent-soft text-accent-fg"><MailCheck className="size-8" /></div>
          <h1 className="text-3xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-muted">We sent a verification link to <strong className="break-all text-fg">{user.email}</strong>. Open it to unlock your publisher dashboard.</p>
          {msg && <div className="mt-4"><Banner tone={msg.tone}>{msg.text}</Banner></div>}
          <div className="mt-6 flex flex-col gap-3"><Button onClick={() => window.location.reload()}>I've verified — continue</Button><Button variant="secondary" loading={busy} onClick={resend}>Resend verification email</Button><Button variant="ghost" onClick={out}>Sign out</Button></div>
        </Card>
      </div>
    </main>
  );
}
