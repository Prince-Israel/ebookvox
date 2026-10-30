import Link from "next/link";
import { FileText, Headphones, Mic2, UploadCloud } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { TtsDemo } from "@/components/seo/TtsDemo";
import { VOICES } from "@/lib/voices";
import { abs } from "@/lib/seo";

export type ToolCopy = {
  path: string; h1: string; lead: string; sample: string; steps: Array<[string, string]>; faq: Array<[string, string]>; cta: string;
};

const demoVoices = () => {
  const pick = (group: string, n: number) => VOICES.filter((v) => v.group === group).slice(0, n);
  return [...pick("African", 2), ...pick("International", 3), ...pick("Narrator", 1)].map((v) => ({ id: v.id, label: `${v.name}: ${v.accent}, ${v.style}` }));
};

/** The "text to speech online" / "PDF to audio" pages: a free sample you can try without an account, how it works, and answers to the common questions. */
export function ToolLanding({ copy }: { copy: ToolCopy }) {
  const icons = [UploadCloud, Mic2, Headphones];
  return (
    <>
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: copy.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@context": "https://schema.org", "@type": "WebApplication", name: "Ebookvox read-aloud", url: abs(copy.path), applicationCategory: "UtilitiesApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
        { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: abs("/home") }, { "@type": "ListItem", position: 2, name: copy.h1, item: abs(copy.path) }] },
      ]} />
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Free to try</p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">{copy.h1}</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">{copy.lead}</p>
        <div className="mt-8"><TtsDemo voices={demoVoices()} initialText={copy.sample} /></div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/sign-up?next=/home" className="inline-flex h-14 items-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-primary-fg hover:bg-primary-hover"><FileText className="size-5" /> {copy.cta}</Link>
          <Link href="/books" className="inline-flex h-14 items-center rounded-full border border-line bg-surface px-7 text-base font-semibold hover:bg-surface2">Browse free books</Link>
        </div>

        <h2 className="mt-14 text-3xl font-semibold">How it works</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {copy.steps.map(([t, d], i) => { const Icon = icons[i % icons.length]; return (
            <li key={t} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-fg"><Icon className="size-6" /></div>
              <h3 className="text-lg font-semibold">{i + 1}. {t}</h3><p className="mt-1 text-sm text-muted">{d}</p>
            </li>); })}
        </ol>

        <h2 className="mt-14 text-3xl font-semibold">Common questions</h2>
        <div className="mt-5 space-y-3">
          {copy.faq.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-line bg-surface p-5 shadow-card">
              <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{q}</summary>
              <p className="mt-3 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
