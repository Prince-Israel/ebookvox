import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack";

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`checkout:${u.id}`, 20, 3600_000);
  const { bookId } = z.object({ bookId: z.string().min(1) }).parse(await readJson(req));
  if (!u.emailVerifiedAt) throw new ApiError(403, "Please verify your email address before buying. Check your inbox, or resend the link from your profile.");
  const book = await db.book.findUnique({ where: { id: bookId }, include: { prices: true } });
  if (!book || book.status !== "APPROVED") throw new ApiError(404, "We couldn't find that book.");
  if (book.isFree) throw new ApiError(400, "This book is free — no payment needed.");
  if (await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId } } })) throw new ApiError(409, "You already own this book.");
  const price = book.prices.find((p) => p.currency === u.currency);
  if (!price) throw new ApiError(422, `This book isn't available in ${u.currency} yet.`);
  if (!paystackConfigured()) throw new ApiError(503, "Payments are temporarily unavailable. Please try again later.");

  const reference = `EV-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`.toUpperCase();
  const order = await db.order.create({
    data: { number: reference.replace("EV-", "ORD-"), userId: u.id, bookId, amountMinor: price.amountMinor, currency: price.currency, reference },
  });
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const init = await initializeTransaction({
    email: u.email,
    amountMinor: order.amountMinor,
    currency: order.currency,
    reference,
    callbackUrl: `${base}/payment/callback`,
    metadata: { orderId: order.id, bookId, userId: u.id },
  });
  if (!init.status || !init.data?.authorization_url) {
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED", failureReason: init.message?.slice(0, 200) } });
    throw new ApiError(502, `We couldn't start the payment${init.message ? ` (${init.message})` : ""}. You haven't been charged.`);
  }
  return { authorizationUrl: init.data.authorization_url, reference };
});
