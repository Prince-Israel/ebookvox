"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Async, Badge, Banner, Button, Card, Skeleton } from "@/components/ui";
import { Prices, StatusBadge, dateFmt } from "@/components/bits";
import { Cover } from "@/components/Cover";
import { BookEditSheet, useDeleteBook } from "@/components/BookEdit";
import { DeleteBookDialog } from "@/components/BookBits";
import { useApi } from "@/lib/client";

export default function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const s = useApi<{ book: any; publisherBook: any; warning?: string }>(`/api/books/${id}`, "We couldn't load this book.");
  const [edit, setEdit] = useState(false);
  const d = useDeleteBook(() => router.push("/books"));
  return (
    <div>
      <Link href="/books" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> All books</Link>
      <Async state={s} skeleton={<Skeleton className="h-96" />}>
        {({ book: b, publisherBook: pb, warning }) => (
          <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
            <div className="mx-auto w-full max-w-[12rem] md:mx-0 md:max-w-none"><Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} /></div>
            <div className="space-y-5">
              <div><div className="mb-2 flex flex-wrap gap-2"><StatusBadge status={b.status} /><Badge tone={b.source === "PUBLISHER" ? "accent" : "neutral"}>{b.source === "PUBLISHER" ? "Publisher book" : "Reader catalogue"}</Badge></div><h1 className="text-4xl font-semibold">{b.title}</h1><p className="mt-1 text-lg text-muted">by {b.author}</p></div>
              {warning && <Banner tone="warn">Publisher details are unavailable: {warning}</Banner>}
              <Card><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{[["Category", b.category], ["Publisher", b.publisher], ["Price", <Prices key="p" prices={b.prices} free={b.isFree} />], ["Chapters", b.chapterCount], ["Readers who own it", b.owners], ["Orders (all / paid)", `${b.orders} / ${b.paidOrders}`], ["Added", dateFmt(b.createdAt, true)], ["Approved", dateFmt(b.approvedAt, true)]].map(([l, v]) => <div key={String(l)}><dt className="text-sm text-muted">{l}</dt><dd className="font-medium">{v as React.ReactNode}</dd></div>)}</dl></Card>
              {pb && <Card><h2 className="mb-2 text-lg font-semibold">Publisher record</h2><p className="text-sm text-muted">Status {pb.status} · submitted {dateFmt(pb.submittedAt)} · published {dateFmt(pb.publishedAt)} · file {pb.fileName ?? "—"}</p></Card>}
              <Card><h2 className="mb-2 text-lg font-semibold">Description</h2><p className="whitespace-pre-line text-muted">{b.description}</p></Card>
              <div className="flex flex-wrap gap-3"><Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit</Button><Button variant="danger" onClick={() => d.setTarget({ id: b.id, title: b.title })}><Trash2 className="size-4" /> Delete</Button></div>
              <BookEditSheet book={edit ? { ...b } : null} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); s.reload(); }} />
              <DeleteBookDialog d={d} />
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}
