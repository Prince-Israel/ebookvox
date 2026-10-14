"use client";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Skeleton, cx } from "@/components/ui";
import { BookCard, type BookItem } from "@/components/BookCard";
import { api, useApi } from "@/lib/client";

const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4";
const skeleton = <div className={grid}>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-80" />)}</div>;

export default function BooksPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [view, setView] = useState<"all" | "free" | "paid">("all");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [more, setMore] = useState<BookItem[]>([]); // pages after the first
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const query = useMemo(() => new URLSearchParams({ ...(debounced && { q: debounced }), ...(category && { category }), ...(view !== "all" && { type: view }) }), [debounced, category, view]);
  const url = `/api/books?${query}`;
  const state = useApi<{ books: BookItem[]; categories: string[]; currency: string; total: number }>(url, "We couldn't load books. Please try again.");
  useEffect(() => { setMore([]); setPage(1); }, [url]);
  const all = [...(state.data?.books ?? []), ...more];
  const free = all.filter((b) => b.isFree);
  const paid = all.filter((b) => !b.isFree);
  const total = state.data?.total ?? 0;
  async function showMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const d = await api<{ books: BookItem[] }>(`/api/books?${new URLSearchParams({ ...Object.fromEntries(query), page: String(next) })}`);
      setMore((m) => [...m, ...d.books.filter((b) => !m.some((x) => x.id === b.id))]);
      setPage(next);
    } catch {}
    setLoadingMore(false);
  }

  const chip = (active: boolean) => cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition", active ? "bg-primary text-primary-fg" : "bg-surface2 text-fg hover:bg-line");
  const section = (id: string, title: string, list: BookItem[], emptyText: string) => (
    <section aria-labelledby={id} className="mb-12">
      <div className="mb-4 flex items-baseline gap-3"><h2 id={id} className="text-sm font-bold uppercase tracking-[0.2em]">{title}</h2><span className="text-sm text-muted">{list.length}</span></div>
      {list.length === 0 ? <EmptyState icon={<BookOpen className="size-8" />} title={emptyText} body={debounced || category ? "Try a different search or category." : undefined} /> : <div className={grid}>{list.map((b) => <BookCard key={b.id} book={b} />)}</div>}
    </section>
  );

  return (
    <div>
      <PageTitle title="Books" sub={state.data ? `Prices shown in ${state.data.currency}` : "Discover your next read"} />
      <div className="sticky top-[3.6rem] z-20 -mx-4 mb-6 space-y-3 bg-bg/90 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author or category" aria-label="Search books" className="h-12 w-full rounded-full border border-line bg-surface pl-12 pr-4 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Book type">
          {(["all", "free", "paid"] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={chip(view === v)}>{v === "all" ? "All" : v === "free" ? "Free" : "Paid"}</button>)}
          <span className="mx-1 w-px shrink-0 bg-line" />
          <button onClick={() => setCategory("")} className={chip(!category)}>All categories</button>
          {state.data?.categories.map((c) => <button key={c} onClick={() => setCategory(c === category ? "" : c)} className={chip(category === c)}>{c}</button>)}
        </div>
      </div>
      <Async state={state} skeleton={skeleton}
        isEmpty={(d) => d.books.length === 0}
        empty={<EmptyState icon={<BookOpen className="size-8" />} title="No books found" body={debounced || category ? "Try a different search or category." : "New titles will appear here as soon as they're approved."} />}>
        {() => (<>
          {view !== "paid" && section("free-books", "FREE BOOKS", free, "No free books match")}
          {view !== "free" && section("paid-books", "PAID BOOKS", paid, "No paid books match")}
          {all.length < total && <div className="mb-10 flex flex-col items-center gap-2"><p className="text-sm text-muted">Showing {all.length} of {total.toLocaleString()} books</p><Button variant="secondary" loading={loadingMore} onClick={showMore}>Show more books</Button></div>}
        </>)}
      </Async>
    </div>
  );
}
