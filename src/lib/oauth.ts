import { createHash } from "node:crypto";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { db } from "./db";
import { createSession, randomToken, sha256 } from "./auth";
import { currencyForCountry, isCountry } from "./countries";
import { welcome } from "./account";

export type Provider = "google" | "apple";
export const isProvider = (p: string): p is Provider => p === "google" || p === "apple";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3230").replace(/\/$/, "");
export const redirectUri = (p: Provider) => `${appUrl()}/api/auth/oauth/${p}/callback`;

export function isConfigured(p: Provider) {
  const e = process.env;
  return p === "google"
    ? !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET)
    : !!(e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY);
}

/** Only same-site paths are allowed as a post-login destination (never an open redirect). */
export const safeNext = (n?: string | null) => (n && /^\/(?!\/)[\w\-./?=&%]*$/.test(n) ? n : null);

export async function buildAuthUrl(p: Provider, opts: { mobile?: boolean; next?: string | null } = {}) {
  const state = randomToken(24);
  const nonce = randomToken(16);
  const codeVerifier = randomToken(32);
  await db.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.oAuthState.create({ data: { state, provider: p, nonce, codeVerifier, mobile: !!opts.mobile, next: safeNext(opts.next), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  const u = new URL(p === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://appleid.apple.com/auth/authorize");
  const q = u.searchParams;
  q.set("response_type", "code");
  q.set("redirect_uri", redirectUri(p));
  q.set("state", state);
  q.set("nonce", nonce);
  if (p === "google") {
    q.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    q.set("scope", "openid email profile");
    q.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
    q.set("code_challenge_method", "S256");
    q.set("prompt", "select_account");
  } else {
    q.set("client_id", process.env.APPLE_CLIENT_ID!);
    q.set("scope", "name email");
    q.set("response_mode", "form_post");
  }
  return u.toString();
}

async function appleClientSecret() {
  const key = await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type Identity = { sub: string; email: string; emailVerified: boolean; firstName?: string; lastName?: string };

async function exchange(p: Provider, code: string, verifier: string, nonce: string, appleUser?: string): Promise<Identity> {
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(p) });
  if (p === "google") {
    body.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    body.set("client_secret", process.env.GOOGLE_CLIENT_SECRET!);
    body.set("code_verifier", verifier);
  } else {
    body.set("client_id", process.env.APPLE_CLIENT_ID!);
    body.set("client_secret", await appleClientSecret());
  }
  const res = await fetch(p === "google" ? "https://oauth2.googleapis.com/token" : "https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await res.json();
  if (!res.ok || !tok.id_token) throw new Error(`token exchange failed: ${tok.error ?? res.status}`);
  const { payload } = await jwtVerify(tok.id_token, p === "google" ? googleJwks : appleJwks, {
    issuer: p === "google" ? ["https://accounts.google.com", "accounts.google.com"] : "https://appleid.apple.com",
    audience: p === "google" ? process.env.GOOGLE_CLIENT_ID! : process.env.APPLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce) throw new Error("nonce mismatch");
  if (!payload.email) throw new Error("no email returned by provider");
  let firstName = payload.given_name as string | undefined;
  let lastName = payload.family_name as string | undefined;
  if (p === "apple" && appleUser) {
    try {
      const n = JSON.parse(appleUser).name;
      firstName = n?.firstName;
      lastName = n?.lastName;
    } catch {}
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    firstName,
    lastName,
  };
}

export async function completeOAuth(p: Provider, params: { state: string; code: string; appleUser?: string; acceptLanguage?: string | null; ipCountry?: string | null; userAgent?: string | null }) {
  const st = await db.oAuthState.findUnique({ where: { state: params.state } });
  if (!st || st.provider !== p || st.expiresAt < new Date()) throw new Error("invalid or expired state");
  await db.oAuthState.delete({ where: { state: params.state } });
  const id = await exchange(p, params.code, st.codeVerifier, st.nonce, params.appleUser);

  let account = await db.account.findUnique({ where: { provider_providerAccountId: { provider: p, providerAccountId: id.sub } } });
  let userId = account?.userId;
  if (!userId) {
    const existing = await db.user.findUnique({ where: { email: id.email } });
    if (existing) {
      if (!id.emailVerified) throw new Error("provider email not verified");
      userId = existing.id;
      if (!existing.emailVerifiedAt) await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
    } else {
      const guess = (params.ipCountry ?? params.acceptLanguage?.match(/-([A-Z]{2})/)?.[1] ?? "US").toUpperCase();
      const country = isCountry(guess) ? guess : "US";
      const local = id.email.split("@")[0];
      const u = await db.user.create({
        data: {
          email: id.email,
          firstName: id.firstName || local,
          lastName: id.lastName || "",
          country,
          currency: currencyForCountry(country),
          emailVerifiedAt: id.emailVerified ? new Date() : null,
        },
      });
      userId = u.id;
      await welcome(u.id, u.firstName);
    }
    await db.account.create({ data: { userId, provider: p, providerAccountId: id.sub } });
  }
  const u2 = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (u2?.status !== "ACTIVE") throw new Error("account not active");
  if (st.mobile) {
    // The sign-in happened in the phone's system browser, which has its own cookies. Hand the app a one-time code
    // (valid 3 minutes, single use) that it swaps for a session inside its own web view.
    const code = randomToken(32);
    await db.authToken.create({ data: { userId, type: "MOBILE_LOGIN", tokenHash: sha256(code), expiresAt: new Date(Date.now() + 3 * 60_000) } });
    return { mobile: true as const, code, next: st.next };
  }
  await createSession(userId, params.userAgent);
  return { mobile: false as const, code: null, next: st.next };
}

/** Swaps the one-time code from the app's deep link for a real session cookie. */
export async function redeemMobileCode(code: string, userAgent?: string | null) {
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(code) } });
  if (!t || t.type !== "MOBILE_LOGIN" || t.usedAt || t.expiresAt < new Date()) return false;
  const claimed = await db.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) return false;
  const u = await db.user.findUnique({ where: { id: t.userId }, select: { status: true } });
  if (u?.status !== "ACTIVE") return false;
  await createSession(t.userId, userAgent);
  return true;
}
