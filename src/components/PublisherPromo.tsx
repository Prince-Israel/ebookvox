"use client";
import { ArrowUpRight, PenLine } from "lucide-react";
import { cx } from "./ui";
import { usePublicConfig } from "@/lib/public-config";

/** Invites authors and publishers to sell or give away their books. Links out to the Publisher site's registration page. */
export function PublisherPromo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const c = usePublicConfig();
  const href = c?.publisherSignUpUrl ?? "#";
  return (
    <section aria-labelledby="pubpromo" className={cx("overflow-hidden rounded-3xl bg-[#3a261c] text-[#fbf1e4] shadow-card", compact ? "p-5" : "p-6 sm:p-8", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15"><PenLine className="size-6" /></div>
          <div className="min-w-0">
            <h2 id="pubpromo" className="text-xl font-semibold sm:text-2xl">Are you an author or publisher?</h2>
            <p className="mt-1 text-sm opacity-90 sm:text-base">Upload your books on Ebookvox — sell them or share them free. Readers can read and listen in their own currency, worldwide.</p>
          </div>
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" aria-disabled={!c} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#fbf1e4] px-6 font-semibold text-[#3a261c] transition hover:bg-white active:scale-[0.98]">
          Publish your books <ArrowUpRight className="size-5" />
        </a>
      </div>
    </section>
  );
}
