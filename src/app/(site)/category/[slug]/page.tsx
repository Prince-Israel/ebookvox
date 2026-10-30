import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { BookGrid, Pager } from "@/components/seo/BookGrid";
import { db } from "@/lib/db";
import { abs, categories, displayAuthor } from "@/lib/seo";

export const dynamic = "force-dynamic";
const PER = 48;
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
const find = async (slug: string) => (await categories()).find((c) => c.slug === slug) ?? null;

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { slug } = await params; const page = Math.max(1, Number((await searchParams).page) || 1);
  const c = await find(slug);
  if (!c) return { title: "Category not found", robots: { index: false } };
  const title = `${c.name} books: read and listen online${page > 1 ? ` (page ${page})` : ""} | Ebookvox`;
  const description = `Read or listen to ${c.count.toLocaleString()} ${c.name.toLowerCase()} books on Ebookvox. Free and paid titles, in your browser or in 30+ natural voices.`;
  const url = abs(`/category/${c.slug}${page > 1 ? `?page=${page}` : ""}`);
  return { title: { absolute: title }, description, alternates: { canonical: url }, openGraph: { type: "website", url, title, description } };
}

export default async function CategoryPage({ params, searchParams }: P) {
  const { slug } = await params; const page = Math.max(1, Number((await searchParams).page) || 1);
  const c = await find(slug);
  if (!c) notFound();
  const pages = Math.max(1, Math.ceil(c.count / PER));
  const [books, top] = await Promise.all([
    db.book.findMany({ where: { status: "APPROVED", category: c.name }, orderBy: [{ isFree: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PER, take: PER, select: { id: true, title: true, author: true, category: true, coverUrl: true, coverHue: true, isFree: true } }),
    db.book.findMany({ where: { status: "APPROVED", category: c.name }, orderBy: { totalChars: "desc" }, take: 3, select: { title: true, author: true } }),
  ]);
  const base = `/category/${c.slug}`;
  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: abs("/home") }, { "@type": "ListItem", position: 2, name: "Categories", item: abs("/category") }, { "@type": "ListItem", position: 3, name: c.name, item: abs(base) }] },
        { "@context": "https://schema.org", "@type": "ItemList", name: `${c.name} books`, numberOfItems: c.count, itemListElement: books.map((b, i) => ({ "@type": "ListItem", position: (page - 1) * PER + i + 1, url: abs(`/books/${b.id}`), name: b.title })) },
      ]} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/category" className="hover:underline">Categories</Link> / <span>{c.name}</span></nav>
      <h1 className="text-4xl font-semibold sm:text-5xl">{c.name} books to read and listen to online</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted">
        {c.count.toLocaleString()} {c.name.toLowerCase()} books you can read in your browser or listen to in 30+ natural voices, with your place saved on every device.
        {top.length > 0 && <> Popular titles include {top.map((t, i) => <span key={t.title}>{i > 0 ? (i === top.length - 1 ? " and " : ", ") : ""}<em>{t.title.replace(/\s*[;:].*$/, "")}</em> by {displayAuthor(t.author)}</span>)}.</>}
      </p>
      <div className="mt-8"><BookGrid books={books} /></div>
      <Pager base={base} page={page} pages={pages} />
    </>
  );
}
