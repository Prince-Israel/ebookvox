import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { getMinWithdrawals } from "@/lib/platform-config";
import { formatMoney } from "@/lib/money";
import { notify, notifyAdmins } from "@/lib/notify";
import { emitEvent } from "@/lib/events";
import { destLabel, methodFor } from "@/lib/payout";

export const GET = route(async () => {
  const u = await requirePublisher();
  const list = await db.withdrawal.findMany({ where: { publisherId: u.id }, orderBy: { requestedAt: "desc" }, take: 300 });
  return { withdrawals: list.map((w) => ({ id: w.id, number: w.number, amountMinor: w.amountMinor, currency: w.currency, method: w.method, destination: destLabel(w.methodSnapshot), status: w.status, reason: w.reason, requestedAt: w.requestedAt, processedAt: w.processedAt })) };
});

export const POST = route(async (req) => {
  const u = await requirePublisher();
  rateLimit(`withdraw:${u.id}`, 10, 3600_000);
  const d = z.object({
    currency: z.enum(["NGN", "GBP", "EUR", "USD"]),
    amount: z.number().positive("Enter an amount.").max(1_000_000_000),
    idempotencyKey: z.string().min(8).max(100).optional(),
  }).parse(await readJson(req));
  const amountMinor = Math.round(d.amount * 100);
  if (Math.abs(d.amount * 100 - amountMinor) > 1e-6) throw new ApiError(400, "Amounts can have at most two decimal places.", { amount: "Max 2 decimal places." });

  const pm = await db.paymentMethod.findUnique({ where: { userId: u.id } });
  if (!pm || pm.type !== methodFor(u.country)) throw new ApiError(422, "Add a valid payment method before requesting a withdrawal.", { paymentMethod: "missing" });
  const min = (await getMinWithdrawals())[d.currency];
  if (amountMinor < min) throw new ApiError(422, `The minimum withdrawal is ${formatMoney(min, d.currency)}.`, { amount: `Minimum ${formatMoney(min, d.currency)}.` });

  const w = await db.$transaction(async (t) => {
    await t.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } }); // takes the write lock → requests per publisher are serialised
    if (d.idempotencyKey) {
      const dup = await t.withdrawal.findUnique({ where: { idempotencyKey: d.idempotencyKey } });
      if (dup) return dup;
    }
    const fresh = await t.user.findUnique({ where: { id: u.id } });
    if (fresh?.status !== "ACTIVE") throw new ApiError(403, "Your account is not active, so withdrawals are disabled. Contact support.");
    if (await t.withdrawal.findFirst({ where: { publisherId: u.id, status: "PROCESSING" } }))
      throw new ApiError(409, "You already have a withdrawal being processed. You can request another once it is paid or rejected.");
    const bal = (await t.walletTx.aggregate({ where: { publisherId: u.id, currency: d.currency }, _sum: { amountMinor: true } }))._sum.amountMinor ?? 0;
    if (amountMinor > bal) throw new ApiError(422, "Your withdrawal could not be submitted because your available balance is insufficient.", { amount: `Available: ${formatMoney(bal, d.currency)}` });
    const snapshot = JSON.stringify({ type: pm.type, bankCode: pm.bankCode, bankName: pm.bankName, accountName: pm.accountName, accountNumber: pm.accountNumber, paypalEmail: pm.paypalEmail });
    const row = await t.withdrawal.create({
      data: { number: `WD-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`.toUpperCase(), publisherId: u.id, currency: d.currency, amountMinor, method: pm.type, methodSnapshot: snapshot, idempotencyKey: d.idempotencyKey },
    });
    await t.walletTx.create({ data: { publisherId: u.id, currency: d.currency, type: "WITHDRAWAL_HOLD", amountMinor: -amountMinor, description: `Withdrawal ${row.number} requested`, withdrawalId: row.id } });
    return row;
  });
  await notify(u.id, "WITHDRAWAL_REQUESTED", "Withdrawal requested", `${formatMoney(w.amountMinor, w.currency)} — ${w.number}`, "/payouts");
  await notify(u.id, "WITHDRAWAL_PROCESSING", "Withdrawal processing", `Your withdrawal ${w.number} is being processed.`, "/payouts");
  await emitEvent("payout.requested", { id: w.id, number: w.number, publisher: u.publisherName, amountMinor: w.amountMinor, currency: w.currency });
  await notifyAdmins("WITHDRAWAL", "Withdrawal to process", `${u.publisherName}: ${formatMoney(w.amountMinor, w.currency)}`, "/admin/withdrawals");
  return { withdrawal: { id: w.id, number: w.number, status: w.status } };
});
