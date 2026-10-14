import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";

/**
 * Serves a book's cover through the Reader itself. Covers live on the Publisher server (a localhost / private address in
 * development), which a phone or emulator can't reach — so the Reader fetches it server-side and passes it on.
 */
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const b = await db.book.findUnique({ where: { id: (await params).id }, select: { coverUrl: true, status: true } });
  if (!b?.coverUrl || !["APPROVED", "ARCHIVED"].includes(b.status)) throw new ApiError(404, "No cover.");
  const res = await fetch(b.coverUrl, { signal: AbortSignal.timeout(8000), cache: "no-store" }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) throw new ApiError(404, "No cover.");
  return new Response(await res.arrayBuffer(), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
});
