"use client";
import { useEffect, useState } from "react";
import { BookOpen, Eye, Pencil, Trash2 } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Sheet, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { Prices, StatusBadge, dateFmt } from "@/components/bits";
import { BookThumb, DeleteBookDialog } from "@/components/BookBits";
import { BookEditSheet, useDeleteBook, type BookRow } from "@/components/BookEdit";
import { useApi } from "@/lib/client";

const cover = (b: any) => ({ ...b, coverUrl: b.hasCover ? `/api/book-review/${b.id}/cover` : null });

export default function PublisherBooksPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; books: any[] }>(`/api/publisher-books?${new URLSearchParams({ ...(dq && { q: dq }), page: String(page) })}`, "We couldn't load Publisher books.");
  const [view, setView] = useState<any>(null);
  const [edit, setEdit] = useState<BookRow | null>(null);
  const d = useDeleteBook(s.reload);
  return (
    <div>
      <PageTitle title="Publisher books" sub="Books approved for publication on behalf of publishers." />
      <FilterBar><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, publisher" aria-label="Search publisher books" className={`${filterInput} w-full sm:w-80`} /></FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(x) => x.books.length === 0} empty={<EmptyState icon={<BookOpen className="size-8" />} title={dq ? "No books match" : "No publisher books have been approved yet."} />}>
        {(x) => (<>
          <DataTable rows={x.books} rowKey={(r) => r.id} cols={[
            { key: "c", header: "Cover", hideCard: true, cell: (r) => <BookThumb b={cover(r)} /> },
            { key: "t", header: "Title", primary: true, cell: (r) => <span className="font-semibold">{r.title}</span> }, { key: "a", header: "Author", cell: (r) => r.author },
            { key: "p", header: "Publisher", cell: (r) => r.publisher.name }, { key: "cat", header: "Category", cell: (r) => r.category },
            { key: "pr", header: "Price", cell: (r) => <Prices prices={r.prices} free={r.isFree} /> }, { key: "cu", header: "Currency", cell: (r) => r.isFree ? "—" : Object.keys(r.prices).join(", ") },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "ap", header: "Approved", cell: (r) => dateFmt(r.approvedAt) }, { key: "pu", header: "Published", cell: (r) => dateFmt(r.publishedAt) },
          ]} actions={(r) => (<>
            <Button size="sm" variant="secondary" onClick={() => setView(r)}><Eye className="size-4" /> View</Button>
            <Button size="sm" variant="secondary" onClick={() => setEdit({ id: r.id, title: r.title, author: r.author, category: r.category, description: r.description, status: r.status === "PUBLISHED" ? "APPROVED" : r.status, isFree: r.isFree, prices: r.prices, source: "PUBLISHER" })}><Pencil className="size-4" /> Edit</Button>
            <Button size="sm" variant="danger" onClick={() => d.setTarget({ id: r.id, title: r.title })}><Trash2 className="size-4" /> Delete</Button>
          </>)} />
          <Pager page={page} total={x.total} size={25} onPage={setPage} />
        </>)}
      </Async>
      <Sheet open={!!view} onClose={() => setView(null)} title={view?.title ?? "Book"}>
        {view && <div className="space-y-3 text-sm"><div className="mx-auto w-32"><BookThumb b={cover(view)} /></div><p><b>Author:</b> {view.author}</p><p><b>Publisher:</b> {view.publisher.name} ({view.publisher.email})</p><p><b>Category:</b> {view.category}</p><p><b>Price:</b> <Prices prices={view.prices} free={view.isFree} /></p><p><b>Status:</b> {view.status} · approved {dateFmt(view.approvedAt)} · published {dateFmt(view.publishedAt)}</p>{view.syncError && <p className="text-warn">Sync: {view.syncError}</p>}<p className="whitespace-pre-line text-muted">{view.description}</p></div>}
      </Sheet>
      <BookEditSheet book={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />
      <DeleteBookDialog d={d} />
    </div>
  );
}
