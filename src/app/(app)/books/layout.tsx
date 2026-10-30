import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Free and paid books to read and listen to online | Ebookvox" },
  description: "Browse thousands of classic and new books. Read them in your browser or listen in natural voices. Many are free.",
  alternates: { canonical: "/books" },
};

export default function BooksLayout({ children }: { children: React.ReactNode }) { return children; }
