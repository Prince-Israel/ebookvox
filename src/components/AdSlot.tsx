"use client";
import { useEffect, useRef } from "react";
import { useIsNative, usePublicConfig } from "@/lib/public-config";
import { useAuth } from "./UserContext";

declare global { interface Window { adsbygoogle?: unknown[] } }

/**
 * A very small (one-line) Google AdSense banner for the website. Hidden for subscribers. Shows nothing until ADSENSE_CLIENT (and the slot id for this placement) are set in .env,
 * and never inside the mobile apps (they use AdMob instead — see docs/ADS.md).
 */
export function AdSlot({ name, className }: { name: "homeTop" | "homeBottom"; className?: string }) {
  const user = useAuth().user;
  const c = usePublicConfig();
  const native = useIsNative();
  const pushed = useRef(false);
  const client = c?.ads.adsense?.client;
  const slot = c?.ads.adsense?.slots[name];
  const adFree = !!user?.adFree;

  useEffect(() => {
    if (!client || !slot || native || adFree || pushed.current) return;
    if (!document.querySelector("script[data-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.crossOrigin = "anonymous";
      s.dataset.adsense = "1";
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(s);
    }
    pushed.current = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, [client, slot, native, adFree]);

  if (!client || !slot || native || adFree) return null;
  return (
    <aside aria-label="Advertisement" className={className}>
      <p className="mb-0.5 flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-muted">Advertisement · <a href="/subscribe" className="underline">Remove ads</a></p>
      <ins className="adsbygoogle block overflow-hidden rounded-2xl" style={{ display: "block", height: 56, maxHeight: 60 }} data-ad-client={client} data-ad-slot={slot} data-ad-format="horizontal" data-full-width-responsive="false" />
    </aside>
  );
}
