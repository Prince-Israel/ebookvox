import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/api";
import { runDigest } from "@/lib/digest";

export const maxDuration = 300;

/**
 * Weekly reader email ("continue where you stopped" + new books). Call it from a cron job with the CRON_SECRET from .env:
 *   curl -s -X POST -H "x-cron-secret: YOUR_SECRET" https://app.ebookvox.com/api/cron/digest
 * Add ?dry=1 to only see how many would be sent.
 */
export const POST = route(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  if (secret.length < 16) throw new ApiError(503, "CRON_SECRET is not set on this server.");
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, "Wrong secret.");
  return runDigest({ dryRun: req.nextUrl.searchParams.get("dry") === "1" });
});
