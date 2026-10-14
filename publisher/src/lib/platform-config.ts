import { db } from "./db";
import { CATEGORIES, MIN_WITHDRAWAL } from "./config";

/** Settings pushed from the Admin platform, with the built-in defaults as fallback. */
async function get<T>(key: string, fallback: T): Promise<T> {
  const row = await db.platformConfig.findUnique({ where: { key } });
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}
export const getCategories = () => get<string[]>("categories", [...CATEGORIES]);
export const getMinWithdrawals = () => get<Record<string, number>>("minWithdrawals", MIN_WITHDRAWAL);
