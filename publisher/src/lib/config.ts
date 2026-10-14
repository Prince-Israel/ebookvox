// Business rules in one place.
export const PUBLISHER_SHARE_PCT = 85; // publisher earns 85%, platform keeps 15%

/** Minimum withdrawal per wallet currency, in minor units. NGN ₦100,000 / USD $100 (GBP and EUR set to roughly equivalent values). */
export const MIN_WITHDRAWAL: Record<string, number> = { NGN: 100_000_00, USD: 100_00, GBP: 80_00, EUR: 95_00 };

export const CATEGORIES = [
  "Classic Fiction", "Contemporary Fiction", "Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Horror", "Historical",
  "Poetry", "Children's", "Young Adult", "Biography", "Business", "Self-Development", "Religion & Spirituality", "Philosophy", "Education",
  "Health & Wellness", "Technology", "Non-fiction", "Other",
] as const;

export const NIGERIAN_BANKS = [
  ["044", "Access Bank"], ["063", "Access Bank (Diamond)"], ["050", "Ecobank Nigeria"], ["070", "Fidelity Bank"], ["011", "First Bank of Nigeria"],
  ["214", "First City Monument Bank (FCMB)"], ["058", "Guaranty Trust Bank (GTBank)"], ["030", "Heritage Bank"], ["301", "Jaiz Bank"], ["082", "Keystone Bank"],
  ["50211", "Kuda Microfinance Bank"], ["999992", "OPay"], ["999991", "PalmPay"], ["076", "Polaris Bank"], ["101", "Providus Bank"], ["221", "Stanbic IBTC Bank"],
  ["068", "Standard Chartered Bank"], ["232", "Sterling Bank"], ["100", "Suntrust Bank"], ["032", "Union Bank of Nigeria"], ["033", "United Bank for Africa (UBA)"],
  ["215", "Unity Bank"], ["035", "Wema Bank"], ["057", "Zenith Bank"], ["090405", "Moniepoint Microfinance Bank"],
].map(([code, name]) => ({ code, name }));

export const SUPPORTED_CURRENCIES = ["NGN", "GBP", "EUR", "USD"] as const;

/** Indicative conversion used ONLY to pre-fill the other price boxes in the upload form. Publishers can edit every value. */
export const SUGGEST_PER_USD: Record<string, number> = { NGN: 1500, GBP: 0.8, EUR: 0.92, USD: 1 };

export const BOOK_STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", REVIEWING: "Reviewing", APPROVED: "Approved", REJECTED: "Rejected", PUBLISHED: "Published" };
