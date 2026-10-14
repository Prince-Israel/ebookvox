import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

const MAX = 4 * 1024 * 1024;

function sniff(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export const POST = route(async (req) => {
  const u = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a photo to upload.");
  if (file.size > MAX) throw new ApiError(413, "That photo is too large. Please choose one under 4 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) throw new ApiError(415, "Please upload a JPG, PNG or WebP image.");
  const now = new Date();
  await db.avatar.upsert({ where: { userId: u.id }, create: { userId: u.id, mime, data: buf }, update: { mime, data: buf } });
  await db.user.update({ where: { id: u.id }, data: { avatarUpdatedAt: now } });
  return { avatarUpdatedAt: now.toISOString() };
});

export const DELETE = route(async () => {
  const u = await requireUser();
  await db.avatar.deleteMany({ where: { userId: u.id } });
  await db.user.update({ where: { id: u.id }, data: { avatarUpdatedAt: null } });
});
