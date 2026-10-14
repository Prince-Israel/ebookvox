"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Sparkles } from "lucide-react";
import { Cover } from "./Cover";
import { Skeleton, cx } from "./ui";
import { useApi } from "@/lib/client";
import { formatMoney } from "@/lib/money";

type B = { id: string; title: string; author: string; category: string; coverUrl: string | null; coverHue: number; isFree: boolean; price: { amountMinor: number; currency: string } | null };

/** Trending / New books carousel — public, so visitors see it too. */
export function BookCarousel() {
  const s = useApi<{ trending: B[]; newest: B[] }>("/api/books/featured", "We couldn't load featured books.");
  const [tab, setTab] = useState<"trending" | "newest">("trending");
  const [paused, setPaused] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const list = s.data ? (tab === "trending" && s.data.trending.length ? s.data.trending : s.data.newest) : [];
  const hasTrending = !!s.data?.trending.length;
  useEffect(() => { if (s.data && !s.data.trending.length) setTab("newest"); }, [s.data]);

  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (dir === 1 && el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };
  useEffect(() => {
    if (paused || list.length < 4) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => scrollBy(1), 4500);
    return () => clearInterval(t);
  }, [paused, list.length, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (s.error && !s.data) return null; // the carousel is a bonus; the page works without it
  const tabBtn = (id: "trending" | "newest", label: string, Icon: typeof Flame) => (
    <button role="tab" aria-selected={tab === id} onClick={() => { setTab(id); rail.current?.scrollTo({ left: 0 }); }} disabled={id === "trending" && !hasTrending} className={cx("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-40", tab === id ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}><Icon className="size-4" /> {label}</button>
  );
  return (
    <section aria-label="Featured books" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{tab === "trending" ? "Trending books" : "New books"}</h2>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Featured books" className="flex gap-1.5">{tabBtn("trending", "Trending", Flame)}{tabBtn("newest", "New", Sparkles)}</div>
          <button onClick={() => scrollBy(-1)} aria-label="Previous books" className="hidden size-10 place-items-center rounded-full border border-line bg-surface hover:bg-surface2 sm:grid"><ChevronLeft className="size-5" /></button>
          <button onClick={() => scrollBy(1)} aria-label="Next books" className="hidden size-10 place-items-center rounded-full border border-line bg-surface hover:bg-surface2 sm:grid"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      {!s.data ? <div className="scroll-x">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-36" />)}</div> : list.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line p-8 text-center text-muted">No books yet — new titles will appear here once they're approved.</p>
      ) : (
        <div ref={rail} className="scroll-x" tabIndex={0} aria-label="Book carousel">
          {list.map((b) => (
            <Link key={b.id} href={`/books/${b.id}`} className="w-36 rounded-2xl transition hover:-translate-y-1 sm:w-40">
              <Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} />
              <p className="mt-2 line-clamp-1 text-sm font-semibold">{b.title}</p>
              <p className="line-clamp-1 text-xs text-muted">{b.author}</p>
              <p className="text-xs font-bold text-accent">{b.isFree ? "FREE" : b.price ? formatMoney(b.price.amountMinor, b.price.currency) : ""}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
