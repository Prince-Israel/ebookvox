import { voiceForCountry } from "./voices";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { ApiError } from "./api";

export const SESSION_COOKIE = "ev_session";
const SESSION_DAYS = 30;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, hash: string) => bcrypt.compare(p, hash);

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { userId, tokenHash: sha256(token), expiresAt, userAgent: userAgent?.slice(0, 250) } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.status !== "ACTIVE") return null;
  return s.user;
}

export type DbUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export async function requireUser(): Promise<DbUser> {
  const u = await getUser();
  if (!u) throw new ApiError(401, "Your session has expired. Please sign in again.");
  return u;
}

export async function requireAdmin(): Promise<DbUser> {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new ApiError(403, "You don't have permission to do that.");
  return u;
}

export function publicUser(u: DbUser) {
  const { passwordHash, ...rest } = u;
  // Until the user picks a voice themselves, their default follows their country (and moves with it if they change country).
  return { ...rest, defaultVoice: u.voiceChosen ? u.defaultVoice : voiceForCountry(u.country), hasPassword: !!passwordHash, emailVerified: !!u.emailVerifiedAt };
}
export type PublicUser = ReturnType<typeof publicUser>;
