import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Read the Bible online with words of Jesus in red | Ebookvox" },
  description: "Read the King James Bible with the words of Jesus in red, cross-references and a Strong's concordance. Search every verse by word or by the original Hebrew and Greek.",
  alternates: { canonical: "/bible" },
};

export default function BibleLayout({ children }: { children: React.ReactNode }) { return children; }
