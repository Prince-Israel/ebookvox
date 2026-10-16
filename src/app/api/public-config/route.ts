import { route } from "@/lib/api";

/**
 * Values the browser/mobile app needs but that differ per deployment (set in .env, read at start-up — no rebuild needed).
 * Everything here is public by design: links and ad-publisher ids, never secrets.
 */
export const GET = route(async () => {
  const e = process.env;
  const publisherUrl = (e.PUBLISHER_PUBLIC_URL ?? "http://localhost:3240").replace(/\/$/, "");
  return {
    publisherUrl,
    publisherSignUpUrl: `${publisherUrl}/sign-up`,
    playStoreUrl: e.PLAY_STORE_URL || null,
    appStoreUrl: e.APP_STORE_URL || null,
    apkUrl: e.APK_DOWNLOAD_URL || "https://github.com/Prince-Israel/ebookvox/raw/main/downloads/Ebookvox-Reader-android.apk",
    adsense: e.ADSENSE_CLIENT ? { client: e.ADSENSE_CLIENT, slots: { home: e.ADSENSE_SLOT_HOME || null, books: e.ADSENSE_SLOT_BOOKS || null } } : null,
  };
});
