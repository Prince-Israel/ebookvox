import { z } from "zod";
import { ApiError, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { synthesize } from "@/lib/tts";
import { MAX_CHUNK } from "@/lib/text";
import { VOICES } from "@/lib/voices";

export const maxDuration = 60;

const schema = z.object({
  text: z.string().trim().min(1, "There's no text to read.").max(MAX_CHUNK + 200),
  voice: z.string().refine((id) => VOICES.some((v) => v.id === id), "Unknown voice."),
});

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit(`tts:${u.id}`, 240, 60_000);
  const { text, voice } = schema.parse(await readJson(req));
  let out;
  try {
    out = await synthesize(text, voice);
  } catch (e) {
    console.error("[tts]", e);
    throw new ApiError(502, "The voice service is unavailable right now. Please try again in a moment.");
  }
  return new Response(new Uint8Array(out.audio), {
    headers: { "Content-Type": out.mime, "Content-Length": String(out.audio.length), "Cache-Control": "private, max-age=86400" },
  });
});
