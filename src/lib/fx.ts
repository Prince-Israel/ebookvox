import { db } from "./db";
import type { CurrencyCode } from "./countries";

/** Last-resort rates (units per 1 USD) used only if the live feed and the stored copy are both unavailable. */
const FALLBACK: Record<string, number> = { USD: 1, NGN: 1500, GBP: 0.78, EUR: 0.92 };
const FEED = process.env.FX_RATES_URL ?? "https://open.er-api.com/v6/latest/USD";
const TTL = 60 * 60_000;
const KEY = "fx.rates";

type Rates = { rates: Record<string, number>; at: number; source: "live" | "stored" | "fallback" };
let mem: Rates | null = null;
let inflight: Promise<Rates> | null = null;

async function refresh(): Promise<Rates> {
  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    const j = await res.json();
    const r = j?.rates ?? {};
    const out: Record<string, number> = { USD: 1 };
    for (const c of Object.keys(FALLBACK)) if (typeof r[c] === "number" && r[c] > 0) out[c] = r[c];
    if (Object.keys(out).length === Object.keys(FALLBACK).length) {
      const fresh: Rates = { rates: out, at: Date.now(), source: "live" };
      await db.platformConfig.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(fresh) }, update: { value: JSON.stringify(fresh) } }).catch(() => {});
      return fresh;
    }
  } catch {}
  const row = await db.platformConfig.findUnique({ where: { key: KEY } }).catch(() => null);
  if (row) {
    try {
      const j = JSON.parse(row.value) as Rates;
      if (j.rates) return { rates: j.rates, at: j.at, source: "stored" };
    } catch {}
  }
  return { rates: FALLBACK, at: Date.now(), source: "fallback" };
}

/** International (mid-market) rates, refreshed hourly and kept in the database so a feed outage never blocks checkout. */
export async function getRates(): Promise<Rates> {
  if (mem && Date.now() - mem.at < TTL) return mem;
  inflight ??= refresh().then((r) => (mem = r)).finally(() => { inflight = null; });
  return inflight;
}

/** How many `to` units one `from` unit is worth. */
export async function rateBetween(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const { rates } = await getRates();
  return rates[to] / rates[from];
}

/** Prices are rounded to something a shopper would expect to pay: whole naira (to 10), whole cents otherwise (to 5 cents). */
export function roundPrice(amountMinor: number, currency: string) {
  const step = currency === "NGN" ? 1000 : 5;
  return Math.max(step, Math.round(amountMinor / step) * step);
}

export async function convertMinor(amountMinor: number, from: string, to: string) {
  if (from === to) return { amountMinor, rate: 1 };
  const rate = await rateBetween(from, to);
  return { amountMinor: roundPrice(amountMinor * rate, to), rate };
}

export type { CurrencyCode };
