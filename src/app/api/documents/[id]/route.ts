import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const doc = await db.document.findFirst({ where: { id: (await params).id, userId: u.id } });
  if (!doc) throw new ApiError(404, "We couldn't find that document.");
  return { document: { id: doc.id, title: doc.title, kind: doc.kind, text: doc.text } };
});

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  await db.document.deleteMany({ where: { id: (await params).id, userId: u.id } });
});
