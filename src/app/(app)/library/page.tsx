"use client";
import Link from "next/link";
import { BookMarked, BookOpen, Clock, Gift, ShoppingBag } from "lucide-react";
import { Async, Badge, Button, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { useApi } from "@/lib/client";

type Item = { id: string; title: string; author: string; category: string; coverUrl: string | null; coverHue: number; source: string; percent: number; completed: boolean; started: boolean };
type Data = { items: Item[]; purchased: Item[]; reading: Item[]; recent: Item[] };

function Row({ b }: { b: Item }) {
  const pct = Math.round(b.percent);
  return (
    <li className="flex gap-4 rounded-3xl border border-line bg-surface p-3 shadow-card sm:p-4">
      <Link href={`/books/${b.id}`} className="w-20 shrink-0 sm:w-24"><Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} /></Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/books/${b.id}`} className="line-clamp-2 font-serif text-lg font-semibold leading-snug hover:underline">{b.title}</Link>
        <p className="truncate text-sm text-muted">{b.author}</p>
        <div className="mt-1 flex gap-2"><Badge tone={b.source === "PURCHASE" ? "accent" : "success"}>{b.source === "PURCHASE" ? "Purchased" : "Free"}</Badge>{b.completed && <Badge>Finished</Badge>}</div>
        <div className="mt-auto pt-3">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>{b.started ? "Progress" : "Not started"}</span><span>{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.title} progress`}><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
          <Link href={`/read/${b.id}`} className="mt-3 block"><Button size="sm" className="w-full sm:w-auto">{b.started && pct > 0 && !b.completed ? "Continue" : b.completed ? "Read again" : "Start reading"}</Button></Link>
        </div>
      </div>
    </li>
  );
}

function Section({ title, icon, items, emptyTitle, emptyBody }: { title: string; icon: React.ReactNode; items: Item[]; emptyTitle: string; emptyBody: string }) {
  return (
    <section className="mb-12" aria-label={title}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em]"><span className="text-accent">{icon}</span> {title}</h2>
      {items.length === 0 ? <EmptyState icon={<BookOpen className="size-8" />} title={emptyTitle} body={emptyBody} action={<Link href="/books"><Button variant="secondary">Discover books</Button></Link>} /> : <ul className="grid gap-4 md:grid-cols-2">{items.map((b) => <Row key={b.id} b={b} />)}</ul>}
    </section>
  );
}

export default function LibraryPage() {
  const state = useApi<Data>("/api/library", "We couldn't load your books. Please try again.");
  return (
    <div>
      <PageTitle title="Library" sub="Everything you own, with your place saved." />
      <Async state={state} skeleton={<div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState icon={<BookMarked className="size-8" />} title="Your library is empty" body="Free books you open and books you buy will live here, ready to read or listen to anywhere." action={<Link href="/books"><Button>Browse books</Button></Link>} />}>
        {(d) => (
          <>
            <Section title="Currently Reading" icon={<BookOpen className="size-5" />} items={d.reading} emptyTitle="Nothing in progress" emptyBody="Start a book and it will show up here." />
            <Section title="Purchased Books" icon={<ShoppingBag className="size-5" />} items={d.purchased} emptyTitle="No purchases yet" emptyBody="Books you buy appear here permanently." />
            <Section title="Free Books" icon={<Gift className="size-5" />} items={d.items.filter((i) => i.source === "FREE")} emptyTitle="No free books added" emptyBody="Tap Read Now on any free book to add it." />
            <Section title="Recently Read" icon={<Clock className="size-5" />} items={d.recent} emptyTitle="Nothing read recently" emptyBody="Books you open will be listed here." />
          </>
        )}
      </Async>
    </div>
  );
}
