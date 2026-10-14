import { PUBLISHER_SHARE_PCT } from "./config";

const SYMBOL: Record<string, string> = { NGN: "₦", GBP: "£", EUR: "€", USD: "$" };

export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const num = major.toLocaleString("en-US", { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return `${SYMBOL[currency] ?? ""}${num} ${currency}`;
}

/** 85 / 15 split in integer minor units; the two parts always add up to the gross exactly. */
export function splitSale(grossMinor: number) {
  const publisherMinor = Math.floor((grossMinor * PUBLISHER_SHARE_PCT) / 100);
  return { publisherMinor, platformMinor: grossMinor - publisherMinor };
}
