import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookDetails, type BookDetail } from "@/components/BookDetails";
import { JsonLd } from "@/components/JsonLd";
import { basePrice, loadBook, serializeBook } from "@/lib/books";
import { abs, bookDescriptionTag, bookTitleTag, displayAuthor, DEFAULT_OG, SITE_NAME, slugify } from "@/lib/seo";

type P = { params: Promise<{ id: string }> };
const approved = async (id: string) => { const b = await loadBook(id); return b && b.status === "APPROVED" ? b : null; };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const b = await approved((await params).id);
  if (!b) return { title: "Book not found", robots: { index: false } };
  const url = abs(`/books/${b.id}`);
  const title = bookTitleTag(b), description = bookDescriptionTag(b);
  const image = b.coverUrl ? abs(`/api/books/${b.id}/cover`) : abs(DEFAULT_OG);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "book", url, title, description, siteName: SITE_NAME, images: [{ url: image, alt: `Cover of ${b.title}` }] },
    twitter: { card: b.coverUrl ? "summary" : "summary_large_image", title, description, images: [image] },
  };
}

export default async function BookPage({ params }: P) {
  const { id } = await params;
  const b = await approved(id);
  if (!b) notFound();
  const url = abs(`/books/${b.id}`);
  // What the server renders for everyone (the signed-in view is refreshed in the browser): the book in US dollars, not owned.
  const sb = await serializeBook(b, "USD");
  const initial: BookDetail = { book: { ...sb, owned: false }, owned: false, progress: null, pendingReference: null, canBuy: b.isFree || !!basePrice(b) };
  const author = displayAuthor(b.author);
  const price = sb.price ? { price: (sb.price.amountMinor / 100).toFixed(2), priceCurrency: sb.price.currency } : null;
  return (
    <>
      <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "Book", "@id": `${url}#book`, url, name: b.title, description: b.description.slice(0, 1000),
          author: { "@type": "Person", name: author }, inLanguage: b.language, genre: b.category, isAccessibleForFree: b.isFree,
          publisher: { "@type": "Organization", name: b.publisher.name },
          ...(b.coverUrl ? { image: abs(`/api/books/${b.id}/cover`) } : {}),
          potentialAction: { "@type": "ReadAction", target: url },
          offers: { "@type": "Offer", url, availability: "https://schema.org/InStock", ...(b.isFree ? { price: "0", priceCurrency: "USD" } : price ?? {}) },
        },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: abs("/home") },
          { "@type": "ListItem", position: 2, name: "Books", item: abs("/books") },
          { "@type": "ListItem", position: 3, name: b.category, item: abs(`/category/${slugify(b.category)}`) },
          { "@type": "ListItem", position: 4, name: b.title, item: url },
        ] },
      ]} />
      <BookDetails id={b.id} initial={initial} />
    </>
  );
}
