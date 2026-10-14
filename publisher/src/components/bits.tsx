"use client";
import { Badge } from "./ui";
import { formatMoney } from "@/lib/money";

const TONE: Record<string, "neutral" | "warn" | "success" | "danger" | "accent"> = { DRAFT: "neutral", REVIEWING: "warn", APPROVED: "accent", REJECTED: "danger", PUBLISHED: "success", REMOVED: "danger", PAID: "success", PROCESSING: "warn", PAID_OUT: "success", REFUNDED: "danger" };
const LABEL: Record<string, string> = { DRAFT: "Draft", REVIEWING: "Reviewing", APPROVED: "Approved", REJECTED: "Rejected", PUBLISHED: "Published", REMOVED: "Removed", PROCESSING: "Processing", PAID: "Paid", REFUNDED: "Refunded" };
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={TONE[status] ?? "neutral"}>{LABEL[status] ?? status}</Badge>;

/** A money figure for the primary currency, with any other non-zero currencies listed beneath (never summed together). */
export function MoneyStack({ values, primary }: { values: Array<{ currency: string; amountMinor: number }>; primary: string }) {
  const main = values.find((v) => v.currency === primary)?.amountMinor ?? 0;
  const others = values.filter((v) => v.currency !== primary && v.amountMinor !== 0);
  return (
    <div>
      <p className="font-serif text-3xl font-semibold tabular-nums">{formatMoney(main, primary)}</p>
      {others.map((o) => <p key={o.currency} className="text-sm tabular-nums text-muted">+ {formatMoney(o.amountMinor, o.currency)}</p>)}
    </div>
  );
}

export const dateFmt = (d: string | Date | null | undefined, time = false) =>
  d ? new Date(d).toLocaleString(undefined, time ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }) : "—";
