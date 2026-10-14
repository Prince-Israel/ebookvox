import { db } from "@/lib/db";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, route } from "@/lib/api";

const DIR = path.join(process.cwd(), "data", "cover-cache");

/**
 * Serves a book's cover through the Reader itself. Covers live on the Publisher server (a localhost / private address in
 * development), which a phone or emulator can't reach — so the Reader fetches it server-side and passes it on.
 */
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const b = await db.book.findUnique({ where: { id: (await params).id }, select: { coverUrl: true, status: true } });
  if (!b?.coverUrl || !["APPROVED", "ARCHIVED"].includes(b.status)) throw new ApiError(404, "No cover.");
  const file = path.join(DIR, createHash("sha1").update(b.coverUrl).digest("hex"));
  try {
    const hit = await readFile(file);
    return new Response(new Uint8Array(hit.subarray(1)), { headers: { "Content-Type": hit[0] === 1 ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=86400" } });
  } catch {}
  const res = await fetch(b.coverUrl, { signal: AbortSignal.timeout(8000), cache: "no-store" }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) throw new ApiError(404, "No cover.");
  const bytes = Buffer.from(await res.arrayBuffer());
  await mkdir(DIR, { recursive: true }).then(() => writeFile(file, Buffer.concat([Buffer.from([type.includes("png") ? 1 : 0]), bytes]))).catch(() => {});
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
});
