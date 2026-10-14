import { db } from "./db";
import { ApiError } from "./api";
import { formatMoney } from "./money";
import { notify } from "./notify";
import { publishToReader } from "./reader";
import { emailSchema } from "./validation";

/** Admin-side operations shared by the internal service API (and the legacy in-app admin console). */

export async function reviewBook(id: string, action: "approve" | "reject" | "sync", reason?: string) {
  const b = await db.book.findUnique({ where: { id } });
  if (!b) throw new ApiError(404, "Book not found.");
  if (action === "reject") {
    if (!reason || reason.trim().length < 5) throw new ApiError(400, "Give the publisher a reason for the rejection (at least 5 characters).", { reason: "Required." });
    const r = await db.book.updateMany({ where: { id, status: "REVIEWING" }, data: { status: "REJECTED", rejectionReason: reason.trim() } });
    if (!r.count) throw new ApiError(409, "This book is not waiting for review.");
    await notify(b.publisherId, "BOOK_REJECTED", "Book rejected", `“${b.title}” was rejected: ${reason.trim()}`, `/books/${id}`);
    return { status: "REJECTED" as const };
  }
  if (action === "approve") {
    const r = await db.book.updateMany({ where: { id, status: "REVIEWING" }, data: { status: "APPROVED", approvedAt: new Date(), rejectionReason: null } });
    if (!r.count) throw new ApiError(409, "This book is not waiting for review.");
    await notify(b.publisherId, "BOOK_APPROVED", "Book approved", `“${b.title}” passed review and is being published.`, `/books/${id}`);
  } else if (b.status !== "APPROVED") throw new ApiError(409, "Only approved books that haven't synced yet can be retried.");
  const sync = await publishToReader(id);
  if (sync.ok) {
    await db.book.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date(), syncError: null } });
    await notify(b.publisherId, "BOOK_PUBLISHED", "Your book is live", `“${b.title}” is now available to readers.`, `/books/${id}`);
    return { status: "PUBLISHED" as const };
  }
  await db.book.update({ where: { id }, data: { syncError: sync.error } });
  return { status: "APPROVED" as const, warning: sync.error };
}

export async function processWithdrawal(id: string, action: "paid" | "reject", o: { reason?: string; reference?: string; by?: string }) {
  const w = await db.withdrawal.findUnique({ where: { id } });
  if (!w) throw new ApiError(404, "Withdrawal not found.");
  if (action === "reject" && (!o.reason || o.reason.trim().length < 5)) throw new ApiError(400, "Give the publisher a reason for rejecting (at least 5 characters).", { reason: "Required." });
  if (action === "paid") {
    // A payout can only be marked Paid when the destination is complete and the admin records the transfer reference.
    let dest: any = {};
    try { dest = JSON.parse(w.methodSnapshot); } catch {}
    const okDest = dest.type === "BANK" ? /^\d{10}$/.test(dest.accountNumber ?? "") && !!dest.bankName && (dest.accountName ?? "").length >= 3 : dest.type === "PAYPAL" ? emailSchema.safeParse(dest.paypalEmail).success : false;
    if (!okDest) throw new ApiError(422, "This payout can't be marked Paid: the payment destination is incomplete or invalid.", { destination: "Invalid payout destination." });
    if (!o.reference || o.reference.trim().length < 4) throw new ApiError(422, "Enter the payout reference (bank transfer or PayPal transaction ID) before marking this payout Paid.", { reference: "Required (at least 4 characters)." });
  }
  const done = await db.$transaction(async (t) => {
    const claimed = await t.withdrawal.updateMany({ where: { id, status: "PROCESSING" }, data: { status: action === "paid" ? "PAID" : "REJECTED", reason: action === "reject" ? o.reason!.trim() : null, payoutReference: action === "paid" ? o.reference!.trim() : null, processedBy: o.by ?? null, processedAt: new Date() } });
    if (!claimed.count) return false;
    if (action === "reject") await t.walletTx.create({ data: { publisherId: w.publisherId, currency: w.currency, type: "WITHDRAWAL_REFUND", amountMinor: w.amountMinor, description: `Withdrawal ${w.number} rejected — funds returned`, withdrawalId: w.id } });
    else await t.walletTx.create({ data: { publisherId: w.publisherId, currency: w.currency, type: "PAYOUT_COMPLETED", amountMinor: 0, description: `Withdrawal ${w.number} paid out (ref ${o.reference!.trim()})`, withdrawalId: w.id } });
    return true;
  });
  if (!done) throw new ApiError(409, "This withdrawal has already been processed.");
  if (action === "paid") await notify(w.publisherId, "WITHDRAWAL_PAID", "Withdrawal paid", `${formatMoney(w.amountMinor, w.currency)} (${w.number}) has been paid out.`, "/payouts");
  else await notify(w.publisherId, "WITHDRAWAL_REJECTED", "Withdrawal rejected", `${w.number} was rejected: ${o.reason!.trim()}. The funds are back in your wallet.`, "/payouts");
  return { id, status: action === "paid" ? "PAID" : "REJECTED" };
}

export async function adminTicketReply(id: string, message: string, adminName: string) {
  const t = await db.ticket.findUnique({ where: { id } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed, so it can't receive replies. Reopen it first.");
  await db.ticketMessage.create({ data: { ticketId: t.id, authorId: `admin:${adminName}`, authorRole: "ADMIN", body: message } });
  await db.ticket.update({ where: { id: t.id }, data: { status: "WAITING_PUBLISHER" } });
  await notify(t.userId, "SUPPORT_REPLY", "Admin replied to your ticket", `Re: ${t.subject}`, `/support/${t.id}`);
  return { id: t.id, status: "WAITING_PUBLISHER" };
}

export async function adminTicketStatus(id: string, status: "OPEN" | "WAITING_PUBLISHER" | "CLOSED") {
  const t = await db.ticket.findUnique({ where: { id } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  await db.ticket.update({ where: { id: t.id }, data: { status } });
  if (status === "CLOSED") await notify(t.userId, "SUPPORT_REPLY", "Your ticket was closed", `Re: ${t.subject}`, `/support/${t.id}`);
  return { id: t.id, status };
}
