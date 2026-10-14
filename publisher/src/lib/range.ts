export const RANGES = { "7d": 7, "30d": 30, "3m": 90, "6m": 182, "1y": 365 } as const;
export type RangeKey = keyof typeof RANGES;
export const rangeStart = (r: string | null): Date | null => {
  const days = RANGES[(r ?? "") as RangeKey];
  if (!days) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days + 1);
  return d;
};
