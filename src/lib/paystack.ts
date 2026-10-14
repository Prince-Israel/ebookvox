import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { notify } from "./notify";
import { formatMoney } from "./money";
import { enqueue, flushOutbox } from "./outbox";
import { emitEvent } from "./events";

const base = () => process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co";
export const paystackConfigured = () => !!process.env.PAYSTACK_SECRET_KEY;

async function call<T>(path: string, init?: RequestInit): Promise<{ status: boolean; message: string; data: T }> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({ status: false, message: `Paystack responded ${res.status}` }));
  return json;
}

export async function initializeTransaction(p: { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: object }) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({ email: p.email, amount: p.amountMinor, currency: p.currency, reference: p.reference, callback_url: p.callbackUrl, metadata: p.metadata }),
  });
}

type Verified = { id: number; status: string; reference: string; amount: number; currency: string; channel?: string; gateway_response?: string };

export const verifyTransaction = (reference: string) => call<Verified>(`/transaction/verify/${encodeURIComponent(reference)}`);

export function validSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The single place where an order can become PAID. It always asks Paystack's
 * server (never trusts the browser) and checks reference, amount and currency
 * against what we stored when the order was created. Idempotent.
 */
export async function settleOrder(reference: string): Promise<{ status: "PAID" | "PENDING" | "FAILED"; orderId?: string; bookId?: string; message?: string }> {
  const order = await db.order.findUnique({ where: { reference }, include: { book: { include: { publisher: true } }, user: { select: { firstName: true, lastName: true } } } });
  if (!order) return { status: "FAILED", message: "We couldn't find that order." };
  if (order.status === "PAID") return { status: "PAID", orderId: order.id, bookId: order.bookId };

  const v = await verifyTransaction(reference);
  if (!v.status && !v.data) return { status: "PENDING", orderId: order.id, bookId: order.bookId, message: "We couldn't reach the payment provider to confirm. Please check again shortly." };
  const tx = v.data;

  if (tx?.status === "success") {
    if (tx.amount !== order.amountMinor || tx.currency !== order.currency) {
      await db.order.update({ where: { id: order.id }, data: { status: "FAILED", failureReason: "Amount or currency mismatch" } });
      console.error("[paystack] mismatch", { reference, got: [tx.amount, tx.currency], want: [order.amountMinor, order.currency] });
      return { status: "FAILED", orderId: order.id, bookId: order.bookId, message: "The payment amount didn't match your order. Contact support if you were charged." };
    }
    const done = await db.$transaction(async (t) => {
      const claimed = await t.order.updateMany({ where: { id: order.id, status: { not: "PAID" } }, data: { status: "PAID", paidAt: new Date(), paystackTxId: String(tx.id), channel: tx.channel ?? null, failureReason: null } });
      if (claimed.count === 0) return false;
      await t.userBook.upsert({
        where: { userId_bookId: { userId: order.userId, bookId: order.bookId } },
        create: { userId: order.userId, bookId: order.bookId, source: "PURCHASE", orderId: order.id },
        update: { source: "PURCHASE", orderId: order.id },
      });
      if (order.book.externalId)
        await enqueue("sale.completed", {
          orderId: order.id, orderNumber: order.number, bookExternalId: order.book.externalId, publisherExternalId: order.book.publisher.externalId,
          buyer: `${order.user.firstName} ${order.user.lastName.slice(0, 1)}.`.trim(), amountMinor: order.amountMinor, currency: order.currency, paidAt: new Date().toISOString(),
        }, t);
      return true;
    });
    if (done) {
      void flushOutbox().catch(() => {});
      await emitEvent("order.paid", { orderId: order.id, number: order.number, buyer: `${order.user.firstName} ${order.user.lastName}`, book: order.book.title, amountMinor: order.amountMinor, currency: order.currency, publisher: order.book.publisher.name });
      await notify(order.userId, "PURCHASE_SUCCESS", "Payment successful", `You bought “${order.book.title}” for ${formatMoney(order.amountMinor, order.currency)}.`, "/orders");
      await notify(order.userId, "BOOK_ADDED", "Book added to your library", `“${order.book.title}” is ready to read and listen to.`, `/read/${order.bookId}`);
    }
    return { status: "PAID", orderId: order.id, bookId: order.bookId };
  }

  if (tx && ["failed", "abandoned", "reversed"].includes(tx.status)) {
    const claimed = await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED", failureReason: tx.gateway_response ?? tx.status } });
    if (claimed.count) await emitEvent("order.failed", { orderId: order.id, number: order.number, buyer: `${order.user.firstName} ${order.user.lastName}`, book: order.book.title, amountMinor: order.amountMinor, currency: order.currency });
    if (claimed.count) await notify(order.userId, "PAYMENT_FAILED", "Payment failed", `Your payment for “${order.book.title}” didn't go through. You haven't been charged.`, "/orders");
    return { status: "FAILED", orderId: order.id, bookId: order.bookId, message: tx.gateway_response ?? "The payment was not completed." };
  }
  return { status: "PENDING", orderId: order.id, bookId: order.bookId, message: "Your payment is still being processed." };
}
