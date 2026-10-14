"use client";
import { useState } from "react";
import { BookCheck, Inbox, LayoutDashboard, PlusCircle, Receipt } from "lucide-react";
import { Async, Badge, Banner, Button, Card, EmptyState, Input, PageTitle, Select, Skeleton, Textarea, cx, useToast, when } from "@/components/ui";
import { Composer, STATUS_LABEL, STATUS_TONE, Thread, type Msg } from "@/components/Conversation";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

const TABS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "books", label: "Books", Icon: BookCheck },
  { id: "add", label: "Add book", Icon: PlusCircle },
  { id: "tickets", label: "Support", Icon: Inbox },
  { id: "orders", label: "Orders", Icon: Receipt },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  return (
    <div>
      <PageTitle title="Admin console" sub="Approve publisher books, answer support and watch payments." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx("inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium", tab === id ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}><Icon className="size-4" /> {label}</button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "books" && <Books />}
      {tab === "add" && <AddBook />}
      {tab === "tickets" && <Tickets />}
      {tab === "orders" && <Orders />}
    </div>
  );
}

function Overview() {
  const s = useApi<{ users: number; pendingBooks: number; approvedBooks: number; orders: number; openTickets: number; revenue: Array<{ currency: string; amountMinor: number; count: number }> }>("/api/admin/stats", "We couldn't load statistics.");
  return (
    <Async state={s} skeleton={<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>}>
      {(d) => (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[["Readers", d.users], ["Live books", d.approvedBooks], ["Awaiting approval", d.pendingBooks], ["Orders", d.orders], ["Open tickets", d.openTickets]].map(([l, v]) => (
            <Card key={l as string}><p className="text-sm text-muted">{l}</p><p className="mt-1 font-serif text-4xl font-semibold">{v}</p></Card>
          ))}
          <Card><p className="text-sm text-muted">Paid revenue</p>{d.revenue.length === 0 ? <p className="mt-1 text-lg text-muted">No sales yet</p> : d.revenue.map((r) => <p key={r.currency} className="mt-1 font-serif text-xl font-semibold">{formatMoney(r.amountMinor, r.currency)} <span className="text-sm font-normal text-muted">· {r.count} orders</span></p>)}</Card>
        </div>
      )}
    </Async>
  );
}

