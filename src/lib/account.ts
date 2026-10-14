import { db } from "./db";
import { randomToken, sha256 } from "./auth";
import { sendResetEmail, sendVerificationEmail } from "./email";
import { notify } from "./notify";

export async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD") {
  const token = randomToken();
  const ttl = type === "VERIFY_EMAIL" ? 24 * 3600_000 : 3600_000;
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl) } });
  return token;
}

export async function sendVerification(user: { id: string; email: string; firstName: string }) {
  await sendVerificationEmail(user.email, user.firstName, await issueToken(user.id, "VERIFY_EMAIL"));
}

export async function sendReset(user: { id: string; email: string; firstName: string }) {
  await sendResetEmail(user.email, user.firstName, await issueToken(user.id, "RESET_PASSWORD"));
}

export async function welcome(userId: string, firstName: string) {
  await notify(userId, "ACCOUNT_UPDATE", `Welcome to Ebookvox, ${firstName}`, "Your account is ready. Try Read Aloud on the Home page or discover a book.", "/home");
}
