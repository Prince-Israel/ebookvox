"use client";
import { useState } from "react";
import { Inbox } from "lucide-react";
import { Async, Badge, Button, Card, EmptyState, PageTitle, Skeleton, useToast, when } from "@/components/ui";
import { Composer, STATUS_LABEL, STATUS_TONE, Thread, type Msg } from "@/components/Conversation";
import { api, ApiFailure, useApi } from "@/lib/client";

type T = { id: string; subject: string; status: keyof typeof STATUS_LABEL; updatedAt: string; publisher: string; email: string; lastFrom?: string };

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const s = useApi<{ ticket: { subject: string; status: keyof typeof STATUS_LABEL; publisher: string; email: string; messages: Msg[] } }>(`/api/admin/tickets/${id}`, "We couldn't load this ticket.");
  const toast = useToast();
  async function setStatus(status: string) { try { await api(`/api/admin/tickets/${id}`, { method: "POST", json: { status } }); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); } }
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>← All tickets</Button>
      <Async state={s} skeleton={<Skeleton className="h-64" />}>
        {({ ticket }) => (<>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{ticket.subject}</h2><Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge><span className="text-sm text-muted">{ticket.publisher} · {ticket.email}</span></div>
          <Card><Thread messages={ticket.messages} viewer="ADMIN" /></Card>
          <div className="flex flex-wrap gap-2">{(["OPEN", "WAITING_PUBLISHER", "WAITING_ADMIN", "CLOSED"] as const).map((st) => <Button key={st} size="sm" variant={ticket.status === st ? "primary" : "secondary"} onClick={() => setStatus(st)}>{STATUS_LABEL[st]}</Button>)}</div>
          <Composer url={`/api/admin/tickets/${id}`} closed={ticket.status === "CLOSED"} onSent={s.reload} placeholder="Reply as Ebookvox Admin…" />
        </>)}
      </Async>
    </div>
  );
}

export default function AdminSupport() {
  const s = useApi<{ tickets: T[] }>("/api/admin/tickets", "We couldn't load tickets. Please try again.");
  const [sel, setSel] = useState<string | null>(null);
  if (sel) return <Detail id={sel} onBack={() => { setSel(null); s.reload(); }} />;
  return (
    <div>
      <PageTitle title="Support" sub="Publisher tickets" />
      <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.tickets.length === 0} empty={<EmptyState icon={<Inbox className="size-8" />} title="No tickets" body="Publisher tickets will appear here." />}>
        {(d) => (<ul className="space-y-3">{d.tickets.map((t) => (
          <li key={t.id}><button onClick={() => setSel(t.id)} className="flex w-full flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left hover:bg-surface2">
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.subject}</p><p className="text-sm text-muted">{t.publisher} · {t.email} · {when(t.updatedAt)}</p></div>
            {t.lastFrom === "PUBLISHER" && t.status !== "CLOSED" && <Badge tone="danger">Needs reply</Badge>}<Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></button></li>))}</ul>)}
      </Async>
    </div>
  );
}
