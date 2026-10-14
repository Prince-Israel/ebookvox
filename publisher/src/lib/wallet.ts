import { db } from "./db";
import { getMinWithdrawals } from "./platform-config";
import { CURRENCIES } from "./countries";

export type WalletSummary = { currency: string; available: number; earned: number; withdrawn: number; pending: number; minWithdrawal: number };

/** All figures are derived from the append-only ledger and withdrawal records — never stored as editable balances. */
export async function walletSummary(publisherId: string): Promise<WalletSummary[]> {
  const [tx, wd] = await Promise.all([
    db.walletTx.groupBy({ by: ["currency", "type"], where: { publisherId }, _sum: { amountMinor: true } }),
    db.withdrawal.groupBy({ by: ["currency", "status"], where: { publisherId }, _sum: { amountMinor: true } }),
  ]);
  const mins = await getMinWithdrawals();
  return (CURRENCIES as string[]).map((currency) => {
    const t = (type: string) => tx.find((x) => x.currency === currency && x.type === type)?._sum.amountMinor ?? 0;
    const w = (status: string) => wd.find((x) => x.currency === currency && x.status === status)?._sum.amountMinor ?? 0;
    return {
      currency,
      available: tx.filter((x) => x.currency === currency).reduce((n, x) => n + (x._sum.amountMinor ?? 0), 0),
      earned: t("SALE_CREDIT"),
      withdrawn: w("PAID"),
      pending: w("PROCESSING"),
      minWithdrawal: mins[currency],
    };
  });
}
