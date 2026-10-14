const SYMBOL: Record<string, string> = { NGN: "₦", GBP: "£", EUR: "€", USD: "$" };

export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const sym = SYMBOL[currency] ?? "";
  const num = major.toLocaleString("en-US", { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  return `${sym}${num} ${currency}`;
}
