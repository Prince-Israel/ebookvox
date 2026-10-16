import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

// A photo sent in a support chat. Only the ticket's owner can load it (Admin reads it through the signed service API).
export const GET = route(async (_req, { params }: { params: Promise<{ attId: string }> }) => {
  const u = await requireUser();
  const a = await db.ticketAttachment.findFirst({ where: { id: (await params).attId, message: { ticket: { userId: u.id } } } });
  if (!a) throw new ApiError(404, "We couldn't find that photo.");
  return new Response(new Uint8Array(a.data), { headers: { "Content-Type": a.mime, "Content-Length": String(a.data.length), "Cache-Control": "private, max-age=86400", "Content-Disposition": "inline" } });
});
