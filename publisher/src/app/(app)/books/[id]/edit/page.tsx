"use client";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Async, Banner, PageTitle, Skeleton } from "@/components/ui";
import { BookForm, type BookDto } from "@/components/BookForm";
import { useApi } from "@/lib/client";

export default function EditBook({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useApi<{ book: BookDto }>(`/api/books/${id}`, "We couldn't load this book. Please try again.");
  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/books/${id}`} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Back to book</Link>
      <PageTitle title="Edit book" />
      <Async state={state} skeleton={<Skeleton className="h-96" />}>
        {({ book }) => ["DRAFT", "REJECTED"].includes(book.status) ? <BookForm book={book} /> : <Banner tone="warn">This book is {book.status.toLowerCase()} and can't be edited. Only drafts and rejected books are editable.</Banner>}
      </Async>
    </div>
  );
}
