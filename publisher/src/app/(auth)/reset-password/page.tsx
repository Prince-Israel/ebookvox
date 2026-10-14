"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, Button, Input } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api("/api/auth/reset", { method: "POST", json: { token, password, confirmPassword } });
      window.location.href = "/sign-in?reset=1";
    } catch (err) {
      setError((err as ApiFailure).message);
      setFields((err as ApiFailure).fields ?? {});
      setBusy(false);
    }
  }
  if (!token) return <Banner tone="danger">This reset link is incomplete. <Link className="underline" href="/forgot-password">Request a new one</Link>.</Banner>;
  return (
    <form onSubmit={submit} className="anim-up space-y-5" noValidate>
      <div>
        <h1 className="text-4xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-muted">Choose a strong password you haven't used before.</p>
      </div>
      {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
      <Input label="New password" name="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} hint="At least 8 characters with upper and lower case letters and a number." />
      <Input label="Confirm new password" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirm(e.target.value)} error={fields.confirmPassword} />
      <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
    </form>
  );
}
export default function Reset() {
  return <Suspense><Form /></Suspense>;
}
