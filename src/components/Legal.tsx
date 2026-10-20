import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { LegalFooter } from "./LegalFooter";

export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-t border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/home" aria-label="Ebookvox home"><Logo size={32} /></Link>
          <Link href="/home" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg">Back to Ebookvox</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Ebookvox</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated: {updated}</p>
        <p className="mt-6 text-lg leading-relaxed text-fg">{intro}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <LegalFooter className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-8" />
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`} className="space-y-3">
      <h2 id={`s${n}`} className="text-2xl font-semibold">{n}. {title}</h2>
      <div className="space-y-3 leading-relaxed text-muted [&_strong]:text-fg">{children}</div>
    </section>
  );
}

export const Ul = ({ children }: { children: ReactNode }) => <ul className="list-disc space-y-1.5 pl-6 marker:text-accent">{children}</ul>;
