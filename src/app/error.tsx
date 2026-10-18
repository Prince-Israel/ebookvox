"use client";
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

/** Shown when a screen crashes: branded, with a way back, instead of a blank page. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mb-8 flex justify-center"><Logo size={48} /></div>
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted">We couldn&apos;t show this page. Check your internet connection and try again.</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={reset} className="h-14 rounded-full bg-primary px-8 text-base font-semibold text-primary-fg">Try again</button>
          <a href="/home" className="text-sm font-medium text-muted underline">Go to Home</a>
        </div>
      </div>
    </main>
  );
}
