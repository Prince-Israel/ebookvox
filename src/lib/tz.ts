// IANA time zone → country, a coarse way to place a visitor whose IP can't be used (private networks, VPN-less dev, offline geo lookups).
export const TZ_COUNTRY: Record<string, string> = {
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Addis_Ababa": "ET", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Douala": "CM", "Africa/Kinshasa": "CD", "Africa/Luanda": "AO",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE",
  "Europe/Lisbon": "PT", "Europe/Vienna": "AT", "Europe/Athens": "GR", "Europe/Helsinki": "FI", "Europe/Zurich": "CH", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Warsaw": "PL",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP", "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ",
};

export const countryFromTimeZone = (tz?: string | null) => (tz ? TZ_COUNTRY[tz] ?? null : null);
