"use client";
import { useEffect } from "react";

/** Tells the server the device's time zone (a cookie) so prices and defaults follow where the user really is, even on networks where the IP says nothing. */
export function GeoHint() {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && !document.cookie.split("; ").includes(`ev-tz=${encodeURIComponent(tz)}`)) document.cookie = `ev-tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);
  return null;
}
