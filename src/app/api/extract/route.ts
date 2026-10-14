import { db } from "@/lib/db";
import { ApiError, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ExtractError, MAX_UPLOAD, extractText } from "@/lib/extract";

export const maxDuration = 60;

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`extract:${u.id}`, 30, 3600_000);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a PDF, DOCX or TXT file to upload.");
  if (file.size > MAX_UPLOAD) throw new ApiError(413, `This file is too large. The limit is ${MAX_UPLOAD / 1024 / 1024} MB.`);
  try {
    const { kind, text } = await extractText(file.name, Buffer.from(await file.arrayBuffer()));
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled";
    const doc = await db.document.create({ data: { userId: u.id, title, kind, text } });
    return { document: { id: doc.id, title, kind, text } };
  } catch (e) {
    if (e instanceof ExtractError) throw new ApiError(422, e.message);
    console.error("[extract]", e);
    throw new ApiError(422, "We couldn't process this file. Please try a different file.");
  }
});
