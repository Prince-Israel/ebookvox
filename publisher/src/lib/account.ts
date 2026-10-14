import { db } from "./db";
import { randomToken, sha256 } from "./auth";
import { sendResetEmail, sendVerificationEmail } from "./email";

export async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD") {
  const token = randomToken();
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + (type === "VERIFY_EMAIL" ? 24 * 3600_000 : 3600_000)) } });
  return token;
}
export const sendVerification = async (u: { id: string; email: string; firstName: string }) => sendVerificationEmail(u.email, u.firstName, await issueToken(u.id, "VERIFY_EMAIL"));
export const sendReset = async (u: { id: string; email: string; firstName: string }) => sendResetEmail(u.email, u.firstName, await issueToken(u.id, "RESET_PASSWORD"));
