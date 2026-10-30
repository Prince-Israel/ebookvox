"use client";
import { useEffect, useState } from "react";

export type PublicConfig = {
  build: string | null;
  publisherUrl: string;
  publisherSignUpUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  apkUrl: string;
  ads: {
    adsense: { client: string; slots: { homeTop: string | null; homeBottom: string | null } } | null;
    videoTagUrl: string | null;
    admob: { testing: boolean; android: { banner: string; video: string; rewarded: string | null }; ios: { banner: string; video: string; rewarded: string | null } };
  };
};

let cache: PublicConfig | null = null;
let inflight: Promise<PublicConfig | null> | null = null;
const load = () => (inflight ??= fetch("/api/public-config").then((r) => r.json()).then((c) => (cache = c)).catch(() => null));

/** The same config without a hook: resolves once it has loaded (null if it can't be reached). */
export const getPublicConfig = (): Promise<PublicConfig | null> => (cache ? Promise.resolve(cache) : load());

export function usePublicConfig() {
  const [c, setC] = useState<PublicConfig | null>(cache);
  useEffect(() => { if (!cache) void load().then((v) => v && setC(v)); }, []);
  return c;
}

/** True inside the iOS / Android app shell (where store badges and web ads make no sense). */
export function isNativeApp() {
  try { return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(); } catch { return false; }
}

export function useIsNative() {
  const [n, setN] = useState(false);
  useEffect(() => setN(isNativeApp()), []);
  return n;
}
