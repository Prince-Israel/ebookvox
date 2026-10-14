import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export type Country = { code: string; name: string; dial: string };

const EURO = new Set("AT BE BG HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME".split(" "));
const GBP = new Set(["GB", "GG", "JE", "IM"]);

export type CurrencyCode = "NGN" | "GBP" | "EUR" | "USD";
export const CURRENCIES: CurrencyCode[] = ["NGN", "GBP", "EUR", "USD"];

export function currencyForCountry(code?: string | null): CurrencyCode {
  const c = (code ?? "").toUpperCase();
  if (c === "NG") return "NGN";
  if (GBP.has(c)) return "GBP";
  if (EURO.has(c)) return "EUR";
  return "USD";
}

let cache: Country[] | null = null;
export function listCountries(): Country[] {
  if (cache) return cache;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  cache = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code as CountryCode) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

export const isCountry = (code: string) => listCountries().some((c) => c.code === code);
export const countryName = (code?: string | null) => listCountries().find((c) => c.code === code)?.name ?? code ?? "";
