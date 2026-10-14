import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { requirePublisher } from "@/lib/auth";
import { NIGERIAN_BANKS } from "@/lib/config";
import { emailSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";
import { methodFor } from "@/lib/payout";


export const GET = route(async () => {
  const u = await requirePublisher();
  const m = await db.paymentMethod.findUnique({ where: { userId: u.id } });
  return {
    required: methodFor(u.country), banks: NIGERIAN_BANKS,
    method: m && { type: m.type, bankCode: m.bankCode, bankName: m.bankName, accountName: m.accountName, accountNumberMasked: m.accountNumber ? `••••••${m.accountNumber.slice(-4)}` : null, accountNumber: m.accountNumber, paypalEmail: m.paypalEmail },
  };
});

export const PUT = route(async (req) => {
  const u = await requirePublisher();
  const body = await readJson(req);
  if (methodFor(u.country) === "BANK") {
    const d = z.object({
      bankCode: z.string().refine((c) => NIGERIAN_BANKS.some((b) => b.code === c), "Choose your bank."),
      accountName: z.string().trim().min(3, "Enter the account name exactly as it appears at your bank.").max(100).regex(/^[\p{L}\s.'\-]+$/u, "Account name can only contain letters and spaces."),
      accountNumber: z.string().trim().regex(/^\d{10}$/, "Nigerian account numbers have exactly 10 digits."),
    }).parse(body);
    const bank = NIGERIAN_BANKS.find((b) => b.code === d.bankCode)!;
    await db.paymentMethod.upsert({
      where: { userId: u.id },
      create: { userId: u.id, type: "BANK", bankCode: bank.code, bankName: bank.name, accountName: d.accountName, accountNumber: d.accountNumber },
      update: { type: "BANK", bankCode: bank.code, bankName: bank.name, accountName: d.accountName, accountNumber: d.accountNumber, paypalEmail: null },
    });
  } else {
    const d = z.object({ paypalEmail: emailSchema }).parse(body);
    await db.paymentMethod.upsert({
      where: { userId: u.id },
      create: { userId: u.id, type: "PAYPAL", paypalEmail: d.paypalEmail },
      update: { type: "PAYPAL", paypalEmail: d.paypalEmail, bankCode: null, bankName: null, accountName: null, accountNumber: null },
    });
  }
  await notify(u.id, "ACCOUNT_UPDATE", "Payment method saved", "Your payout details were updated.", "/payment-method");
  return { ok: true };
});
