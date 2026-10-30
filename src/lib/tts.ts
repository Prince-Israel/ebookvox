import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { resolveVoice } from "./voices";

const run = promisify(execFile);
const CACHE_DIR = path.join(process.cwd(), "data", "tts-cache");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

export function ssml(text: string, voiceId: string) {
  const v = resolveVoice(voiceId);
  const locale = v.id.split("-").slice(0, 2).join("-");
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${v.id}"><prosody rate="${pct(v.rate)}" pitch="${pct(v.pitch)}">${esc(text)}</prosody></voice></speak>`;
}

async function viaAzure(text: string, voiceId: string): Promise<Buffer> {
  const region = process.env.AZURE_SPEECH_REGION;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "ebookvox",
    },
    body: ssml(text, voiceId),
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function viaEdge(text: string, voiceId: string): Promise<Buffer> {
  const v = resolveVoice(voiceId);
  const tts = new MsEdgeTTS();
  await tts.setMetadata(v.id, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: v.rate / 100, pitch: `${v.pitch >= 0 ? "+" : ""}${Math.round(v.pitch * 2)}Hz` });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (c: Buffer) => chunks.push(c));
    audioStream.on("end", () => resolve());
    audioStream.on("close", () => resolve());
    audioStream.on("error", reject);
  });
  tts.close();
  return Buffer.concat(chunks);
}

// ---- macOS `say` (development fallback only; never used when Azure is configured) ----
const SAY_BY_LOCALE: Record<string, [female: string, male: string]> = {
  "en-GB": ["Samantha", "Daniel"], "en-AU": ["Karen", "Daniel"], "en-IE": ["Moira", "Daniel"], "en-IN": ["Rishi", "Rishi"],
  "en-ZA": ["Tessa", "Daniel"], "en-US": ["Samantha", "Fred"], "en-CA": ["Samantha", "Fred"], "en-NZ": ["Karen", "Daniel"],
  "en-NG": ["Tessa", "Daniel"], "en-KE": ["Tessa", "Daniel"], "en-TZ": ["Tessa", "Daniel"],
};

async function viaSay(text: string, voiceId: string): Promise<Buffer> {
  const v = resolveVoice(voiceId);
  const [f, m] = SAY_BY_LOCALE[v.id.split("-").slice(0, 2).join("-")] ?? SAY_BY_LOCALE["en-US"];
  const sayVoice = v.gender === "Female" ? f : m;
  // Differentiate voices that share a system voice with a stable pitch/rate offset derived from the id.
  const h = createHash("md5").update(v.id).digest()[0];
  const pbas = 50 + v.pitch * 2 + ((h % 9) - 4) * 2;
  const wpm = Math.round(175 * (1 + v.rate / 100) * (1 + (((h >> 4) % 5) - 2) * 0.02));
  const tmp = path.join(CACHE_DIR, `tmp-${h}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(`${tmp}.txt`, `[[pbas ${Math.max(10, Math.min(90, pbas))}]] ${text}`);
  try {
    await run("say", ["-v", sayVoice, "-r", String(wpm), "-f", `${tmp}.txt`, "-o", `${tmp}.aiff`]);
    await run("afconvert", ["-f", "m4af", "-d", "aac", `${tmp}.aiff`, `${tmp}.m4a`]);
    return await readFile(`${tmp}.m4a`);
  } finally {
    await Promise.all([rm(`${tmp}.txt`, { force: true }), rm(`${tmp}.aiff`, { force: true }), rm(`${tmp}.m4a`, { force: true })]);
  }
}

export type Provider = "azure" | "edge" | "say";
let edgeDownUntil = 0;

function chain(): Provider[] {
  const want = process.env.TTS_PROVIDER ?? "auto";
  if (want === "azure") return ["azure"];
  if (want === "edge") return ["edge"];
  if (want === "say") return ["say"];
  const out: Provider[] = [];
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) out.push("azure");
  if (Date.now() > edgeDownUntil) out.push("edge");
  // Last resort on a Mac (local use): the built-in system voices, so reading aloud still works without cloud keys.
  if (process.platform === "darwin") out.push("say");
  return out;
}

const inflight = new Map<string, Promise<{ audio: Buffer; mime: string }>>();
const key = (provider: string, text: string, v: ReturnType<typeof resolveVoice>) =>
  createHash("sha256").update(`${provider}|${v.id}|${v.rate}|${v.pitch}|${text}`).digest("hex");

/** Returns audio bytes for the text in the chosen voice. Results are cached on disk by content hash. */
export async function synthesize(text: string, voiceId: string): Promise<{ audio: Buffer; mime: string }> {
  const v = resolveVoice(voiceId);
  const providers = chain();
  for (const p of providers) {
    const k = key(p, text, v);
    const file = path.join(CACHE_DIR, `${k}.bin`);
    try {
      return { audio: await readFile(file), mime: p === "say" ? "audio/mp4" : "audio/mpeg" };
    } catch {}
    let job = inflight.get(k);
    if (!job) {
      job = (async () => {
        const attempts = p === "azure" ? 3 : 1;
        let lastErr: unknown;
        for (let a = 0; a < attempts; a++) {
          try {
            const audio = p === "azure" ? await viaAzure(text, v.id) : p === "edge" ? await viaEdge(text, v.id) : await viaSay(text, v.id);
            if (audio.length < 200) throw new Error("empty audio");
            await mkdir(CACHE_DIR, { recursive: true });
            await writeFile(file, audio);
            return { audio, mime: p === "say" ? "audio/mp4" : "audio/mpeg" };
          } catch (e) {
            lastErr = e;
            if (a < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (a + 1)));
          }
        }
        throw lastErr;
      })().finally(() => inflight.delete(k));
      inflight.set(k, job);
    }
    try {
      return await job;
    } catch (e) {
      console.error(`[tts] ${p} failed:`, (e as Error).message);
      if (p === "edge") edgeDownUntil = Date.now() + 5 * 60_000;
    }
  }
  throw new Error("no TTS provider available");
}

/** The whole text in one file, for the development-only system voice (its output can't be joined chunk by chunk like MP3). */
export async function synthesizeWhole(text: string, voiceId: string): Promise<{ audio: Buffer; mime: string }> {
  const v = resolveVoice(voiceId);
  const file = path.join(CACHE_DIR, `whole-${key("say", text, v)}.bin`);
  try { return { audio: await readFile(file), mime: "audio/mp4" }; } catch {}
  const audio = await viaSay(text, v.id);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, audio);
  return { audio, mime: "audio/mp4" };
}
