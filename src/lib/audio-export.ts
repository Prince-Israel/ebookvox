import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseBlocks, toChunks } from "./text";

/** Longest document we will turn into a downloadable file (about 3 hours of audio). */
export const MAX_EXPORT_CHARS = 200_000;

/** The speakable pieces of a document, in order. Each one is synthesised (and cached) on its own, then joined. */
export const exportChunks = (text: string) => toChunks(parseBlocks(text)).map((c) => c.text);

const key = () => createHash("sha256").update(`${process.env.READER_ADMIN_SECRET ?? ""}|${process.env.DATABASE_URL ?? ""}|audio-download`).digest();
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** A short-lived signed address, so the download also works where the browser has no sign-in cookie (the phone's own browser, a download manager). */
export function signDownload(p: { docId: string; userId: string; voice: string }, ttlMs = 15 * 60_000) {
  const body = b64(JSON.stringify({ ...p, exp: Date.now() + ttlMs }));
  return `${body}.${b64(createHmac("sha256", key()).update(body).digest())}`;
}

export function verifyDownload(token: string): { docId: string; userId: string; voice: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = b64(createHmac("sha256", key()).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() && p.docId && p.userId && p.voice ? p : null;
  } catch { return null; }
}

/** A file name that is safe on every system. */
export const fileNameFor = (title: string, ext: string) => `${(title.replace(/[^\p{L}\p{N} _.\-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Ebookvox audio")}.${ext}`;
