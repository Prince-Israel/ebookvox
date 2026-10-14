import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { getUser } from "@/lib/auth";

// Covers of approved/published books are public (the Reader loads them). Everything else is owner/admin only.
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await db.book.findUnique({ where: { id }, select: { status: true, publisherId: true, cover: true } });
  if (!b?.cover) return new Response("Not found", { status: 404 });
  if (!["APPROVED", "PUBLISHED"].includes(b.status)) {
    const u = await getUser();
    if (!u || (u.id !== b.publisherId && u.role !== "ADMIN")) return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(b.cover.data), { headers: { "Content-Type": b.cover.mime, "Cache-Control": "public, max-age=3600" } });
});
