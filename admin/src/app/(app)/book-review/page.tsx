"use client";
import { useEffect, useState } from "react";
import { Check, Download, Eye, FileCheck2, X } from "lucide-react";
import { Async, Badge, Banner, Button, Card, EmptyState, PageTitle, Sheet, Skeleton, cx, useToast } from "@/components/ui";
import { Pager, filterInput } from "@/components/table";
import { Prices, StatusBadge, dateFmt } from "@/components/bits";
import { BookThumb } from "@/components/BookBits";
import { Confirm } from "@/components/Confirm";
import { api, ApiFailure, useApi } from "@/lib/client";

const FILTERS = [["pending", "Pending review"], ["approved", "Approved · awaiting sync"], ["rejected", "Rejected"], ["all", "All"]] as const;
const cover = (b: any) => ({ ...b, coverUrl: b.hasCover ? `/api/book-review/${b.id}/cover` : null });

export default function BookReviewPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("pending");
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; books: any[] }>(`/api/book-review?${new URLSearchParams({ filter, ...(dq && { q: dq }), page: String(page) })}`, "We couldn't load the review queue.");
  const [review, setReview] = useState<any>(null);
  const [reject, setReject] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(b: any) {
    setBusy(b.id);
    try {
      const r = await api<{ status: string; warning?: string }>(`/api/book-review/${b.id}/decision`, { method: "POST", json: { action: b.status === "APPROVED" ? "sync" : "approve" } });
      toast(r.warning ? `Approved, but publishing to the Reader is pending: ${r.warning}` : "Approved — the book is now live in the Reader catalogue.", r.warning ? "error" : "success");
      setReview(null); s.reload();
    } catch (e) { toast((e as ApiFailure).message, "error"); }
    setBusy(null);
  }
  return (
    <div>
      <PageTitle title="Book review" sub="Moderation queue for books submitted by publishers. Approving publishes to the Reader." />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Review filter">{FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => { setFilter(k); setPage(1); }} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium", filter === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}</button>)}</div>
      <div className="mb-5"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, publisher" aria-label="Search review queue" className={`${filterInput} w-full sm:w-80`} /></div>
      <Async state={s} skeleton={<div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-52" />)}</div>} isEmpty={(x) => x.books.length === 0} empty={<EmptyState icon={<FileCheck2 className="size-8" />} title={filter === "pending" ? "The review queue is clear." : "Nothing here"} body="Books submitted by publishers will appear here for review." />}>
        {(x) => (<>
          <ul className="space-y-4">{x.books.map((b) => (
            <li key={b.id}><Card className="flex flex-col gap-4 sm:flex-row">
              <div className="w-28 shrink-0 sm:w-32"><BookThumb b={cover(b)} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl font-semibold">{b.title}</h2><StatusBadge status={b.status} /><Badge>{b.isFree ? "Free" : "Paid"}</Badge></div>
                <p className="text-sm text-muted">{b.author} · {b.category} · {b.publisher.name} ({b.publisher.email})</p>
                <p className="mt-1 text-sm"><Prices prices={b.prices} free={b.isFree} /> <span className="text-muted">· uploaded {dateFmt(b.createdAt)} · submitted {dateFmt(b.submittedAt)}</span></p>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{b.description}</p>
                {b.rejectionReason && b.status === "REJECTED" && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">Rejected: {b.rejectionReason}</p>}
                {b.syncError && <div className="mt-2"><Banner tone="warn">Reader sync pending: {b.syncError}</Banner></div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setReview(b)}><Eye className="size-4" /> Review</Button>
                  {b.hasFile && <a href={`/api/book-review/${b.id}/file`} download><Button size="sm" variant="secondary"><Download className="size-4" /> Book file</Button></a>}
                  {b.status === "REVIEWING" && <><Button size="sm" loading={busy === b.id} onClick={() => approve(b)}><Check className="size-4" /> Approve</Button><Button size="sm" variant="danger" onClick={() => setReject(b)}><X className="size-4" /> Reject</Button></>}
                  {b.status === "APPROVED" && <Button size="sm" loading={busy === b.id} onClick={() => approve(b)}>Retry publishing</Button>}
                </div>
              </div>
            </Card></li>))}</ul>
          <Pager page={page} total={x.total} size={25} onPage={setPage} />
        </>)}
      </Async>
      <Sheet open={!!review} onClose={() => setReview(null)} title="Review book">
        {review && <ReviewBody id={review.id} onApprove={() => approve(review)} onReject={() => { setReject(review); setReview(null); }} />}
      </Sheet>
      <Confirm open={!!reject} danger title="Reject this book" confirmLabel="Reject book" onClose={() => setReject(null)} input={{ label: "Rejection reason (shown to the publisher)", min: 5, placeholder: "Explain what needs to change…" }}
        body={<>“{reject?.title}” will return to {reject?.publisher.name} with your reason. They can edit and resubmit.</>}
        onConfirm={async (reason) => { try { await api(`/api/book-review/${reject.id}/decision`, { method: "POST", json: { action: "reject", reason } }); toast("Book rejected. The publisher can see your reason."); s.reload(); } catch (e) { throw new Error((e as ApiFailure).message); } }} />
    </div>
  );
}

function ReviewBody({ id, onApprove, onReject }: { id: string; onApprove: () => void; onReject: () => void }) {
  const s = useApi<{ book: any }>(`/api/book-review/${id}`, "We couldn't load this book.");
  return (
    <Async state={s} skeleton={<Skeleton className="h-64" />}>
      {({ book: b }) => (
        <div className="space-y-4 text-sm">
          <div className="flex gap-4"><div className="w-24 shrink-0"><BookThumb b={cover(b)} /></div><div><h3 className="font-serif text-2xl font-semibold">{b.title}</h3><p className="text-muted">{b.author} · {b.category}</p><p className="mt-1"><StatusBadge status={b.status} /> <Badge>{b.isFree ? "Free" : "Paid"}</Badge></p></div></div>
          <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-muted">Publisher</dt><dd>{b.publisher.name} · {b.publisher.email}</dd></div><div><dt className="text-muted">Price</dt><dd><Prices prices={b.prices} free={b.isFree} /></dd></div><div><dt className="text-muted">File</dt><dd>{b.fileName} ({b.fileKind}, {Math.round(b.fileSize / 1024)} KB, ~{Math.round(b.totalChars / 5).toLocaleString()} words)</dd></div><div><dt className="text-muted">Uploaded</dt><dd>{dateFmt(b.createdAt, true)}</dd></div></dl>
          <div><p className="mb-1 font-medium">Description</p><p className="whitespace-pre-line text-muted">{b.description}</p></div>
          <div><p className="mb-1 font-medium">Text preview</p><p className="max-h-56 overflow-y-auto whitespace-pre-line rounded-2xl bg-surface2 p-3 text-muted">{b.preview}…</p></div>
          <div className="flex flex-wrap gap-2">{b.hasFile && <a href={`/api/book-review/${b.id}/file`} download><Button variant="secondary"><Download className="size-4" /> Download book file</Button></a>}{b.status === "REVIEWING" && <><Button onClick={onApprove}><Check className="size-4" /> Approve</Button><Button variant="danger" onClick={onReject}><X className="size-4" /> Reject</Button></>}</div>
        </div>
      )}
    </Async>
  );
}
