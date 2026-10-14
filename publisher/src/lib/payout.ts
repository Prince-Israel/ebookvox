// Nigerian publishers are paid by bank transfer; everyone else by PayPal.
export const methodFor = (country: string) => (country === "NG" ? "BANK" : "PAYPAL");

export function destLabel(snapshot: string) {
  try { const s = JSON.parse(snapshot); return s.type === "BANK" ? `${s.bankName} ••••${String(s.accountNumber).slice(-4)}` : s.paypalEmail; } catch { return ""; }
}
