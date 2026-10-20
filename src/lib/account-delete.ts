import { db } from "./db";
import { emitEvent } from "./events";

/**
 * Closes a Reader account at the owner's request: personal details, sign-ins, library, uploaded documents, support messages and notifications
 * are erased, and the account row is anonymised. Payment records (orders, wallet and subscription payments) are kept without the person's
 * details, because tax and accounting rules require us to hold them.
 */
export async function deleteAccount(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { country: true } });
  if (!u) return;
  await db.$transaction([
    db.session.deleteMany({ where: { userId } }),
    db.authToken.deleteMany({ where: { userId } }),
    db.account.deleteMany({ where: { userId } }),
    db.notification.deleteMany({ where: { userId } }),
    db.ticket.deleteMany({ where: { userId } }),
    db.document.deleteMany({ where: { userId } }),
    db.avatar.deleteMany({ where: { userId } }),
    db.userBook.deleteMany({ where: { userId } }),
    db.subscription.updateMany({ where: { userId }, data: { autoRenew: false } }),
    db.user.update({
      where: { id: userId },
      data: { status: "DELETED", email: `deleted-${userId}@deleted.ebookvox.invalid`, firstName: "Deleted", lastName: "user", phone: null, passwordHash: null, emailVerifiedAt: null, avatarUpdatedAt: null },
    }),
  ]);
  await emitEvent("user.deleted", { id: userId, country: u.country });
}
