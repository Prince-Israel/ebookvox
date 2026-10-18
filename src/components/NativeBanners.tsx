"use client";
import { useEffect, useState } from "react";
import { useAuth } from "./UserContext";
import { useIsNative, usePublicConfig } from "@/lib/public-config";

/**
 * The header and footer banners of Home inside the mobile apps (AdMob). The AdMob plugin can show one banner at a time, so the header banner
 * is shown while you're at the top of the page and the footer banner once you reach the bottom. Subscribers never see them.
 * The page keeps matching blank bands (see <AdBand>) so a banner never covers content.
 */
export function NativeBanners() {
  const native = useIsNative();
  const cfg = usePublicConfig();
  const { user } = useAuth();
  const enabled = native && !!cfg && !user?.adFree;

  useEffect(() => {
    if (!enabled || !cfg) return;
    let alive = true, shown: "top" | "bottom" | null = null, timer: ReturnType<typeof setTimeout> | undefined, raf = 0;
    let AdMob: typeof import("@capacitor-community/admob").AdMob, BannerAdPosition: typeof import("@capacitor-community/admob").BannerAdPosition, BannerAdSize: typeof import("@capacitor-community/admob").BannerAdSize;
    const platform = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === "ios" ? "ios" : "android";
    const adId = cfg.ads.admob[platform].banner;

    const want = (): "top" | "bottom" | null => {
      const y = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
      if (y <= 60) return "top";
      if (max - y <= 140) return "bottom";
      return null;
    };
    async function apply() {
      if (!alive) return;
      const next = want();
      if (next === shown) return;
      shown = next;
      document.documentElement.style.setProperty("--ad-bottom", "0px");
      try {
        await AdMob.removeBanner();
        if (!next || !alive) return;
        // Android 15 pins the banner to the very top / bottom edge (the plugin ignores a margin there), so the page makes room for it instead:
        // a blank band above the header (see <TopAdBand>) and the bottom navigation lifted by --ad-bottom while the footer banner is up.
        await AdMob.showBanner({
          adId, isTesting: cfg!.ads.admob.testing, adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: next === "top" ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
        });
        if (next === "bottom") document.documentElement.style.setProperty("--ad-bottom", "56px");
      } catch (e) { console.warn("[ads] banner:", e); }
    }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { clearTimeout(timer); timer = setTimeout(apply, 450); }); };

    (async () => {
      ({ AdMob, BannerAdPosition, BannerAdSize } = await import("@capacitor-community/admob"));
      // iOS asks permission to personalise ads (App Tracking Transparency) before the first ad
      if (platform === "ios") { try { await AdMob.requestTrackingAuthorization(); } catch {} }
      try { await AdMob.initialize({ initializeForTesting: cfg.ads.admob.testing }); } catch {}
      if (!alive) return;
      window.addEventListener("scroll", onScroll, { passive: true });
      apply();
    })().catch((e) => console.warn("[ads] banners unavailable:", e));
    return () => {
      alive = false; clearTimeout(timer); cancelAnimationFrame(raf);
      document.documentElement.style.setProperty("--ad-bottom", "0px");
      window.removeEventListener("scroll", onScroll);
      import("@capacitor-community/admob").then(({ AdMob: a }) => a.removeBanner()).catch(() => {});
    };
  }, [enabled, cfg]);
  return null;
}

/** Blank space at the very end of Home (app, non-subscribers) so the footer banner never hides content. */
export function AdBand() {
  const native = useIsNative();
  const { user } = useAuth();
  if (!native || user?.adFree) return null;
  return <div aria-hidden className="mt-3 h-[56px]" />;
}

/** The band above the app header where the header banner sits: it scrolls away with the page, and the banner is removed as it does. */
export function TopAdBand({ active }: { active: boolean }) {
  const native = useIsNative();
  const { user } = useAuth();
  if (!native || user?.adFree || !active) return null;
  return <div aria-hidden className="h-[calc(env(safe-area-inset-top)+58px)] shrink-0" />;
}
