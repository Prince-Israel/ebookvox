import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { BookGrid } from "@/components/seo/BookGrid";
import { db } from "@/lib/db";
import { abs, authors, displayAuthor } from "@/lib/seo";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
const find = async (slug: string) => (await authors()).find((a) => a.slug === slug) ?? null;
const booksOf = (slug: string, names: string[]) => db.book.findMany({ where: { status: "APPROVED", author: { in: names } }, orderBy: [{ isFree: "desc" }, { title: "asc" }], take: 120, select: { id: true, title: true, author: true, category: true, coverUrl: true, coverHue: true, isFree: true } });
// every spelling of the name that maps to this page ("Doyle, Arthur Conan" and "Arthur Conan Doyle")
const namesFor = async (slug: string) => { const a = await find(slug); if (!a) return null; const rows = await db.book.groupBy({ by: ["author"], where: { status: "APPROVED" } }); return { a, names: rows.map((r) => r.author).filter((n) => { const d = displayAuthor(n); return d === displayAuthor(a.name); }) }; };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const f = await namesFor((await params).slug);
  if (!f) return { title: "Author not found", robots: { index: false } };
  const name = displayAuthor(f.a.name);
  const title = `${name}: books to read and listen to online | Ebookvox`;
  const description = `Read or listen to ${f.a.count} ${f.a.count === 1 ? "book" : "books"} by ${name} on Ebookvox, in your browser or in natural voices.`;
  const url = abs(`/authors/${f.a.slug}`);
  return { title: { absolute: title }, description, alternates: { canonical: url }, openGraph: { type: "profile", url, title, description }, robots: { index: f.a.count >= 2 } };
}

export default async function AuthorPage({ params }: P) {
  const f = await namesFor((await params).slug);
  if (!f) notFound();
  const name = displayAuthor(f.a.name);
  const books = await booksOf(f.a.slug, f.names);
  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Person", name, url: abs(`/authors/${f.a.slug}`), mainEntityOfPage: abs(`/authors/${f.a.slug}`) },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: abs("/home") }, { "@type": "ListItem", position: 2, name: "Books", item: abs("/books") }, { "@type": "ListItem", position: 3, name, item: abs(`/authors/${f.a.slug}`) }] },
      ]} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/books" className="hover:underline">Books</Link> / <span>{name}</span></nav>
      <h1 className="text-4xl font-semibold sm:text-5xl">Books by {name}</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted">Read or listen to {books.length} {books.length === 1 ? "book" : "books"} by {name} in your browser, or hear them in 30+ natural voices.</p>
      <div className="mt-8"><BookGrid books={books} /></div>
    </>
  );
}
