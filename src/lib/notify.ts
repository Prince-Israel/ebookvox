import { db } from "./db";

export type NotifyType = "PURCHASE_SUCCESS" | "PAYMENT_FAILED" | "BOOK_ADDED" | "NEW_BOOK" | "SUPPORT_REPLY" | "ACCOUNT_UPDATE";

const PREF: Record<NotifyType, "notifyPurchase" | "notifyBooks" | "notifySupport" | null> = {
  PURCHASE_SUCCESS: "notifyPurchase",
  PAYMENT_FAILED: "notifyPurchase",
  BOOK_ADDED: "notifyBooks",
  NEW_BOOK: "notifyBooks",
  SUPPORT_REPLY: "notifySupport",
  ACCOUNT_UPDATE: null,
};

export async function notify(userId: string, type: NotifyType, title: string, body: string, link?: string) {
  const pref = PREF[type];
  if (pref) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { notifyPurchase: true, notifyBooks: true, notifySupport: true } });
    if (!u || !u[pref]) return;
  }
  await db.notification.create({ data: { userId, type, title, body, link } });
}

export async function notifyAll(type: NotifyType, title: string, body: string, link?: string) {
  const pref = PREF[type]!;
  const users = await db.user.findMany({ where: { [pref]: true }, select: { id: true } });
  if (users.length) await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, type, title, body, link })) });
}
