"use client";
import { useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

type V = { id: string; label: string };

/** A free sample on the text-to-speech pages: type or paste up to 400 characters and hear them, no account needed. */
export function TtsDemo({ voices, initialText }: { voices: V[]; initialText: string }) {
  const [text, setText] = useState(initialText);
  const [voice, setVoice] = useState(voices[0].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  async function listen() {
    setBusy(true); setErr(null);
    // create the player inside the tap, so phones allow it to play
    const a = audio.current ?? (audio.current = new Audio());
    try {
      const res = await fetch("/api/tts/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "We couldn't make the sample. Please try again.");
      const url = URL.createObjectURL(await res.blob());
      a.src = url;
      await a.play();
      setDone(true);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
      <label htmlFor="demo-text" className="mb-2 block text-sm font-semibold">Type or paste your text</label>
      <textarea id="demo-text" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} rows={5} className="w-full resize-y rounded-2xl border border-line bg-bg p-4 text-base focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25" />
      <div className="mt-1 text-right text-xs text-muted">{text.length} / 400</div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="demo-voice" className="mb-2 block text-sm font-semibold">Voice</label>
          <select id="demo-voice" value={voice} onChange={(e) => setVoice(e.target.value)} className="h-12 w-full rounded-2xl border border-line bg-surface px-3 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25">
            {voices.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <Button size="lg" onClick={listen} disabled={busy || text.trim().length < 2}>{busy ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5 fill-current" />} Listen to the sample</Button>
      </div>
      {err && <p role="alert" className="mt-3 rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger">{err}</p>}
      {done && !err && (
        <p className="mt-4 rounded-2xl bg-accent-soft p-4 text-sm text-accent-fg">Like it? <Link href="/sign-up?next=/home" className="font-semibold underline">Create a free account</Link> to listen to whole documents, upload PDFs and Word files, and download the audio.</p>
      )}
    </div>
  );
}
