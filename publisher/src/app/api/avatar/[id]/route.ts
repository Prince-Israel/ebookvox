import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// A photo is visible to its owner and to admins only.
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { id } = await params;
  if (u.id !== id && u.role !== "ADMIN") return new Response("Not found", { status: 404 });
  const a = await db.avatar.findUnique({ where: { userId: id } });
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(a.data), { headers: { "Content-Type": a.mime, "Cache-Control": "private, max-age=31536000, immutable" } });
});
