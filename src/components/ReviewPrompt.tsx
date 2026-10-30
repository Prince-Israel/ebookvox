"use client";
import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import Link from "next/link";
import { Button, Sheet } from "@/components/ui";
import { isNativeApp, usePublicConfig } from "@/lib/public-config";

const KEY = "ev-review";
const GAP_DAYS = 60;

/**
 * After a reader finishes a book, asks if they are enjoying Ebookvox and, if they are, sends them to rate it on Google Play.
 * Only Android readers are asked (the Play listing is where the rating goes), at most once every 60 days, and never again after "Don't ask again".
 */
export function ReviewPrompt() {
  const cfg = usePublicConfig();
  const [book, setBook] = useState<string | null>(null);
  const [happy, setHappy] = useState(false);

  useEffect(() => {
    const onDone = (e: Event) => {
      const title = (e as CustomEvent<{ title?: string }>).detail?.title ?? "your book";
      const android = isNativeApp() ? (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "android" : /Android/i.test(navigator.userAgent);
      if (!android) return;
      try {
        const s = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { at?: number; never?: boolean };
        if (s.never || (s.at && Date.now() - s.at < GAP_DAYS * 86400_000)) return;
      } catch {}
      setHappy(false);
      setBook(title);
    };
    window.addEventListener("ev:book-finished", onDone);
    return () => window.removeEventListener("ev:book-finished", onDone);
  }, []);

  const remember = (never = false) => { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), never })); } catch {} };
  const close = (never = false) => { remember(never); setBook(null); };

  async function rate() {
    remember();
    const url = cfg?.playStoreUrl ?? "https://play.google.com/store/apps/details?id=app.ebookvox.reader";
    setBook(null);
    if (isNativeApp()) { try { const { Browser } = await import("@capacitor/browser"); await Browser.open({ url }); return; } catch {} }
    window.open(url, "_blank", "noopener");
  }

  return (
    <Sheet open={!!book} onClose={() => close()} title={happy ? "Thank you!" : "You finished a book"}>
      <div className="space-y-5 text-left">
        {!happy ? (
          <>
            <p className="text-lg">You finished <strong>{book}</strong>. Are you enjoying Ebookvox?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" onClick={() => setHappy(true)}><Heart className="size-5" /> Yes, I love it</Button>
              <Link href="/support" onClick={() => close()} className="inline-flex h-14 items-center justify-center rounded-full border border-line bg-surface px-6 font-semibold hover:bg-surface2">Not really</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg">That makes our day. A short review on Google Play helps other readers find Ebookvox.</p>
            <Button size="lg" className="w-full" onClick={rate}><Star className="size-5 fill-current" /> Rate Ebookvox on Google Play</Button>
          </>
        )}
        <div className="flex justify-between text-sm text-muted">
          <button type="button" onClick={() => close()} className="h-10 rounded-full px-3 hover:bg-surface2">Maybe later</button>
          <button type="button" onClick={() => close(true)} className="h-10 rounded-full px-3 hover:bg-surface2">Don&apos;t ask again</button>
        </div>
      </div>
    </Sheet>
  );
}
