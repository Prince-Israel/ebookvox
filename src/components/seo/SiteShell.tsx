import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LegalFooter } from "@/components/LegalFooter";

const NAV = [["/books", "Books"], ["/category", "Categories"], ["/text-to-speech", "Text to speech"], ["/pdf-to-audio", "PDF to audio"], ["/blog", "Blog"]] as const;

/** A light public page frame (header, content, footer) for the pages search engines land on. Everything is server-rendered. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-t border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/home" aria-label="Ebookvox home"><Logo size={32} /></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map(([href, label]) => <Link key={href} href={href} className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-surface2 hover:text-fg">{label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className="hidden h-10 items-center rounded-full px-4 text-sm font-medium hover:bg-surface2 sm:inline-flex">Sign in</Link>
            <Link href="/home" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg hover:bg-primary-hover">Open the app</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-12">{children}</main>
      <LegalFooter className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8" />
    </div>
  );
}
