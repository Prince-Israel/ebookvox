"use client";
import { useEffect, useState } from "react";
import { Banner, Button, Input, Select, Sheet, Textarea, useToast } from "./ui";
import { api, ApiFailure, useApi } from "@/lib/client";

export type BookRow = { id: string; title: string; author: string; category: string; description?: string; status: string; isFree: boolean; prices: Record<string, number>; source?: string };
const CUR = ["NGN", "USD", "GBP", "EUR"];

export function BookEditSheet({ book, onClose, onSaved }: { book: BookRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const settings = useApi<{ settings: { categories: string[] } }>(book ? "/api/settings" : null);
  const full = useApi<{ book: BookRow }>(book && book.description === undefined ? `/api/books/${book.id}` : null);
  const [f, setF] = useState({ title: "", author: "", category: "", description: "", status: "APPROVED" });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const src = book?.description === undefined ? full.data?.book : book;
  useEffect(() => {
    if (!src) return;
    setF({ title: src.title, author: src.author, category: src.category, description: src.description ?? "", status: src.status === "ARCHIVED" ? "ARCHIVED" : "APPROVED" });
    setPrices(Object.fromEntries(CUR.map((c) => [c, src.prices[c] ? String(src.prices[c] / 100) : ""])));
    setErr(null);
  }, [src?.id, src?.title]); // eslint-disable-line react-hooks/exhaustive-deps
  // A book has one list price, in the publisher's currency; every reader sees it converted automatically.
  const curs = src ? CUR.filter((c) => src.prices[c] !== undefined) : [];
  const cats = Array.from(new Set([...(settings.data?.settings.categories ?? []), f.category].filter(Boolean)));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const body: any = { title: f.title, author: f.author, category: f.category, description: f.description };
      if (src && !src.isFree) body.prices = Object.fromEntries(curs.filter((c) => Number(prices[c]) > 0).map((c) => [c, Math.round(Number(prices[c]) * 100)]));
      if (src && ["APPROVED", "ARCHIVED"].includes(src.status)) body.status = f.status;
      const r = await api<{ warning?: string }>(`/api/books/${book!.id}`, { method: "PATCH", json: body });
      toast(r.warning ? `Saved, but: ${r.warning}` : "Book saved.", r.warning ? "error" : "success");
      onSaved();
    } catch (x) { setErr((x as ApiFailure).message); }
    setBusy(false);
  }
  return (
    <Sheet open={!!book} onClose={onClose} title="Edit book">
      {!src ? <p className="text-muted">Loading…</p> : (
        <form onSubmit={save} className="space-y-4" noValidate>
          {err && <Banner tone="danger">{err}</Banner>}
          {src.source === "PUBLISHER" && <Banner>This is a publisher book: changes are saved to the Publisher platform and re-published to the Reader.</Banner>}
          <Input label="Title" id="b-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input label="Author" id="b-author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
          <Select label="Category" id="b-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
          <Textarea label="Description" id="b-desc" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          {!src.isFree && <div className="grid gap-3 sm:max-w-xs">{curs.map((c) => <Input key={c} label={`Price (${c}) · converted for readers automatically`} id={`b-p-${c}`} inputMode="decimal" value={prices[c] ?? ""} onChange={(e) => setPrices({ ...prices, [c]: e.target.value.replace(/[^0-9.]/g, "") })} />)}</div>}
          {["APPROVED", "ARCHIVED"].includes(src.status) && <Select label="Catalogue visibility" id="b-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="APPROVED">Visible in the Reader catalogue</option><option value="ARCHIVED">Archived (hidden; owners keep access)</option></Select>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Save changes</Button>
        </form>
      )}
    </Sheet>
  );
}

/** Delete with the "has paid orders → archive instead" fallback. */
export function useDeleteBook(onDone: () => void) {
  const toast = useToast();
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  async function del(archive = false) {
    try {
      const r = await api<{ warning?: string }>(`/api/books/${target!.id}${archive ? "?archive=1" : ""}`, { method: "DELETE" });
      toast(r.warning ?? (archive ? "Book archived." : "Book deleted."), r.warning ? "error" : "success");
      setTarget(null); setBlocked(null); onDone();
    } catch (e) {
      const f = e as ApiFailure;
      if (f.status === 409 && f.fields?.code === "HAS_SALES") setBlocked(f.message);
      else throw new Error(f.message);
    }
  }
  return { target, setTarget, blocked, setBlocked, del };
}
