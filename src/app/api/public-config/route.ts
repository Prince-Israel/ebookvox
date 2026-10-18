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
    playStoreUrl: e.PLAY_STORE_URL || null,
    appStoreUrl: e.APP_STORE_URL || null,
    apkUrl: e.APK_DOWNLOAD_URL || "https://github.com/Prince-Israel/ebookvox/raw/main/downloads/Ebookvox-Reader-android.apk",
    adsense: e.ADSENSE_CLIENT ? { client: e.ADSENSE_CLIENT, slots: { home: e.ADSENSE_SLOT_HOME || null, books: e.ADSENSE_SLOT_BOOKS || null } } : null,
  };
});
