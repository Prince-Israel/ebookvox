import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { synthesize, synthesizeWhole } from "@/lib/tts";
import { exportChunks, fileNameFor, MAX_EXPORT_CHARS, verifyDownload } from "@/lib/audio-export";

export const maxDuration = 300;

const fail = (status: number, message: string) => Response.json({ error: message }, { status });

/** Step 2: the finished audio file. Opened with the signed address from step 1, so it needs no sign-in cookie. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = verifyDownload(req.nextUrl.searchParams.get("token") ?? "");
  const id = (await params).id;
  if (!t || t.docId !== id) return fail(403, "This download link has expired. Please start the download again.");
  const doc = await db.document.findFirst({ where: { id, userId: t.userId, user: { status: "ACTIVE" } } });
  if (!doc) return fail(404, "We couldn't find that document.");
  if (doc.text.length > MAX_EXPORT_CHARS) return fail(413, "This document is too long to download as one audio file.");

  const chunks = exportChunks(doc.text);
  if (!chunks.length) return fail(400, "There is no text to turn into audio.");
  let first;
  try { first = await synthesize(chunks[0], t.voice); } catch { return fail(502, "The voice service is unavailable right now. Please try again in a moment."); }

  // MP3 pieces simply join into one valid MP3. (The development-only system voice can't do that, so it renders the whole text at once.)
  if (first.mime !== "audio/mpeg") {
    const whole = await synthesizeWhole(chunks.join("\n\n"), t.voice);
    return new Response(new Uint8Array(whole.audio), { headers: { "Content-Type": whole.mime, "Content-Length": String(whole.audio.length), "Content-Disposition": `attachment; filename="${fileNameFor(doc.title, "m4a")}"`, "Cache-Control": "private, no-store" } });
  }
  let n = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (n >= chunks.length) return controller.close();
      try {
        const audio = n === 0 ? first.audio : (await synthesize(chunks[n], t.voice)).audio;
        n++;
        controller.enqueue(new Uint8Array(audio));
      } catch (e) { controller.error(e); }
    },
  });
  const name = fileNameFor(doc.title, "mp3");
  return new Response(stream, { headers: { "Content-Type": "audio/mpeg", "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store" } });
}
