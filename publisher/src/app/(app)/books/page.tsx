"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Eye, Pencil, RotateCw, Trash2, Upload } from "lucide-react";
import { Async, Button, Card, EmptyState, PageTitle, Sheet, Skeleton, cx, useToast } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { StatusBadge, dateFmt } from "@/components/bits";
import { api, ApiFailure, useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type B = { id: string; title: string; author: string; category: string; isFree: boolean; status: string; rejectionReason: string | null; coverUrl: string | null; prices: Record<string, number>; createdAt: string; updatedAt: string };
const TABS = [["all", "All", ""], ["approved", "Approved", "APPROVED,PUBLISHED"], ["reviewing", "Under Review", "REVIEWING"], ["rejected", "Rejected", "REJECTED"], ["drafts", "Drafts", "DRAFT"]] as const;

function List() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const tab = TABS.find((t) => t[0] === sp.get("tab")) ?? TABS[0];
  const state = useApi<{ books: B[]; currency: string; counts: Record<string, number> }>("/api/books", "We couldn't load your books. Please try again.");
  const [del, setDel] = useState<B | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function resubmit(b: B) {
    setBusy(b.id);
    try { await api(`/api/books/${b.id}/submit`, { method: "POST" }); toast("Resubmitted for review."); state.reload(); }
    catch (e) { toast((e as ApiFailure).message, "error"); if ((e as ApiFailure).status === 422) router.push(`/books/${b.id}/edit`); }
    setBusy(null);
  }
  async function remove() {
    if (!del) return;
    setBusy(del.id);
    try { await api(`/api/books/${del.id}`, { method: "DELETE" }); toast("Book deleted."); setDel(null); state.reload(); }
    catch (e) { toast((e as ApiFailure).message, "error"); }
    setBusy(null);
  }

  const count = (s: string) => (s ? s.split(",").reduce((n, k) => n + (state.data?.counts[k] ?? 0), 0) : Object.values(state.data?.counts ?? {}).reduce((a, b) => a + b, 0));
  const shown = state.data?.books.filter((b) => !tab[2] || tab[2].split(",").includes(b.status)) ?? [];
  return (
    <div>
      <PageTitle title="My Books" action={<Link href="/books/new"><Button><Upload className="size-5" /> Upload book</Button></Link>} />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Book status">
        {TABS.map(([k, l, s]) => <Link key={k} href={k === "all" ? "/books" : `/books?tab=${k}`} role="tab" aria-selected={tab[0] === k} className={cx("inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium transition", tab[0] === k ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>{l}{state.data && <span className={cx("rounded-full px-2 text-xs", tab[0] === k ? "bg-white/20" : "bg-surface")}>{count(s)}</span>}</Link>)}
      </div>
      <Async state={state} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
        isEmpty={() => shown.length === 0}
        empty={<EmptyState icon={<BookOpen className="size-8" />} title={tab[0] === "all" ? "No books yet" : `No ${tab[1].toLowerCase()} books`} body={tab[0] === "all" ? "Upload your first book to get started." : "Books will appear here as they move through review."} action={tab[0] === "all" ? <Link href="/books/new"><Button>Upload a book</Button></Link> : undefined} />}>
        {(d) => (
          <ul className="space-y-3">
            {shown.map((b) => (
              <li key={b.id}>
                <Card className="flex gap-4 p-4 sm:p-5">
                  <Link href={`/books/${b.id}`} className="w-20 shrink-0 sm:w-24"><Cover title={b.title} author={b.author} hue={25} url={b.coverUrl} /></Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link href={`/books/${b.id}`} className="min-w-0 font-serif text-xl font-semibold leading-snug hover:underline">{b.title}</Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted">{b.author} · {b.category}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      <div><dt className="text-muted">Price</dt><dd className="font-semibold">{b.isFree ? "FREE" : b.prices[d.currency] ? formatMoney(b.prices[d.currency], d.currency) : "Not set"}</dd></div>
                      <div><dt className="text-muted">Currency</dt><dd>{b.isFree ? "—" : d.currency}</dd></div>
                      <div><dt className="text-muted">Uploaded</dt><dd>{dateFmt(b.createdAt)}</dd></div>
                      <div><dt className="text-muted">Updated</dt><dd>{dateFmt(b.updatedAt)}</dd></div>
                    </dl>
                    {b.status === "REJECTED" && b.rejectionReason && <p className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"><strong>Admin:</strong> {b.rejectionReason}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/books/${b.id}`}><Button size="sm" variant="secondary"><Eye className="size-4" /> View</Button></Link>
                      {["DRAFT", "REJECTED"].includes(b.status) && <Link href={`/books/${b.id}/edit`}><Button size="sm" variant="secondary"><Pencil className="size-4" /> Edit</Button></Link>}
                      {b.status === "REJECTED" && <Button size="sm" loading={busy === b.id} onClick={() => resubmit(b)}><RotateCw className="size-4" /> Resubmit</Button>}
                      {["DRAFT", "REJECTED"].includes(b.status) && <Button size="sm" variant="danger" onClick={() => setDel(b)}><Trash2 className="size-4" /> Delete</Button>}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Sheet open={!!del} onClose={() => setDel(null)} title="Delete this book?">
        <p className="text-muted">“{del?.title}” will be permanently deleted, including its cover and file. This can't be undone.</p>
        <div className="mt-6 flex gap-3"><Button variant="secondary" className="flex-1" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" className="flex-1" loading={busy === del?.id} onClick={remove}>Delete book</Button></div>
      </Sheet>
    </div>
  );
}
export default function BooksPage() { return <Suspense><List /></Suspense>; }
