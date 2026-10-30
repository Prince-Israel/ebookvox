"use client";
import { isNativeApp } from "./public-config";
import type { PublicConfig } from "./public-config";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What happened to the video: watched to the end (reward earned), closed early (no reward), or there was no ad to show (never blocks the listener). */
export type VideoAdResult = "watched" | "skipped" | "unavailable";

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("blocked"));
    document.head.appendChild(s);
  });
}

/**
 * Mobile apps: a full-screen AdMob video. With a rewarded unit configured the listener must watch it to the end to earn the reward;
 * otherwise the interstitial unit is used and finishing it counts as watched. No ad to show means no blocking.
 */
async function nativeVideoAd(cfg: PublicConfig): Promise<VideoAdResult> {
  // not inside a real app (a stand-in page, a preview): there is no ad plugin to talk to, so there is nothing to wait for
  if (typeof (window as any).Capacitor?.getPlatform !== "function") return "unavailable";
  const { AdMob, InterstitialAdPluginEvents, RewardAdPluginEvents } = await import("@capacitor-community/admob");
  const platform = (window as any).Capacitor?.getPlatform?.() === "ios" ? "ios" : "android";
  const units = cfg.ads.admob[platform];
  const handles: Array<{ remove: () => Promise<void> | void }> = [];
  let result: VideoAdResult = "unavailable";
  try {
    await new Promise<void>((resolve) => {
      let done = false, earned = false;
      const finish = (r: VideoAdResult) => { if (!done) { done = true; result = r; resolve(); } };
      (async () => {
        if (units.rewarded) {
          handles.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded as any, (() => { earned = true; }) as any));
          handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed as any, (() => finish(earned ? "watched" : "skipped")) as any));
          for (const ev of [RewardAdPluginEvents.FailedToLoad, RewardAdPluginEvents.FailedToShow]) handles.push(await AdMob.addListener(ev as any, (() => finish("unavailable")) as any));
          await AdMob.prepareRewardVideoAd({ adId: units.rewarded, isTesting: cfg.ads.admob.testing });
          await AdMob.showRewardVideoAd();
        } else {
          handles.push(await AdMob.addListener(InterstitialAdPluginEvents.Dismissed as any, (() => finish("watched")) as any));
          for (const ev of [InterstitialAdPluginEvents.FailedToLoad, InterstitialAdPluginEvents.FailedToShow]) handles.push(await AdMob.addListener(ev as any, (() => finish("unavailable")) as any));
          await AdMob.prepareInterstitial({ adId: units.video, isTesting: cfg.ads.admob.testing });
          await AdMob.showInterstitial();
        }
      })().catch(() => finish("unavailable"));
      setTimeout(() => finish("unavailable"), 90_000); // never trap the listener
    });
  } finally {
    for (const h of handles) { try { await h.remove(); } catch {} }
  }
  return result;
}

/** Website: a pre-roll video through Google's IMA SDK using the configured VAST tag. Any failure (blocked, no fill, unsupported) just lets playback start. */
async function webVideoAd(cfg: PublicConfig): Promise<VideoAdResult> {
  const tag = cfg.ads.videoTagUrl;
  if (!tag) return "unavailable";
  try { await loadScript("https://imasdk.googleapis.com/js/sdkloader/ima3.js"); } catch { return "unavailable"; }
  const ima = (window as any).google?.ima;
  if (!ima) return "unavailable";

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-label", "Advertisement");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2000;background:rgba(15,10,8,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;font-family:system-ui,sans-serif;color:#fbf1e4";
  overlay.innerHTML = `<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.8">Watch to unlock listening</div>
    <div id="ev-ad-box" style="position:relative;width:min(92vw,720px);aspect-ratio:16/9;background:#000;border-radius:16px;overflow:hidden"><video id="ev-ad-video" playsinline style="position:absolute;inset:0;width:100%;height:100%"></video><div id="ev-ad-ui" style="position:absolute;inset:0"></div></div>
    <a href="/subscribe" style="color:#f6a67a;font-size:14px;font-weight:600">Remove ads — go ad-free</a>`;
  document.body.appendChild(overlay);
  const video = overlay.querySelector("#ev-ad-video") as HTMLVideoElement;
  const ui = overlay.querySelector("#ev-ad-ui") as HTMLElement;
  let manager: any;
  let result: VideoAdResult = "unavailable";
  try {
    await new Promise<void>((resolve) => {
      let done = false, started = false;
      const finish = (r: VideoAdResult = "unavailable") => { if (!done) { done = true; result = r; resolve(); } };
      const container = new ima.AdDisplayContainer(ui, video);
      container.initialize(); // needs the tap that started playback
      const loader = new ima.AdsLoader(container);
      loader.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => finish("unavailable"), false);
      loader.addEventListener(ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, (e: any) => {
        manager = e.getAdsManager(video);
        manager.addEventListener(ima.AdErrorEvent.Type.AD_ERROR, () => finish("unavailable"));
        // only watching to the end earns the reward; skipping or closing the video early does not
        manager.addEventListener(ima.AdEvent.Type.ALL_ADS_COMPLETED, () => finish("watched"));
        manager.addEventListener(ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => finish(started ? "watched" : "unavailable"));
        for (const t of [ima.AdEvent.Type.SKIPPED, ima.AdEvent.Type.USER_CLOSE]) manager.addEventListener(t, () => finish("skipped"));
        manager.addEventListener(ima.AdEvent.Type.STARTED, () => { started = true; });
        try { manager.init(ui.clientWidth, ui.clientHeight, ima.ViewMode.NORMAL); manager.start(); } catch { finish("unavailable"); }
      }, false);
      const req = new ima.AdsRequest();
      req.adTagUrl = tag;
      req.linearAdSlotWidth = ui.clientWidth || 640; req.linearAdSlotHeight = ui.clientHeight || 360;
      loader.requestAds(req);
      setTimeout(() => { if (!started) finish("unavailable"); }, 10_000); // no ad started: don't make the listener wait
      setTimeout(() => finish("unavailable"), 90_000);
    });
  } catch {} finally {
    try { manager?.destroy(); } catch {}
    overlay.remove();
  }
  return result;
}

/**
 * Plays the reward video. Resolves with whether it was watched to the end, closed early, or unavailable (not configured, blocked, no fill).
 * Never rejects. Call it from the tap that starts it (browsers only allow ad video to start from a tap).
 */
export async function showVideoAd(cfg: PublicConfig | null): Promise<VideoAdResult> {
  if (!cfg) return "unavailable";
  let r: VideoAdResult = "unavailable";
  try {
    r = isNativeApp() ? await nativeVideoAd(cfg) : await webVideoAd(cfg);
  } catch {}
  await sleep(50);
  return r;
}
