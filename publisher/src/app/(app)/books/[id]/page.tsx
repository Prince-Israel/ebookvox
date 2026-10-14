"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Check, CircleDot, FileText, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Async, Banner, Button, Card, Skeleton, cx, useToast } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { StatusBadge, dateFmt } from "@/components/bits";
import type { BookDto } from "@/components/BookForm";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type D = { book: BookDto & { submittedAt: string | null; approvedAt: string | null; publishedAt: string | null; createdAt: string; updatedAt: string; totalChars: number }; salesCount: number };

export default function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const state = useApi<D>(`/api/books/${id}`, "We couldn't load this book. Please try again.");
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast(ok); state.reload(); } catch (e) { toast((e as ApiFailure).message, "error"); }
    setBusy(false);
  }
  return (
    <div>
      <Link href="/books" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> My Books</Link>
      <Async state={state} skeleton={<div className="grid gap-8 md:grid-cols-[16rem_1fr]"><Skeleton className="aspect-[2/3]" /><Skeleton className="h-96" /></div>}>
        {({ book: b, salesCount }) => {
          const editable = ["DRAFT", "REJECTED"].includes(b.status);
          const steps = [["Draft", true], ["Submitted", !!b.submittedAt], ["Admin review", ["APPROVED", "PUBLISHED", "REJECTED"].includes(b.status)], ["Approved", ["APPROVED", "PUBLISHED"].includes(b.status)], ["Published", b.status === "PUBLISHED"]] as const;
          return (
            <div className="anim-up grid gap-8 md:grid-cols-[16rem_1fr] md:gap-10">
              <div className="mx-auto w-full max-w-[14rem] md:mx-0 md:max-w-none"><Cover title={b.title} author={b.author} hue={25} url={b.coverUrl} /></div>
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /><span className="text-sm text-muted">{b.category}</span></div>
                  <h1 className="text-4xl font-semibold leading-tight">{b.title}</h1>
                  <p className="mt-1 text-lg text-muted">by {b.author}</p>
                </div>
                {b.status === "REJECTED" && <Banner tone="danger"><strong>Rejected by Admin:</strong> {b.rejectionReason}</Banner>}
                {b.status === "APPROVED" && <Banner tone="warn">Approved. We're syncing it to the Reader catalogue{(b as any).syncError ? ` — last attempt: ${(b as any).syncError}` : "…"}</Banner>}
                {b.status === "PUBLISHED" && <Banner tone="success">Live in the Reader catalogue · {salesCount} {salesCount === 1 ? "sale" : "sales"}</Banner>}
                <ol className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Progress">
                  {steps.map(([l, done]) => <li key={l} className={cx("flex items-center gap-1.5 text-sm", done ? "font-medium text-fg" : "text-muted")}>{done ? <Check className="size-4 text-success" /> : <CircleDot className="size-4" />}{l}</li>)}
                  {b.status === "REJECTED" && <li className="flex items-center gap-1.5 text-sm font-medium text-danger"><X className="size-4" /> Rejected</li>}
                </ol>
                <Card>
                  <h2 className="mb-2 text-xl font-semibold">Description</h2>
                  <p className="whitespace-pre-line text-muted">{b.description || "—"}</p>
                </Card>
                <Card>
                  <h2 className="mb-3 text-xl font-semibold">Pricing</h2>
                  {b.isFree ? <p className="font-serif text-2xl font-semibold">FREE</p> : (
                    <div><p className="font-serif text-2xl font-semibold">{b.prices[b.currency] ? formatMoney(b.prices[b.currency], b.currency) : "Not set"}</p><p className="mt-1 text-sm text-muted">Your price in {b.currency}. Readers see it converted to their own currency automatically.</p></div>
                  )}
                </Card>
                <Card>
                  <dl className="grid gap-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted">Book file</dt><dd className="flex items-center gap-2 font-medium"><FileText className="size-4 text-accent" /> {b.fileName ?? "—"}</dd></div>
                    <div><dt className="text-muted">Length</dt><dd className="font-medium">{b.totalChars ? `~${Math.round(b.totalChars / 5).toLocaleString()} words` : "—"}</dd></div>
                    <div><dt className="text-muted">Uploaded</dt><dd>{dateFmt(b.createdAt, true)}</dd></div>
                    <div><dt className="text-muted">Last updated</dt><dd>{dateFmt(b.updatedAt, true)}</dd></div>
                    <div><dt className="text-muted">Submitted</dt><dd>{dateFmt(b.submittedAt, true)}</dd></div>
                    <div><dt className="text-muted">Published</dt><dd>{dateFmt(b.publishedAt, true)}</dd></div>
                  </dl>
                </Card>
                <div className="flex flex-wrap gap-3">
                  {editable && <Link href={`/books/${b.id}/edit`}><Button variant="secondary"><Pencil className="size-4" /> Edit</Button></Link>}
                  {b.status === "DRAFT" && <Button loading={busy} onClick={() => act(() => api(`/api/books/${b.id}/submit`, { method: "POST" }), "Submitted for review.")}>Submit for Review</Button>}
                  {b.status === "REJECTED" && <Button loading={busy} onClick={() => act(() => api(`/api/books/${b.id}/submit`, { method: "POST" }), "Resubmitted for review.")}><RotateCw className="size-4" /> Resubmit</Button>}
                  {editable && <Button variant="danger" onClick={async () => { if (confirm(`Delete “${b.title}”? This can't be undone.`)) { try { await api(`/api/books/${b.id}`, { method: "DELETE" }); router.push("/books"); } catch (e) { toast((e as ApiFailure).message, "error"); } } }}><Trash2 className="size-4" /> Delete</Button>}
                </div>
              </div>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
