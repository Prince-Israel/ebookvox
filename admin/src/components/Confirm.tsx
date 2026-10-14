"use client";
import { useState, type ReactNode } from "react";
import { Banner, Button, Sheet, Textarea } from "./ui";

/** Confirmation dialog; optionally collects a required text value (e.g. a rejection reason). */
export function Confirm({ open, title, body, confirmLabel, danger, onClose, onConfirm, input }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: (value: string) => Promise<void>; input?: { label: string; min?: number; placeholder?: string } }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tooShort = !!input && v.trim().length < (input.min ?? 1);
  async function go() {
    setBusy(true); setErr(null);
    try { await onConfirm(v.trim()); setV(""); onClose(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <Sheet open={open} onClose={() => { setErr(null); onClose(); }} title={title}>
      <div className="space-y-4">
        <div className="text-muted">{body}</div>
        {input && <Textarea label={input.label} id="confirm-input" rows={4} value={v} onChange={(e) => setV(e.target.value)} placeholder={input.placeholder} />}
        {err && <Banner tone="danger">{err}</Banner>}
        <div className="flex gap-3"><Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} className="flex-1" loading={busy} disabled={tooShort} onClick={go}>{confirmLabel}</Button></div>
      </div>
    </Sheet>
  );
}
