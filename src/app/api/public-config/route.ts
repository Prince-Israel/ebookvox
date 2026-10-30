import { statSync } from "node:fs";
import path from "node:path";
import { route } from "@/lib/api";

// When this release was built (the time Next.js wrote its BUILD_ID), shown on the Profile page so you can tell which version you are on.
const BUILT = (() => {
  try { return statSync(path.join(process.cwd(), process.env.DIST_DIR ?? ".next", "BUILD_ID")).mtime.toISOString().slice(0, 16).replace("T", " ") + " UTC"; } catch { return null; }
})();

/**
 * Values the browser/mobile app needs but that differ per deployment (set in .env, read at start-up — no rebuild needed).
 * Everything here is public by design: links and ad-publisher ids, never secrets.
 */
export const GET = route(async () => {
  const e = process.env;
  const publisherUrl = (e.PUBLISHER_PUBLIC_URL ?? "http://localhost:3240").replace(/\/$/, "");
  return {
    build: BUILT,
    publisherUrl,
    publisherSignUpUrl: `${publisherUrl}/sign-up`,
    playStoreUrl: e.PLAY_STORE_URL || "https://play.google.com/store/apps/details?id=app.ebookvox.reader",
    appStoreUrl: e.APP_STORE_URL || null,
    apkUrl: e.APK_DOWNLOAD_URL || "https://github.com/Prince-Israel/ebookvox/raw/main/downloads/Ebookvox-Reader-android.apk",
    ads: {
      // Website: small banners at the top and bottom of Home (Google AdSense)
      adsense: e.ADSENSE_CLIENT ? { client: e.ADSENSE_CLIENT, slots: { homeTop: e.ADSENSE_SLOT_HOME_TOP || null, homeBottom: e.ADSENSE_SLOT_HOME_BOTTOM || null } } : null,
      // Website: the video ad before the voice starts (a VAST tag, e.g. from Google Ad Manager / AdSense for Video), played through Google's IMA SDK
      videoTagUrl: e.VIDEO_AD_TAG_URL || null,
      // Mobile apps (AdMob). Anything not configured falls back to Google's TEST ads, which are safe to click and never earn money.
      admob: {
        testing: e.ADMOB_TESTING === "true" || !(e.ADMOB_ANDROID_BANNER_ID && e.ADMOB_ANDROID_VIDEO_ID && e.ADMOB_IOS_BANNER_ID && e.ADMOB_IOS_VIDEO_ID),
        android: { banner: e.ADMOB_ANDROID_BANNER_ID || "ca-app-pub-3940256099942544/6300978111", video: e.ADMOB_ANDROID_VIDEO_ID || "ca-app-pub-3940256099942544/8691691433" },
        ios: { banner: e.ADMOB_IOS_BANNER_ID || "ca-app-pub-3940256099942544/2934735716", video: e.ADMOB_IOS_VIDEO_ID || "ca-app-pub-3940256099942544/5135589807" },
      },
    },
  };
});
