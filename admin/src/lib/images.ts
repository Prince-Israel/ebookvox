export const sniffImage = (b: Buffer): string | null => {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
};

// sharp is loaded on first use, so a server that can't run its native binary can still build and start; images are then stored as sent.
let sharpLib: Promise<typeof import("sharp").default | null> | undefined;
export const loadSharp = () => (sharpLib ??= import("sharp").then((m) => m.default).catch((e) => { console.warn("sharp unavailable, images are stored without re-encoding:", e instanceof Error ? e.message.split("\n")[0] : e); return null; }));

/** Square 512px JPEG avatar. Without sharp the original image is kept (1.5 MB max). */
export async function avatarImage(buf: Buffer): Promise<{ data: Buffer; mime: string }> {
  const sharp = await loadSharp();
  if (!sharp) {
    const mime = sniffImage(buf) ?? "image/jpeg";
    if (buf.length > 1.5 * 1024 * 1024) throw new Error("TOO_BIG_RAW");
    return { data: buf, mime };
  }
  return { data: await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer(), mime: "image/jpeg" };
}
