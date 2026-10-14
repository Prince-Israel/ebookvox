"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileCheck2 } from "lucide-react";
import { Async, Badge, Banner, Button, Card, EmptyState, PageTitle, Sheet, Skeleton, Textarea, useToast } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { StatusBadge, dateFmt } from "@/components/bits";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type B = { id: string; title: string; author: string; category: string; description: string; isFree: boolean; status: string; syncError: string | null; fileName: string | null; totalChars: number; submittedAt: string; coverUrl: string | null; publisher: { publisherName: string; email: string; country: string }; prices: Record<string, number>; preview: string };

function Queue() {
  const all = useSearchParams().get("s") === "all";
  const state = useApi<{ books: B[] }>(`/api/admin/review?status=${all ? "REVIEWING,APPROVED,PUBLISHED,REJECTED" : "REVIEWING,APPROVED"}`, "We couldn't load the review queue. Please try again.");
  const toast = useToast();
  const [rej, setRej] = useState<B | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function decide(b: B, action: "approve" | "reject" | "sync") {
    setBusy(b.id + action); setErr(null);
    try {
      const r = await api<{ status: string; warning?: string }>(`/api/admin/review/${b.id}`, { method: "POST", json: { action, reason } });
      toast(r.warning ? `Approved, but sync is pending: ${r.warning}` : action === "reject" ? "Book rejected — the publisher can see your reason." : "Approved and published to the Reader catalogue.", r.warning ? "error" : "success");
      setRej(null); setReason(""); state.reload();
    } catch (e) { setErr((e as ApiFailure).message); if (action !== "reject") toast((e as ApiFailure).message, "error"); }
    setBusy(null);
  }
  return (
    <div>
      <PageTitle title="Book review" sub="Approving publishes the book to the Reader catalogue." />
      <Async state={state} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.books.length === 0} empty={<EmptyState icon={<FileCheck2 className="size-8" />} title="Queue is clear" body="New submissions from publishers will appear here." />}>
        {(d) => (
          <ul className="space-y-4">{d.books.map((b) => (
            <li key={b.id}><Card className="flex flex-col gap-4 sm:flex-row">
              <div className="w-28 shrink-0"><Cover title={b.title} author={b.author} hue={25} url={b.coverUrl} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl font-semibold">{b.title}</h2><StatusBadge status={b.status} /><Badge>{b.isFree ? "FREE" : "PAID"}</Badge></div>
                <p className="text-sm text-muted">{b.author} · {b.category} · by {b.publisher.publisherName} ({b.publisher.email}) · submitted {dateFmt(b.submittedAt)}</p>
                {!b.isFree && <p className="mt-1 text-sm">{Object.entries(b.prices).map(([c, v]) => formatMoney(v, c)).join("  ·  ")}</p>}
                <p className="mt-2 line-clamp-3 text-sm text-muted">{b.description}</p>
                <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium text-accent">Preview text ({b.fileName}, ~{Math.round(b.totalChars / 5).toLocaleString()} words)</summary><p className="mt-2 whitespace-pre-line rounded-2xl bg-surface2 p-3 text-muted">{b.preview}…</p></details>
                {b.syncError && <div className="mt-3"><Banner tone="warn">Sync pending: {b.syncError}</Banner></div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {b.status === "REVIEWING" && <><Button size="sm" loading={busy === b.id + "approve"} onClick={() => decide(b, "approve")}>Approve</Button><Button size="sm" variant="danger" onClick={() => { setRej(b); setErr(null); }}>Reject</Button></>}
                  {b.status === "APPROVED" && <Button size="sm" loading={busy === b.id + "sync"} onClick={() => decide(b, "sync")}>Retry publishing</Button>}
                </div>
              </div>
            </Card></li>))}</ul>
        )}
      </Async>
      <Sheet open={!!rej} onClose={() => setRej(null)} title="Reject book">
        <p className="mb-3 text-muted">The publisher will see this reason and can edit and resubmit “{rej?.title}”.</p>
        {err && <div className="mb-3"><Banner tone="danger">{err}</Banner></div>}
        <Textarea label="Reason for rejection" id="rej-reason" rows={5} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setRej(null)}>Cancel</Button><Button variant="danger" className="flex-1" loading={!!busy} onClick={() => rej && decide(rej, "reject")}>Reject book</Button></div>
      </Sheet>
    </div>
  );
}
export default function ReviewPage() { return <Suspense><Queue /></Suspense>; }
