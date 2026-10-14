import { db } from "./db";

export const APP_VERSION = "v1.0.0";
export const DEVELOPER = "Trinity Media Global";
export const COPYRIGHT = "© 2026 Ebookvox";

export const DEFAULT_CATEGORIES = [
  "Classic Fiction", "Contemporary Fiction", "Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance", "Horror", "Historical", "Poetry", "Children's",
  "Young Adult", "Biography", "Business", "Self-Development", "Religion & Spirituality", "Philosophy", "Education", "Health & Wellness", "Technology", "Non-fiction", "Other",
];

export const DEFAULTS = {
  company: { name: "Ebookvox", address: "", website: "" },
  supportEmail: "support@ebookvox.app",
  categories: DEFAULT_CATEGORIES,
  currency: { minWithdrawals: { NGN: 10_000_000, USD: 10_000, GBP: 8_000, EUR: 9_500 } as Record<string, number> },
  voice: { defaultVoice: "en-NG-EzinneNeural" },
};
export type Settings = typeof DEFAULTS;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out: any = structuredClone(DEFAULTS);
  for (const r of rows) { try { out[r.key] = JSON.parse(r.value); } catch {} }
  return out;
}
export async function saveSetting(key: keyof Settings, value: unknown) {
  await db.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
}
