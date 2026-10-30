import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { synthesize } from "@/lib/tts";
import { VOICES } from "@/lib/voices";
import { exportChunks, MAX_EXPORT_CHARS, signDownload } from "@/lib/audio-export";

export const maxDuration = 60;
const BUDGET_MS = 25_000; // each request prepares as many pieces as fit; the page calls again until everything is ready

const schema = z.object({
  voice: z.string().refine((id) => VOICES.some((v) => v.id === id), "Unknown voice."),
  from: z.number().int().min(0).default(0),
});

/**
 * Step 1 of "download audio": prepares the document's audio piece by piece (pieces already played are reused from the cache).
 * Returns progress; when `done` is true it also returns the address of the finished file.
 */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { voice, from } = schema.parse(await readJson(req));
  const doc = await db.document.findFirst({ where: { id: (await params).id, userId: u.id } });
  if (!doc) throw new ApiError(404, "We couldn't find that document.");
  if (doc.text.length > MAX_EXPORT_CHARS) throw new ApiError(413, "This document is too long to download as one audio file. Try a shorter one.");
  if (from === 0) rateLimit(`audio-export:${u.id}`, 20, 3600_000);

  const chunks = exportChunks(doc.text);
  const t0 = Date.now();
  let i = from, mime = "audio/mpeg";
  try {
    while (i < chunks.length && (Date.now() - t0 < BUDGET_MS || i === from)) {
      mime = (await synthesize(chunks[i], voice)).mime;
      i++;
    }
  } catch (e) {
    console.error("[audio-export]", e);
    throw new ApiError(502, "The voice service is unavailable right now. Please try again in a moment.");
  }
  const done = i >= chunks.length;
  return { total: chunks.length, next: i, done, format: mime === "audio/mpeg" ? "mp3" : "m4a", url: done ? `/api/documents/${doc.id}/audio/file?token=${signDownload({ docId: doc.id, userId: u.id, voice })}` : null };
});
