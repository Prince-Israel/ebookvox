"use client";
import { isNativeApp } from "./public-config";
import type { PublicConfig } from "./public-config";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("blocked"));
    document.head.appendChild(s);
  });
}

/** Mobile apps: a full-screen AdMob video interstitial. Resolves when the listener closes it — or straight away if there is no ad to show. */
async function nativeVideoAd(cfg: PublicConfig) {
  const { AdMob, InterstitialAdPluginEvents } = await import("@capacitor-community/admob");
  const platform = (window as any).Capacitor?.getPlatform?.() === "ios" ? "ios" : "android";
  const adId = cfg.ads.admob[platform].video;
  const handles: Array<{ remove: () => Promise<void> | void }> = [];
  try {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      (async () => {
        for (const ev of [InterstitialAdPluginEvents.Dismissed, InterstitialAdPluginEvents.FailedToLoad, InterstitialAdPluginEvents.FailedToShow]) handles.push(await AdMob.addListener(ev as any, finish as any));
        await AdMob.prepareInterstitial({ adId, isTesting: cfg.ads.admob.testing });
        await AdMob.showInterstitial();
      })().catch(finish);
      setTimeout(finish, 60_000); // never trap the listener
    });
  } finally {
    for (const h of handles) { try { await h.remove(); } catch {} }
  }
}

/** Website: a pre-roll video through Google's IMA SDK using the configured VAST tag. Any failure (blocked, no fill, unsupported) just lets playback start. */
async function webVideoAd(cfg: PublicConfig) {
  const tag = cfg.ads.videoTagUrl;
  if (!tag) return;
  try { await loadScript("https://imasdk.googleapis.com/js/sdkloader/ima3.js"); } catch { return; }
  const ima = (window as any).google?.ima;
  if (!ima) return;

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-label", "Advertisement");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2000;background:rgba(15,10,8,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:system-ui,sans-serif;color:#fbf1e4";
  overlay.innerHTML = `<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.8">Advertisement — your reading starts right after</div>
    <div id="ev-ad-box" style="position:relative;width:min(92vw,720px);aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden"><video id="ev-ad-video" playsinline style="position:absolute;inset:0;width:100%;height:100%"></video><div id="ev-ad-ui" style="position:absolute;inset:0"></div></div>
    <a href="/subscribe" style="color:#f6a67a;font-size:14px;font-weight:600">Remove ads — go ad-free</a>`;
  document.body.appendChild(overlay);
  const video = overlay.querySelector("#ev-ad-video") as HTMLVideoElement;
  const ui = overlay.querySelector("#ev-ad-ui") as HTMLElement;
  let manager: any;
  try {
    await new Promise<void>((resolve) => {
      let done = false, started = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const container = new ima.AdDisplayContainer(ui, video);
      container.initialize(); // needs the tap that started playback
      const loader = new ima.AdsLoader(container);
      loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, finish, false);
      loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e: any) => {
        manager = e.getAdsManager(video);
        manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, finish);
        for (const t of [ima.AdEvent.Type.ALL_ADS_COMPLETED, ima.AdEvent.Type.SKIPPED, ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, ima.AdEvent.Type.USER_CLOSE]) manager.addEventListener(t, finish);
        manager.addEventListener(ima.AdEvent.Type.STARTED, () => { started = true; });
        try { manager.init(ui.clientWidth, ui.clientHeight, ima.ViewMode.NORMAL); manager.start(); } catch { finish(); }
      }, false);
      const req = new ima.AdsRequest();
      req.adTagUrl = tag;
      req.linearAdSlotWidth = ui.clientWidth || 640; req.linearAdSlotHeight = ui.clientHeight || 360;
      loader.requestAds(req);
      setTimeout(() => { if (!started) finish(); }, 10_000); // no ad started: don't make the listener wait
      setTimeout(finish, 90_000);
    });
  } catch {} finally {
    try { manager?.destroy(); } catch {}
    overlay.remove();
  }
}

/**
 * Plays one video ad and resolves when it is over (finished, skipped, failed or not configured). Never rejects, so playback can always follow.
 * Call it directly from the tap that starts playback (browsers only allow ad video to start from a tap).
 */
export async function showVideoAd(cfg: PublicConfig | null): Promise<void> {
  if (!cfg) return;
  try {
    if (isNativeApp()) await nativeVideoAd(cfg);
    else await webVideoAd(cfg);
  } catch {}
  await sleep(50);
}
