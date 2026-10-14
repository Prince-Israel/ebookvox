"use client";

const TZ: Record<string, string> = {
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Addis_Ababa": "ET", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Douala": "CM", "Africa/Kinshasa": "CD", "Africa/Luanda": "AO",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE",
  "Europe/Lisbon": "PT", "Europe/Vienna": "AT", "Europe/Athens": "GR", "Europe/Helsinki": "FI", "Europe/Zurich": "CH", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Warsaw": "PL",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP", "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ",
};

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
