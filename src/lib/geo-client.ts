"use client";

import { TZ_COUNTRY as TZ } from "./tz";

export type Geo = { country: string; dial: string | null };

/** The visitor's country: server-side IP/geo-header detection first, then time zone, then browser language. */
export async function detectCountry(valid: (c: string) => boolean): Promise<string> {
  try {
    const cached = sessionStorage.getItem("ev-geo");
    if (cached && valid(cached)) return cached;
  } catch {}
  let c: string | null = null;
  try {
    const r = await fetch("/api/geo", { cache: "no-store" });
    const j = await r.json();
    if (j.country && valid(j.country)) c = j.country;
  } catch {}
  if (!c) {
    try { const tz = TZ[Intl.DateTimeFormat().resolvedOptions().timeZone]; if (tz && valid(tz)) c = tz; } catch {}
  }
  if (!c) {
    const region = navigator.language.match(/-([A-Za-z]{2})$/)?.[1]?.toUpperCase();
    if (region && valid(region)) c = region;
  }
  c ??= "US";
  try { sessionStorage.setItem("ev-geo", c); } catch {}
  return c;
}
