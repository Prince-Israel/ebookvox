import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { abs } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Ebookvox: read and listen to books, turn any text or PDF into speech" },
  description: "Read free and paid books or listen to them in 30+ natural voices. Paste text or upload a PDF, DOCX or TXT and hear it read aloud. Your words, our voice.",
  alternates: { canonical: "/home" },
  openGraph: { type: "website", url: "/home", title: "Ebookvox: read and listen to books, turn any text or PDF into speech", description: "Read or listen to books, and turn any text or document into natural speech in 30+ voices." },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", name: "Ebookvox", url: abs("/home"), logo: abs("/icons/icon-512.png"), slogan: "Your words. Our voice." },
        { "@context": "https://schema.org", "@type": "WebSite", name: "Ebookvox", url: abs("/home"), inLanguage: "en" },
        { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Ebookvox", applicationCategory: "BookApplication", operatingSystem: "Android, iOS, Web", url: abs("/home"), offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
      ]} />
      {children}
    </>
  );
}
