"use client";
import { useEffect, useRef } from "react";
import { useIsNative, usePublicConfig } from "@/lib/public-config";

declare global { interface Window { adsbygoogle?: unknown[] } }

/**
 * A Google AdSense ad unit for the website. Shows nothing until ADSENSE_CLIENT (and the slot id for this placement) are set in .env,
 * and never inside the mobile apps (they use AdMob instead — see docs/ADS.md).
 */
export function AdSlot({ name, className }: { name: "home" | "books"; className?: string }) {
  const c = usePublicConfig();
  const native = useIsNative();
  const pushed = useRef(false);
  const client = c?.adsense?.client;
  const slot = c?.adsense?.slots[name];

  useEffect(() => {
    if (!client || !slot || native || pushed.current) return;
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
  }, [client, slot, native]);

  if (!client || !slot || native) return null;
  return (
    <aside aria-label="Advertisement" className={className}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-muted">Advertisement</p>
      <ins className="adsbygoogle block overflow-hidden rounded-2xl" style={{ display: "block", minHeight: 90 }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
