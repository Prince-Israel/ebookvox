import { z } from "zod";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MAX_CHARS } from "@/lib/extract";

export const GET = route(async () => {
  const u = await requireUser();
  const docs = await db.document.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, title: true, kind: true, createdAt: true } });
  return { documents: docs };
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const d = z.object({ text: z.string().trim().min(1, "Type or paste some text first.").max(MAX_CHARS, "That text is too long.") }).parse(await readJson(req));
  const title = d.text.replace(/^#\s*/, "").split("\n")[0].slice(0, 60) || "Pasted text";
  const doc = await db.document.create({ data: { userId: u.id, title, kind: "TEXT", text: d.text } });
  return { document: { id: doc.id, title, kind: "TEXT", text: d.text } };
});
