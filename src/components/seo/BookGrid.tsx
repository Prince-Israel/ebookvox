import Link from "next/link";
import { Cover } from "@/components/Cover";
import { coverSrc } from "@/lib/books";
import { displayAuthor } from "@/lib/seo";

export type GridBook = { id: string; title: string; author: string; category: string; coverUrl: string | null; coverHue: number; isFree: boolean };

/** A plain, crawlable grid: every book is a real link to its own page. */
export function BookGrid({ books }: { books: GridBook[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 xl:grid-cols-6">
      {books.map((b) => (
        <li key={b.id} className="min-w-0">
          <Link href={`/books/${b.id}`} className="group block">
            <Cover title={b.title} author={b.author} hue={b.coverHue} url={coverSrc(b.id, b.coverUrl)} className="transition group-hover:-translate-y-0.5" />
            <h3 className="mt-3 line-clamp-2 font-serif text-base font-semibold leading-snug group-hover:underline">{b.title}</h3>
            <p className="mt-0.5 truncate text-sm text-muted">{displayAuthor(b.author)}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent">{b.isFree ? "Free" : "Paid"}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Pager({ base, page, pages }: { base: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (p: number) => (p <= 1 ? base : `${base}?page=${p}`);
  const cls = "inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:bg-surface2";
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className={cls}>← Previous</Link>}
      <span className="text-sm text-muted">Page {page} of {pages}</span>
      {page < pages && <Link href={href(page + 1)} rel="next" className={cls}>Next →</Link>}
    </nav>
  );
}
