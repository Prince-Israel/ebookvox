import { z } from "zod";
import { ApiError, clientIp, rateLimit, readJson, route } from "@/lib/api";
import { synthesize } from "@/lib/tts";
import { VOICES } from "@/lib/voices";

export const maxDuration = 60;

const schema = z.object({
  text: z.string().trim().min(2, "Type or paste a few words to hear.").max(400, "The free sample is up to 400 characters."),
  voice: z.string().refine((id) => VOICES.some((v) => v.id === id), "Unknown voice."),
});

/** A short free sample for visitors on the text-to-speech pages (no account needed). Small, rate-limited per address. */
export const POST = route(async (req) => {
  rateLimit(`tts-demo:${clientIp(req)}`, 8, 10 * 60_000);
  const { text, voice } = schema.parse(await readJson(req));
  let out;
  try { out = await synthesize(text, voice); } catch (e) {
    console.error("[tts-demo]", e);
    throw new ApiError(502, "The voice service is unavailable right now. Please try again in a moment.");
  }
  return new Response(new Uint8Array(out.audio), { headers: { "Content-Type": out.mime, "Content-Length": String(out.audio.length), "Cache-Control": "private, max-age=3600" } });
});
