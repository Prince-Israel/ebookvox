"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Banner, Button, Input, Sheet } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { usePlayback } from "@/components/audio/PlaybackProvider";
import { api, ApiFailure } from "@/lib/client";

/** "Delete account" on the Profile page: confirm by typing DELETE (and the password, when the account has one). */
export function DeleteAccount() {
  const { user } = useUser();
  const pb = usePlayback();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      (window as unknown as { __signingOut?: boolean }).__signingOut = true;
      pb.stop();
      await api("/api/me", { method: "DELETE", json: { confirm, password } });
      try { localStorage.removeItem("ev-theme"); } catch {}
      window.location.href = "/sign-in";
    } catch (err) {
      (window as unknown as { __signingOut?: boolean }).__signingOut = false;
      const f = err as ApiFailure;
      setError(f.message);
      setFields(f.fields ?? {});
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="mx-auto mt-6 flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted hover:bg-danger-soft hover:text-danger">
        <Trash2 className="size-4" /> Delete account
      </button>
      <Sheet open={open} onClose={() => !busy && setOpen(false)} title="Delete your account">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Banner tone="danger">This permanently deletes your account, library, uploaded documents and support messages. It can’t be undone, and any wallet balance or subscription time left is lost.</Banner>
          {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
          {user?.hasPassword && <Input label="Your password" id="del-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} />}
          <Input label="Type DELETE to confirm" id="del-confirm" autoCapitalize="characters" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="danger" loading={busy} disabled={confirm.trim().toUpperCase() !== "DELETE"}>Delete my account</Button>
          </div>
          <p className="text-center text-xs text-muted">Details of what is deleted and kept: <a href="/delete-account" target="_blank" rel="noopener" className="font-medium text-accent underline">how account deletion works</a>.</p>
        </form>
      </Sheet>
    </>
  );
}
