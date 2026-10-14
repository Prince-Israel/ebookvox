"use client";
import { Badge } from "./ui";
import { formatMoney } from "@/lib/money";

type Tone = "neutral" | "warn" | "success" | "danger" | "accent";
const TONE: Record<string, Tone> = {
  ACTIVE: "success", SUSPENDED: "danger", DELETED: "neutral", PAID: "success", PENDING: "warn", FAILED: "danger", PROCESSING: "warn", REJECTED: "danger", REFUNDED: "neutral",
  APPROVED: "success", PUBLISHED: "success", REVIEWING: "warn", DRAFT: "neutral", ARCHIVED: "neutral", REMOVED: "danger",
  OPEN: "accent", WAITING_USER: "warn", WAITING_PUBLISHER: "warn", WAITING_ADMIN: "accent", CLOSED: "neutral",
};
const LABEL: Record<string, string> = { WAITING_USER: "Waiting for User", WAITING_PUBLISHER: "Waiting for Publisher", WAITING_ADMIN: "Open", REVIEWING: "Under review", PROCESSING: "Processing" };
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={TONE[status] ?? "neutral"}>{LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}</Badge>;

export const dateFmt = (d: string | Date | null | undefined, time = false) =>
  d ? new Date(d).toLocaleString(undefined, time ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }) : "—";

export function Prices({ prices, free }: { prices: Record<string, number>; free: boolean }) {
  if (free) return <span className="font-semibold text-success">FREE</span>;
  const e = Object.entries(prices);
  return e.length ? <span className="tabular-nums">{e.map(([c, v]) => formatMoney(v, c)).join(" · ")}</span> : <span className="text-muted">—</span>;
}
export const MoneyList = ({ items, empty = "—" }: { items: Array<{ currency: string; amountMinor: number }>; empty?: string }) => items.length ? <>{items.map((i) => <span key={i.currency} className="block tabular-nums">{formatMoney(i.amountMinor, i.currency)}</span>)}</> : <span className="text-muted">{empty}</span>;
