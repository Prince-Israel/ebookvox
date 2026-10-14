import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  chapterIndex: z.number().int().min(0),
  paragraphIndex: z.number().int().min(0),
  audioTime: z.number().min(0).max(100000).default(0),
  percent: z.number().min(0).max(100),
});

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { id } = await params;
  const d = schema.parse(await readJson(req));
  const ub = await db.userBook.findUnique({ where: { userId_bookId: { userId: u.id, bookId: id } } });
  if (!ub) throw new ApiError(403, "This book isn't in your library.");
  await db.userBook.update({
    where: { id: ub.id },
    data: { ...d, lastOpenedAt: new Date(), completedAt: d.percent >= 99 ? ub.completedAt ?? new Date() : ub.completedAt },
  });
});
