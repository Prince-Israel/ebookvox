import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { settlePayment } from "@/lib/paystack";

/** Called when the user returns from Paystack. Status is decided by asking Paystack — never by the browser. */
export const GET = route(async (req) => {
  const u = await requireUser();
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref");
  if (!reference) throw new ApiError(400, "Missing payment reference.");
  const [order, charge] = await Promise.all([db.order.findUnique({ where: { reference } }), db.charge.findUnique({ where: { reference } })]);
  if ((!order || order.userId !== u.id) && (!charge || charge.userId !== u.id)) throw new ApiError(404, "We couldn't find that payment.");
  return settlePayment(reference);
});
