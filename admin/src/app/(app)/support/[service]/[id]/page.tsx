"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Async, Badge, Banner, Button, Card, Skeleton, Textarea, cx, useToast } from "@/components/ui";
import { StatusBadge, dateFmt } from "@/components/bits";
import { api, ApiFailure, useApi } from "@/lib/client";

export default function TicketPage({ params }: { params: Promise<{ service: string; id: string }> }) {
  const { service, id } = use(params);
  const toast = useToast();
  const s = useApi<{ ticket: any }>(`/api/support/${service}/${id}`, "We couldn't load this conversation.");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => document.visibilityState === "visible" && s.reload(), 15000); return () => clearInterval(t); }, [s.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [s.data?.ticket.messages.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!msg.trim()) return;
    setBusy(true);
    try { await api(`/api/support/${service}/${id}/reply`, { method: "POST", json: { message: msg } }); setMsg(""); toast("Reply sent."); s.reload(); } catch (x) { toast((x as ApiFailure).message, "error"); s.reload(); }
    setBusy(false);
  }
  async function setStatus(status: string) { try { await api(`/api/support/${service}/${id}/status`, { method: "POST", json: { status } }); toast("Status updated."); s.reload(); } catch (x) { toast((x as ApiFailure).message, "error"); } }
  const statuses = service === "reader" ? [["OPEN", "Open"], ["WAITING_USER", "Waiting for User"], ["CLOSED", "Closed"]] : [["OPEN", "Open"], ["WAITING_PUBLISHER", "Waiting for Publisher"], ["CLOSED", "Closed"]];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/support" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Support</Link>
      <Async state={s} skeleton={<Skeleton className="h-96" />}>
        {({ ticket: t }) => (
          <div className="space-y-5">
            <div><div className="mb-1 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold">{t.subject}</h1><StatusBadge status={t.status} /><Badge tone={service === "publisher" ? "accent" : "neutral"}>{t.userType}</Badge></div><p className="text-sm text-muted">{t.name} · {t.email}</p></div>
            <Card><ul className="space-y-4" aria-label="Conversation">{t.messages.map((m: any) => (
              <li key={m.id} className={cx("flex flex-col", m.from === "ADMIN" ? "items-end" : "items-start")}>
                <div className={cx("max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-5 py-3 sm:max-w-[75%]", m.from === "ADMIN" ? "rounded-br-lg bg-primary text-primary-fg" : "rounded-bl-lg bg-surface2")}>{m.body}</div>
                <span className="mt-1 px-2 text-xs text-muted">{m.from === "ADMIN" ? `${m.author} (admin)` : m.author} · {dateFmt(m.createdAt, true)}</span>
              </li>))}<div ref={end} /></ul></Card>
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Status:</span>{statuses.map(([k, l]) => <Button key={k} size="sm" variant={t.status === k ? "primary" : "secondary"} onClick={() => setStatus(k)}>{l}</Button>)}</div>
            {t.status === "CLOSED" ? <Banner>This ticket is closed, so replies are turned off. Reopen it (set the status to Open) to continue the conversation.</Banner> : (
              <form onSubmit={send} className="space-y-3"><Textarea label="Reply" id="admin-reply" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write your reply…" /><Button type="submit" loading={busy} disabled={!msg.trim()}><Send className="size-4" /> Send reply</Button></form>
            )}
          </div>
        )}
      </Async>
    </div>
  );
}
