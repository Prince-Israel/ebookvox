import { NextRequest } from "next/server";
import { ApiError } from "./api";
import { loadSharp } from "./images";

export const MAX_ATTACHMENTS = 4;
const MAX_RAW = 10 * 1024 * 1024;

const sniff = (b: Buffer): boolean =>
  (b[0] === 0xff && b[1] === 0xd8) ||
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
  (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") ||
  b.subarray(0, 3).toString() === "GIF";

const mimeOf = (b: Buffer): string => (b[0] === 0xff ? "image/jpeg" : b[0] === 0x89 ? "image/png" : b.subarray(0, 3).toString() === "GIF" ? "image/gif" : "image/webp");
const RAW_FALLBACK_MAX = 3 * 1024 * 1024;

export type Upload = { name: string; mime: string; size: number; data: Buffer };

/** Validates photos by their actual bytes (not the filename or type the browser claims), shrinks them and strips location/camera metadata. */
export async function cleanImages(files: File[]): Promise<Upload[]> {
  if (files.length > MAX_ATTACHMENTS) throw new ApiError(400, `You can attach up to ${MAX_ATTACHMENTS} photos at a time.`);
  const out: Upload[] = [];
  for (const f of files) {
    if (f.size > MAX_RAW) throw new ApiError(413, `“${f.name}” is too large. Photos must be under 10 MB.`);
    const raw = Buffer.from(await f.arrayBuffer());
    if (!sniff(raw)) throw new ApiError(415, `“${f.name}” isn't a photo we can use. Please attach a JPG, PNG, WebP or GIF image.`);
    const sharp = await loadSharp();
    const safeName = (f.name || "photo").replace(/[^\w.\- ]+/g, "_").replace(/\.[A-Za-z0-9]+$/, "").slice(0, 60);
    if (!sharp) {
      if (raw.length > RAW_FALLBACK_MAX) throw new ApiError(413, `“${f.name}” is too large. Photos must be under 3 MB.`);
      const mime = mimeOf(raw);
      out.push({ name: `${safeName}.${mime.split("/")[1].replace("jpeg", "jpg")}`, mime, size: raw.length, data: raw });
      continue;
    }
    try {
      const data = await sharp(raw, { failOn: "error" }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
      out.push({ name: safeName + ".jpg", mime: "image/jpeg", size: data.length, data });
    } catch {
      throw new ApiError(415, `We couldn't read “${f.name}”. It may be damaged — try another photo.`);
    }
  }
  return out;
}

/** Reads a ticket request that is either JSON (text only) or multipart (text + photos). */
export async function readTicketBody(req: NextRequest): Promise<{ fields: Record<string, unknown>; images: Upload[] }> {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    let form: FormData;
    try { form = await req.formData(); } catch { throw new ApiError(400, "We couldn't read that upload. Please try again."); }
    const fields: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string" && f.size > 0);
    return { fields, images: await cleanImages(files) };
  }
  let fields: Record<string, unknown> = {};
  try { fields = await req.json(); } catch { throw new ApiError(400, "That request couldn't be read."); }
  return { fields, images: [] };
}
