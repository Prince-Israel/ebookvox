import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { abs, categories } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Book categories: browse free and paid books by genre | Ebookvox" },
  description: "Browse books by category: classic fiction, mystery, romance, science fiction, history, biography, poetry and more. Read online or listen.",
  alternates: { canonical: "/category" },
};

export default async function Categories() {
  const cats = await categories();
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: abs("/home") }, { "@type": "ListItem", position: 2, name: "Categories", item: abs("/category") }] }} />
      <h1 className="text-4xl font-semibold sm:text-5xl">Browse books by category</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">Pick a genre and read or listen to its books online. Many titles are free.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <li key={c.slug}><Link href={`/category/${c.slug}`} className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:bg-surface2">
            <span className="font-serif text-xl font-semibold">{c.name}</span><span className="text-sm text-muted">{c.count.toLocaleString()} books</span>
          </Link></li>
        ))}
      </ul>
    </>
  );
}
