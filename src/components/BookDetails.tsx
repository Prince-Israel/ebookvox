"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Building2, Clock, Lock, Tag } from "lucide-react";
import { Async, Badge, Banner, Button, Card, Skeleton, useToast } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { openFreeBook, type BookItem } from "@/components/BookCard";
import { api, ApiFailure, useApi } from "@/lib/client";
import { useAuth } from "@/components/UserContext";
import { AuthPrompt } from "@/components/AuthPrompt";
import { formatMoney } from "@/lib/money";
import { displayAuthor, slugify } from "@/lib/slug";

type Detail = {
  book: BookItem & { description: string; publisher: string; chapterCount: number; totalChars: number; language: string };
  owned: boolean; progress: { percent: number } | null; pendingReference: string | null; canBuy: boolean;
};

export type BookDetail = Detail;

export function BookDetails({ id, initial }: { id: string; initial?: Detail | null }) {
  const router = useRouter();
  const toast = useToast();
  const state = useApi<Detail>(`/api/books/${id}`, "We couldn't load this book. Please try again.", initial ?? null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(false);

  async function readNow() {
    if (!user) return setPrompt(true);
    setBusy(true);
    try {
      await openFreeBook(id);
      router.push(`/read/${id}`);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href="/books" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Books</Link>
      <Async state={state} skeleton={<div className="grid gap-8 md:grid-cols-[18rem_1fr]"><Skeleton className="aspect-[2/3]" /><div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-40" /></div></div>}>
        {({ book: b, owned, progress, pendingReference, canBuy }) => {
          const minutes = Math.round(b.totalChars / 5 / 230);
          return (
            <div className="anim-up grid gap-8 md:grid-cols-[18rem_1fr] md:gap-12">
              <div className="mx-auto w-full max-w-[16rem] md:mx-0 md:max-w-none"><Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} /></div>
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone={b.isFree ? "success" : "accent"}>{b.isFree ? "FREE" : "PAID"}</Badge>
                  <Link href={`/category/${slugify(b.category)}`}><Badge><Tag className="mr-1 size-3" />{b.category}</Badge></Link>
                </div>
                <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{b.title}</h1>
                <p className="mt-2 text-xl text-muted">by <Link href={`/authors/${slugify(displayAuthor(b.author))}`} className="underline-offset-2 hover:underline">{displayAuthor(b.author)}</Link></p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                  <span className="flex items-center gap-2"><Building2 className="size-4" /> Publisher: <strong className="text-fg">{b.publisher}</strong></span>
                  <span className="flex items-center gap-2"><BookOpen className="size-4" /> {b.chapterCount} chapters</span>
                  <span className="flex items-center gap-2"><Clock className="size-4" /> ~{minutes >= 60 ? `${Math.round(minutes / 6) / 10} hrs` : `${minutes} min`} to listen</span>
                </div>
                <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">{b.isFree ? "Price" : `Price (${b.price?.currency ?? ""})`}</p>
                    <p className="font-serif text-3xl font-semibold">{b.isFree ? "FREE" : b.price ? formatMoney(b.price.amountMinor, b.price.currency) : "Not available"}</p>
                    {!b.isFree && b.price && <p className="mt-0.5 text-xs text-muted">Shown in your local currency at today's international exchange rate.</p>}
                  </div>
                  {owned ? (
                    <Button size="lg" onClick={() => router.push(`/read/${id}`)}>{progress && progress.percent > 0 ? `Continue Reading · ${Math.round(progress.percent)}%` : "Read Now"}</Button>
                  ) : b.isFree ? (
                    <Button size="lg" loading={busy} onClick={readNow}>Read Now</Button>
                  ) : (
                    <Button size="lg" disabled={!canBuy} onClick={() => (user ? router.push(`/checkout/${id}`) : setPrompt(true))}><Lock className="size-5" /> Buy Book</Button>
                  )}
                </Card>
                {pendingReference && !owned && <div className="mt-4"><Banner tone="warn" action={<Link href={`/payment/callback?reference=${pendingReference}`}><Button size="sm" variant="secondary">Check payment</Button></Link>}>You have a payment in progress for this book.</Banner></div>}
                <h2 className="mb-2 mt-8 text-2xl font-semibold">About this book</h2>
                <p className="whitespace-pre-line leading-relaxed text-muted">{b.description}</p>
                <p className="mt-6 text-sm text-muted">Read it right here in Ebookvox — and listen with 30+ voices.</p>
              </div>
            </div>
          );
        }}
      </Async>
      <AuthPrompt open={prompt} onClose={() => setPrompt(false)} next={`/books/${id}`} reason="Create a free account to read this book or buy it — your library and reading progress are saved to your account." />
    </div>
  );
}
