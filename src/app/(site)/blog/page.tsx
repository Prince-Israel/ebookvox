import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { POSTS } from "@/lib/blog";
import { abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Ebookvox blog: tips for listening to books, PDFs and documents" },
  description: "Guides and reading lists from Ebookvox: how to turn a PDF into audio, classic books to listen to, text to speech for students and more.",
  alternates: { canonical: "/blog" },
};

const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function BlogIndex() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Blog", name: "Ebookvox blog", url: abs("/blog"), blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: abs(`/blog/${p.slug}`), datePublished: p.date })) }} />
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Ebookvox blog</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Listen more. Read more.</h1>
        <p className="mt-3 text-lg text-muted">Guides, reading lists and tips for listening to books, PDFs and documents.</p>
        <ul className="mt-10 space-y-5">
          {POSTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="block rounded-3xl border border-line bg-surface p-6 shadow-card transition hover:bg-surface2">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">{p.tag} · {p.readMins} min read</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold">{p.title}</h2>
                <p className="mt-2 text-muted">{p.description}</p>
                <p className="mt-3 text-sm text-muted">{fmt(p.date)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
