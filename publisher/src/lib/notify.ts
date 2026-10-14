import { db } from "./db";

export type NotifyType =
  | "BOOK_SUBMITTED" | "BOOK_APPROVED" | "BOOK_REJECTED" | "BOOK_PUBLISHED" | "SALE_COMPLETED" | "EARNINGS_CREDITED"
  | "WITHDRAWAL_REQUESTED" | "WITHDRAWAL_PROCESSING" | "WITHDRAWAL_PAID" | "WITHDRAWAL_REJECTED" | "SUPPORT_REPLY" | "ACCOUNT_UPDATE";

export async function notify(userId: string, type: NotifyType, title: string, body: string, link?: string) {
  await db.notification.create({ data: { userId, type, title, body, link } });
}

export async function notifyAdmins(type: string, title: string, body: string, link?: string) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await db.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type, title, body, link })) });
}
