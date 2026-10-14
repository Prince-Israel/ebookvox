"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Async, Badge, Banner, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client";

function Results() {
  const q = useSearchParams().get("q") ?? "";
  const s = useApi<{ results: Array<{ type: string; title: string; meta: string; link: string }>; unavailable: string[] }>(q.trim().length >= 2 ? `/api/search?q=${encodeURIComponent(q)}` : null, "We couldn't run that search.");
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={`Results for “${q}”`} sub="Users, books, publishers, authors, orders and transactions." />
      {q.trim().length < 2 ? <EmptyState icon={<Search className="size-8" />} title="Type at least two characters to search." /> : (
        <>
          {s.data?.unavailable.length ? <div className="mb-4"><Banner tone="warn">Some results are unavailable: {s.data.unavailable.join(", ")}.</Banner></div> : null}
          <Async state={s} skeleton={<Skeleton className="h-64" />} isEmpty={(d) => d.results.length === 0 && d.unavailable.length === 0} empty={<EmptyState icon={<Search className="size-8" />} title={`No matches for “${q}”.`} />}>
            {(d) => <ul className="space-y-2">{d.results.map((r, i) => <li key={i}><Link href={r.link} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card hover:bg-surface2"><Badge tone="accent">{r.type}</Badge><span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span><span className="block truncate text-sm text-muted">{r.meta}</span></span></Link></li>)}</ul>}
          </Async>
        </>
      )}
    </div>
  );
}
export default function SearchPage() { return <Suspense><Results /></Suspense>; }
