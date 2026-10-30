import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { BookGrid } from "@/components/seo/BookGrid";
import { Blocks, inline } from "@/components/seo/Blog";
import { db } from "@/lib/db";
import { POSTS, postBySlug } from "@/lib/blog";
import { abs, DEFAULT_OG } from "@/lib/seo";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };
const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export async function generateStaticParams() { return POSTS.map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = postBySlug((await params).slug);
  if (!p) return { title: "Article not found", robots: { index: false } };
  const url = abs(`/blog/${p.slug}`);
  return {
    title: { absolute: `${p.title} | Ebookvox` }, description: p.description, alternates: { canonical: url },
    openGraph: { type: "article", url, title: p.title, description: p.description, publishedTime: p.date, siteName: "Ebookvox", images: [{ url: abs(DEFAULT_OG), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [abs(DEFAULT_OG)] },
  };
}

export default async function Post({ params }: P) {
  const p = postBySlug((await params).slug);
  if (!p) notFound();
  const url = abs(`/blog/${p.slug}`);
  // "free right now": the first free book matching each title, so the cards only ever show what is really available
  const found = p.showBooks?.length ? await db.book.findMany({ where: { status: "APPROVED", isFree: true, OR: p.showBooks.map((t) => ({ title: { startsWith: t } })) }, select: { id: true, title: true, author: true, category: true, coverUrl: true, coverHue: true, isFree: true } }) : [];
  const books = (p.showBooks ?? []).map((t) => found.find((b) => b.title.startsWith(t))).filter((b): b is NonNullable<typeof b> => !!b);
  const more = POSTS.filter((x) => x.slug !== p.slug).slice(0, 3);
  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "BlogPosting", headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date, mainEntityOfPage: url, image: abs(DEFAULT_OG), author: { "@type": "Organization", name: "Ebookvox" }, publisher: { "@type": "Organization", name: "Ebookvox", logo: { "@type": "ImageObject", url: abs("/icons/icon-512.png") } } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: abs("/home") }, { "@type": "ListItem", position: 2, name: "Blog", item: abs("/blog") }, { "@type": "ListItem", position: 3, name: p.title, item: url }] },
        ...(p.faq ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] : []),
      ]} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted"><Link href="/blog" className="hover:underline">Blog</Link> / <span>{p.tag}</span></nav>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{p.title}</h1>
        <p className="mt-3 text-sm text-muted">By the Ebookvox team · <time dateTime={p.date}>{fmt(p.date)}</time> · {p.readMins} min read</p>
        <p className="mt-6 text-xl leading-relaxed">{inline(p.intro)}</p>
        <div className="mt-8"><Blocks blocks={p.body} /></div>

        {books.length > 0 && (
          <section className="mt-12" aria-labelledby="free-now">
            <h2 id="free-now" className="font-serif text-3xl font-semibold">Free to read and listen to right now</h2>
            <div className="mt-5"><BookGrid books={books} /></div>
          </section>
        )}

        {p.faq && (
          <section className="mt-12" aria-labelledby="faq">
            <h2 id="faq" className="font-serif text-3xl font-semibold">Common questions</h2>
            <div className="mt-5 space-y-3">
              {p.faq.map(([q, a]) => (
                <details key={q} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{q}</summary>
                  <p className="mt-3 leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {p.cta && (
          <div className="mt-12 rounded-3xl bg-[#3a261c] p-7 text-center text-[#fbf1e4]">
            <p className="font-serif text-2xl font-semibold">{p.cta.text}</p>
            <Link href={p.cta.href} className="mt-5 inline-flex h-14 items-center rounded-full bg-[#ee9b6e] px-8 text-base font-semibold text-[#3a1f0e] hover:brightness-105">{p.cta.label}</Link>
          </div>
        )}

        <section className="mt-14" aria-labelledby="more">
          <h2 id="more" className="font-serif text-2xl font-semibold">More from the blog</h2>
          <ul className="mt-4 space-y-3">
            {more.map((m) => <li key={m.slug}><Link href={`/blog/${m.slug}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">{m.title}</Link></li>)}
          </ul>
        </section>
      </article>
    </>
  );
}
