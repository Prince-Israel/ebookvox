import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { ApiError } from "./api";
import { permsOf, type Permission } from "./rbac";

// Distinct cookie name: an Admin session can never be confused with a Reader or Publisher one.
export const SESSION_COOKIE = "eva_session";
const SESSION_HOURS = 8;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(adminId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 250);
  await db.adminSession.create({ data: { adminId, tokenHash: sha256(token), expiresAt, userAgent: ua } });
  await db.adminSession.deleteMany({ where: { adminId, expiresAt: { lt: new Date() } } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: (process.env.APP_URL ?? "").startsWith("https"), path: "/", expires: expiresAt });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await db.adminSession.deleteMany({ where: { tokenHash: sha256(t) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in administrator, re-read from the database on every request (role, status and permissions are never trusted from the client). */
export async function getAdmin() {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const s = await db.adminSession.findUnique({ where: { tokenHash: sha256(t) }, include: { admin: true } });
  if (!s || s.expiresAt < new Date() || s.admin.status !== "ACTIVE") return null;
  return s.admin;
}
export type Admin = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;

export async function requireAdmin(opts: { allowMustChange?: boolean } = {}): Promise<Admin> {
  const a = await getAdmin();
  if (!a) throw new ApiError(401, "Your session has expired. Please sign in again.");
  if (a.mustChangePassword && !opts.allowMustChange) throw new ApiError(403, "Please change your temporary password before continuing.");
  return a;
}

/** Server-side authorization: every API route calls this. Menu visibility is only a convenience. */
export async function requirePermission(...any: Permission[]): Promise<Admin> {
  const a = await requireAdmin();
  const mine = permsOf(a);
  if (a.role !== "SUPER_ADMIN" && !any.some((p) => mine.includes(p))) throw new ApiError(403, "You don't have permission to do that.");
  return a;
}
export async function requireSuper(): Promise<Admin> {
  const a = await requireAdmin();
  if (a.role !== "SUPER_ADMIN") throw new ApiError(403, "Only a Super Admin can do that.");
  return a;
}

export function publicAdmin(a: Admin) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = a;
  return { ...rest, permissions: permsOf(a) };
}
export type PublicAdmin = ReturnType<typeof publicAdmin>;
