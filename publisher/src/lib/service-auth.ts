import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError } from "./api";

const seen = new Map<string, number>();

/**
 * Verifies a signed server-to-server request from the Admin platform:
 *   signature = HMAC-SHA256(secret, `${timestamp}\n${METHOD}\n${path?query}\n${sha256(body)}`)
 * Requests older than 60 s are rejected and mutating requests cannot be replayed within that window.
 */
export async function verifyServiceRequest(req: NextRequest, secret: string | undefined): Promise<string> {
  const ts = req.headers.get("x-svc-timestamp") ?? "";
  const sig = req.headers.get("x-svc-signature") ?? "";
  if (!secret || secret.length < 16) throw new ApiError(503, "Service authentication is not configured.");
  if (!/^\d{10,15}$/.test(ts) || Math.abs(Date.now() - Number(ts)) > 60_000) throw new ApiError(401, "Stale or missing service timestamp.");
  const body = ["GET", "HEAD"].includes(req.method) ? "" : await req.clone().text();
  const url = new URL(req.url);
  const base = `${ts}\n${req.method}\n${url.pathname}${url.search}\n${createHash("sha256").update(body).digest("hex")}`;
  const expected = createHmac("sha256", secret).update(base).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, "Invalid service signature.");
  if (req.method !== "GET") {
    const now = Date.now();
    for (const [k, t] of seen) if (now - t > 120_000) seen.delete(k);
    if (seen.has(sig)) throw new ApiError(409, "Replayed service request.");
    seen.set(sig, now);
  }
  return body;
}