type AB = { id: string; title: string; author: string; category: string; status: string; isFree: boolean; publisher: string; chapterCount: number; readers: number; rejectionReason: string | null; prices: Record<string, number> };
function Books() {
  const s = useApi<{ books: AB[] }>("/api/admin/books", "We couldn't load books.");
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(id: string, action: "approve" | "reject" | "unpublish") {
    let reason: string | undefined;
    if (action === "reject") { reason = window.prompt("Reason for rejection (shown to the publisher):") ?? undefined; if (reason === undefined) return; }
    setBusy(id + action);
    try { await api(`/api/admin/books/${id}`, { method: "POST", json: { action, reason } }); toast(action === "approve" ? "Approved — it's now live in Reader." : action === "reject" ? "Book rejected." : "Book unpublished."); s.reload(); }
    catch (e) { toast((e as ApiFailure).message, "error"); }
    setBusy(null);
  }
  const tone = { APPROVED: "success", PENDING: "warn", REJECTED: "danger" } as const;
  return (
    <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.books.length === 0} empty={<EmptyState icon={<BookCheck className="size-8" />} title="No books yet" body="Books submitted by the Publisher platform arrive here for approval." />}>
      {(d) => (
        <ul className="space-y-3">
          {[...d.books].sort((a, b) => (a.status === "PENDING" ? -1 : 0) - (b.status === "PENDING" ? -1 : 0)).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-serif text-lg font-semibold">{b.title}</p><Badge tone={tone[b.status as keyof typeof tone]}>{b.status}</Badge><Badge>{b.isFree ? "FREE" : "PAID"}</Badge></div>
                <p className="text-sm text-muted">{b.author} · {b.category} · {b.publisher} · {b.chapterCount} chapters · {b.readers} readers</p>
                {!b.isFree && <p className="text-xs text-muted">{Object.entries(b.prices).map(([c, v]) => formatMoney(v, c)).join("  ·  ")}</p>}
                {b.rejectionReason && <p className="text-xs text-danger">Rejected: {b.rejectionReason}</p>}
              </div>
              <div className="flex gap-2">
                {b.status !== "APPROVED" && <Button size="sm" loading={busy === b.id + "approve"} onClick={() => act(b.id, "approve")}>Approve</Button>}
                {b.status === "PENDING" && <Button size="sm" variant="danger" onClick={() => act(b.id, "reject")}>Reject</Button>}
                {b.status === "APPROVED" && <Button size="sm" variant="secondary" onClick={() => act(b.id, "unpublish")}>Unpublish</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Async>
  );
}

function AddBook() {
  const toast = useToast();
  const [f, setF] = useState({ title: "", author: "", category: "", description: "", publisherName: "Ebookvox", isFree: true, NGN: "", GBP: "", EUR: "", USD: "", text: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // "# Heading" lines start a new chapter; everything else is the chapter body.
    const parts = f.text.split(/^# (.+)$/m);
    const chapters: Array<{ title: string; content: string }> = [];
    if (parts[0].trim()) chapters.push({ title: "Chapter 1", content: parts[0].trim() });
    for (let i = 1; i < parts.length; i += 2) if (parts[i + 1]?.trim()) chapters.push({ title: parts[i].trim(), content: parts[i + 1].trim() });
    const minor = (v: string) => Math.round(Number(v) * 100);
    try {
      await api("/api/admin/books", { method: "POST", json: { publisherId: "ebookvox-admin", publisherName: f.publisherName, title: f.title, author: f.author, category: f.category, description: f.description, isFree: f.isFree, prices: f.isFree ? undefined : { NGN: minor(f.NGN), GBP: minor(f.GBP), EUR: minor(f.EUR), USD: minor(f.USD) }, chapters } });
      toast("Book published to Reader.");
      setF({ ...f, title: "", author: "", description: "", text: "" });
    } catch (err) { setError((err as ApiFailure).message); }
    setBusy(false);
  }
  return (
    <Card>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Banner tone="danger">{error}</Banner>}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Title" value={f.title} onChange={set("title")} /><Input label="Author" value={f.author} onChange={set("author")} /><Input label="Category" value={f.category} onChange={set("category")} /><Input label="Publisher" value={f.publisherName} onChange={set("publisherName")} /></div>
        <Textarea label="Description" rows={3} value={f.description} onChange={set("description")} />
        <Select label="Pricing" value={f.isFree ? "free" : "paid"} onChange={(e) => setF({ ...f, isFree: e.target.value === "free" })}><option value="free">Free</option><option value="paid">Paid</option></Select>
        {!f.isFree && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{(["NGN", "GBP", "EUR", "USD"] as const).map((c) => <Input key={c} label={`${c} price`} type="number" min="0" step="0.01" inputMode="decimal" value={f[c]} onChange={set(c)} />)}</div>}
        <Textarea label="Book text" rows={10} value={f.text} onChange={set("text")} hint='Separate paragraphs with a blank line. Start a new chapter with a line like "# Chapter title".' />
        <Button type="submit" loading={busy}>Publish book</Button>
      </form>
    </Card>
  );
}

type AT = { id: string; subject: string; status: keyof typeof STATUS_LABEL; updatedAt: string; user: string; email: string; lastFrom?: string };
function Tickets() {
  const s = useApi<{ tickets: AT[] }>("/api/admin/tickets", "We couldn't load tickets.");
  const [sel, setSel] = useState<string | null>(null);
  if (sel) return <TicketDetail id={sel} onBack={() => { setSel(null); s.reload(); }} />;
  return (
    <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.tickets.length === 0} empty={<EmptyState icon={<Inbox className="size-8" />} title="No tickets" body="Customer tickets will appear here." />}>
      {(d) => (
        <ul className="space-y-3">
          {d.tickets.map((t) => (
            <li key={t.id}><button onClick={() => setSel(t.id)} className="flex w-full flex-wrap items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left hover:bg-surface2">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.subject}</p><p className="text-sm text-muted">{t.user} · {t.email} · {when(t.updatedAt)}</p></div>
              {t.lastFrom === "USER" && t.status !== "CLOSED" && <Badge tone="danger">Needs reply</Badge>}
              <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
            </button></li>
          ))}
        </ul>
      )}
    </Async>
  );
}

function TicketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const s = useApi<{ ticket: { subject: string; status: keyof typeof STATUS_LABEL; user: string; email: string; messages: Msg[] } }>(`/api/admin/tickets/${id}`, "We couldn't load this ticket.");
  const toast = useToast();
  async function setStatus(status: string) {
    try { await api(`/api/admin/tickets/${id}`, { method: "POST", json: { status } }); s.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); }
  }
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>← All tickets</Button>
      <Async state={s} skeleton={<Skeleton className="h-64" />}>
        {({ ticket }) => (
          <>
            <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{ticket.subject}</h2><Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge><span className="text-sm text-muted">{ticket.user} · {ticket.email}</span></div>
            <Card><Thread messages={ticket.messages} viewer="ADMIN" /></Card>
            <div className="flex flex-wrap gap-2">{(["OPEN", "WAITING_USER", "CLOSED"] as const).map((st) => <Button key={st} size="sm" variant={ticket.status === st ? "primary" : "secondary"} onClick={() => setStatus(st)}>{STATUS_LABEL[st]}</Button>)}</div>
            <AdminReply id={id} closed={ticket.status === "CLOSED"} onSent={s.reload} />
          </>
        )}
      </Async>
    </div>
  );
}

function AdminReply({ id, closed, onSent }: { id: string; closed: boolean; onSent: () => void }) {
  // Replying hands the ticket back to the customer ("Waiting for User"). To write on a closed ticket, reopen it first.
  return <Composer url={`/api/admin/tickets/${id}`} closed={closed} onSent={onSent} placeholder="Reply as Ebookvox Support…" />;
}

function Orders() {
  const s = useApi<{ orders: Array<{ id: string; number: string; reference: string; status: string; amountMinor: number; currency: string; createdAt: string; email: string; book: string }> }>("/api/admin/orders", "We couldn't load orders.");
  const tone = { PAID: "success", PENDING: "warn", FAILED: "danger" } as const;
  return (
    <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.orders.length === 0} empty={<EmptyState icon={<Receipt className="size-8" />} title="No orders" body="Orders will appear here." />}>
      {(d) => (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface2 text-xs uppercase tracking-wider text-muted"><tr>{["Order", "Book", "Customer", "Amount", "Status", "Date"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{d.orders.map((o) => <tr key={o.id}><td className="px-4 py-3 font-mono text-xs">{o.number}</td><td className="px-4 py-3">{o.book}</td><td className="px-4 py-3">{o.email}</td><td className="px-4 py-3 font-semibold">{formatMoney(o.amountMinor, o.currency)}</td><td className="px-4 py-3"><Badge tone={tone[o.status as keyof typeof tone]}>{o.status}</Badge></td><td className="px-4 py-3 text-muted">{when(o.createdAt)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Async>
  );
}
