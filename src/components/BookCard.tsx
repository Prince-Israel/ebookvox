"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cover } from "./Cover";
import { Badge, Button, useToast } from "./ui";
import { api, ApiFailure } from "@/lib/client";
import { useAuth } from "./UserContext";
import { AuthPrompt } from "./AuthPrompt";
import { formatMoney } from "@/lib/money";

export type BookItem = {
  id: string; title: string; author: string; category: string; coverUrl: string | null; coverHue: number; isFree: boolean; owned: boolean;
  price: { amountMinor: number; currency: string } | null;
};

export async function openFreeBook(id: string) {
  await api(`/api/books/${id}/claim`, { method: "POST" });
}

export function BookCard({ book }: { book: BookItem }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(false);

  async function act() {
    if (!user) return setPrompt(true);
    if (book.owned) return router.push(`/read/${book.id}`);
    if (!book.isFree) return router.push(`/checkout/${book.id}`);
    setBusy(true);
    try {
      await openFreeBook(book.id);
      router.push(`/read/${book.id}`);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
      setBusy(false);
    }
  }

  return (
    <article className="group flex flex-col rounded-3xl border border-line bg-surface p-3 shadow-card transition hover:-translate-y-1 hover:shadow-pop sm:p-4">
      <Link href={`/books/${book.id}`} className="block" aria-label={`${book.title} by ${book.author}`}>
        <div className="mx-auto w-full max-w-[11rem]"><Cover title={book.title} author={book.author} hue={book.coverHue} url={book.coverUrl} /></div>
      </Link>
      <div className="mt-3 flex flex-1 flex-col">
        <Link href={`/books/${book.id}`} className="line-clamp-2 font-serif text-lg font-semibold leading-snug hover:underline">{book.title}</Link>
        <p className="mt-0.5 truncate text-sm text-muted">{book.author}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge>{book.category}</Badge>
          {book.isFree ? <Badge tone="success">FREE</Badge> : book.price ? <Badge tone="accent">{formatMoney(book.price.amountMinor, book.price.currency)}</Badge> : <Badge tone="warn">Unavailable</Badge>}
        </div>
        <div className="mt-auto pt-4">
          <Button className="w-full" size="sm" variant={book.owned || book.isFree ? "secondary" : "primary"} loading={busy} disabled={!book.isFree && !book.price && !book.owned} onClick={act}>
            {book.owned ? "Read" : book.isFree ? "Read Now" : "Purchase"}
          </Button>
        </div>
      </div>
      <AuthPrompt open={prompt} onClose={() => setPrompt(false)} next={`/books/${book.id}`} reason={book.isFree ? "Create a free account to read this book and keep your place across devices." : "Create a free account to purchase this book and add it to your library."} />
    </article>
  );
}
