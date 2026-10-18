import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { viewer } from "@/lib/viewer";
import { walletBalances } from "@/lib/subscription";

export const GET = route(async (req) => {
  const u = await requireUser();
  const v = await viewer(req);
  const [balances, tx] = await Promise.all([walletBalances(u.id), db.walletTx.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 60 })]);
  return {
    currency: v.currency, // the currency of where the reader is now: what they can top up in and spend on a subscription
    balances,
    transactions: tx.map((t) => ({ id: t.id, type: t.type, currency: t.currency, amountMinor: t.amountMinor, description: t.description, createdAt: t.createdAt })),
  };
});
