"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LifeBuoy, Plus } from "lucide-react";
import { Async, Badge, Banner, Button, EmptyState, Input, PageTitle, Sheet, Skeleton, Textarea, useToast, when } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE } from "@/components/Conversation";
import { api, ApiFailure, useApi } from "@/lib/client";

type T = { id: string; subject: string; status: keyof typeof STATUS_LABEL; updatedAt: string; lastMessage: string; lastFrom: string };

export default function SupportPage() {
  const state = useApi<{ tickets: T[] }>("/api/tickets", "We couldn't load your tickets. Please try again.");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFields({}); setError(null);
    try { const d = await api<{ ticket: { id: string } }>("/api/tickets", { method: "POST", json: { subject, message } }); toast("Ticket created."); router.push(`/support/${d.ticket.id}`); }
    catch (err) { setFields((err as ApiFailure).fields ?? {}); setError((err as ApiFailure).message); setBusy(false); }
  }
  return (
    <div>
      <PageTitle title="Support" sub="Questions about reviews, sales or payouts? Our admin team will help." action={<Button onClick={() => setOpen(true)}><Plus className="size-5" /> New ticket</Button>} />
      <Async state={state} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>} isEmpty={(d) => d.tickets.length === 0}
        empty={<EmptyState icon={<LifeBuoy className="size-8" />} title="No tickets yet" body="Create a ticket and we'll reply inside this conversation." action={<Button onClick={() => setOpen(true)}>Contact Admin</Button>} />}>
        {(d) => (
          <ul className="space-y-3">{d.tickets.map((t) => (
            <li key={t.id}><Link href={`/support/${t.id}`} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 sm:p-5">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{t.subject}</p><Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge></div>
                <p className="mt-1 truncate text-sm text-muted">{t.lastFrom === "ADMIN" ? "Admin: " : "You: "}{t.lastMessage}</p><p className="mt-1 text-xs text-muted">Updated {when(t.updatedAt)}</p></div>
              <ChevronRight className="size-5 shrink-0 text-muted" /></Link></li>))}</ul>
        )}
      </Async>
      <Sheet open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form onSubmit={create} className="space-y-4" noValidate>
          {error && Object.keys(fields).length === 0 && <Banner tone="danger">{error}</Banner>}
          <Input label="Subject" id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={fields.subject} maxLength={120} />
          <Textarea label="Message" id="t-message" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} error={fields.message} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Submit ticket</Button>
        </form>
      </Sheet>
    </div>
  );
}
