import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { walletSummary } from "@/lib/wallet";

export const GET = route(async (req) => {
  const u = await requirePublisher();
  const currency = req.nextUrl.searchParams.get("currency");
  const [wallets, tx] = await Promise.all([
    walletSummary(u.id),
    db.walletTx.findMany({ where: { publisherId: u.id, ...(currency ? { currency } : {}) }, orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  return { primaryCurrency: u.currency, wallets, transactions: tx.map((t) => ({ id: t.id, type: t.type, currency: t.currency, amountMinor: t.amountMinor, description: t.description, createdAt: t.createdAt })) };
});
