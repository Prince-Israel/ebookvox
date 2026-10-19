import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { avatarImage, sniffImage } from "@/lib/images";

const MAX = 6 * 1024 * 1024;
export const POST = route(async (req) => {
  const u = await requireUser();
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a photo to upload.");
  if (file.size > MAX) throw new ApiError(413, "That photo is too large. Please choose one under 6 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buf)) throw new ApiError(415, "Please upload a JPG, PNG or WebP image.");
  let img: { data: Buffer; mime: string };
  try { img = await avatarImage(buf); }
  catch (e) { throw e instanceof Error && e.message === "TOO_BIG_RAW" ? new ApiError(413, "That photo is too large (1.5 MB max).") : new ApiError(415, "We couldn't read that image. Try a different photo."); }
  const data = img.data;
  const now = new Date();
  await db.avatar.upsert({ where: { userId: u.id }, create: { userId: u.id, mime: img.mime, data: new Uint8Array(data) }, update: { mime: img.mime, data: new Uint8Array(data) } });
  await db.user.update({ where: { id: u.id }, data: { avatarUpdatedAt: now } });
  return { avatarUpdatedAt: now.toISOString() };
});

export const DELETE = route(async () => {
  const u = await requireUser();
  await db.avatar.deleteMany({ where: { userId: u.id } });
  await db.user.update({ where: { id: u.id }, data: { avatarUpdatedAt: null } });
});
