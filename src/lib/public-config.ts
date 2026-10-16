"use client";
import { useEffect, useState } from "react";

export type PublicConfig = {
  publisherUrl: string;
  publisherSignUpUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  apkUrl: string;
  adsense: { client: string; slots: { home: string | null; books: string | null } } | null;
};

let cache: PublicConfig | null = null;
let inflight: Promise<PublicConfig | null> | null = null;
const load = () => (inflight ??= fetch("/api/public-config").then((r) => r.json()).then((c) => (cache = c)).catch(() => null));

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
