"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Library, Pencil, Trash2 } from "lucide-react";
import { Async, Badge, Button, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { DataTable, FilterBar, Pager, filterInput } from "@/components/table";
import { Prices, StatusBadge, dateFmt } from "@/components/bits";
import { BookEditSheet, useDeleteBook, type BookRow } from "@/components/BookEdit";
import { BookThumb, DeleteBookDialog } from "@/components/BookBits";
import { useApi } from "@/lib/client";

export default function BooksPage() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [status, setStatus] = useState(""); const [source, setSource] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const s = useApi<{ total: number; books: any[] }>(`/api/books?${new URLSearchParams({ ...(dq && { q: dq }), ...(status && { status }), ...(source && { source }), page: String(page) })}`, "We couldn't load the catalogue.");
  const [edit, setEdit] = useState<BookRow | null>(null);
  const d = useDeleteBook(s.reload);
  return (
    <div>
      <PageTitle title="All books" sub="The Reader catalogue plus approved publisher books." />
      <FilterBar>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or category" aria-label="Search books" className={`${filterInput} w-full sm:w-80`} />
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Source" className={filterInput}><option value="">All sources</option><option value="READER">Reader catalogue</option><option value="PUBLISHER">Publisher</option></select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={filterInput}><option value="">All statuses</option><option value="APPROVED">Approved</option><option value="ARCHIVED">Archived</option><option value="PENDING">Pending</option></select>
      </FilterBar>
      <Async state={s} skeleton={<Skeleton className="h-96" />} isEmpty={(x) => x.books.length === 0} empty={<EmptyState icon={<Library className="size-8" />} title={dq || status || source ? "No books match" : "No books in the catalogue yet."} />}>
        {(x) => (<>
          <DataTable rows={x.books} rowKey={(r) => r.id} cols={[
            { key: "c", header: "Cover", hideCard: true, cell: (r) => <BookThumb b={r} /> },
            { key: "t", header: "Title", primary: true, cell: (r) => <Link href={`/books/${r.id}`} className="font-semibold hover:underline">{r.title}</Link> },
            { key: "a", header: "Author", cell: (r) => r.author }, { key: "cat", header: "Category", cell: (r) => r.category },
            { key: "s", header: "Source", cell: (r) => <Badge tone={r.source === "PUBLISHER" ? "accent" : "neutral"}>{r.source === "PUBLISHER" ? "Publisher" : "Reader"}</Badge> },
            { key: "p", header: "Price", cell: (r) => <Prices prices={r.prices} free={r.isFree} /> },
            { key: "cu", header: "Currency", cell: (r) => r.isFree ? "—" : Object.keys(r.prices).join(", ") },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> }, { key: "d", header: "Date", cell: (r) => dateFmt(r.approvedAt ?? r.createdAt) },
          ]} actions={(r) => (<>
            <Link href={`/books/${r.id}`}><Button size="sm" variant="secondary"><Eye className="size-4" /> View</Button></Link>
            <Button size="sm" variant="secondary" onClick={() => setEdit(r)}><Pencil className="size-4" /> Edit</Button>
            <Button size="sm" variant="danger" onClick={() => d.setTarget({ id: r.id, title: r.title })}><Trash2 className="size-4" /> Delete</Button>
          </>)} />
          <Pager page={page} total={x.total} size={25} onPage={setPage} />
        </>)}
      </Async>
      <BookEditSheet book={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); s.reload(); }} />
      <DeleteBookDialog d={d} />
    </div>
  );
}

