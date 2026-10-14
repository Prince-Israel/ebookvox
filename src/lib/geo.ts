import { NextRequest } from "next/server";
import { isCountry } from "./countries";

const cache = new Map<string, { country: string | null; at: number }>();
const HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code", "x-appengine-country"];
const isPrivate = (ip: string) => !ip || ip === "::1" || ip === "127.0.0.1" || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i.test(ip) || ip.startsWith("::ffff:127.");

/**
 * Best guess of the visitor's country: CDN/proxy geo headers first, then an IP lookup
 * (for local development the server's own public IP is the visitor's), then the browser language region.
 */
export async function countryOf(req: NextRequest): Promise<string | null> {
  for (const h of HEADERS) {
    const v = req.headers.get(h)?.toUpperCase();
    if (v && v.length === 2 && isCountry(v)) return v;
  }
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const key = isPrivate(fwd) ? "self" : fwd;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600_000) { if (hit.country) return hit.country; }
  else {
    let country: string | null = null;
    try {
      const res = await fetch(`https://ipwho.is/${key === "self" ? "" : encodeURIComponent(key)}?fields=success,country_code`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
      const j = await res.json();
      if (j.success && isCountry(String(j.country_code).toUpperCase())) country = String(j.country_code).toUpperCase();
    } catch {}
    cache.set(key, { country, at: Date.now() });
    if (country) return country;
  }
  const region = req.headers.get("accept-language")?.match(/-([A-Za-z]{2})\b/)?.[1]?.toUpperCase();
  return region && isCountry(region) ? region : null;
}
