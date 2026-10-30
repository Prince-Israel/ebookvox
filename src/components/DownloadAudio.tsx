"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";
import { isNativeApp } from "@/lib/public-config";

type Prepared = { total: number; next: number; done: boolean; url: string | null };

/**
 * Turns a document into one audio file and downloads it. The server prepares the audio in steps (reusing what was already played),
 * the button shows the progress, and the finished file is saved by the browser (or opened in the phone's own browser inside the apps).
 */
export function DownloadAudio({ docId, title, voice, variant = "button" }: { docId: string; title: string; voice: string; variant?: "button" | "icon" }) {
  const toast = useToast();
  const [pct, setPct] = useState<number | null>(null);
  const busy = pct !== null;

  async function deliver(url: string) {
    if (isNativeApp()) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: new URL(url, window.location.origin).toString() });
        return;
      } catch { /* fall through to the normal download */ }
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function start() {
    if (busy) return;
    setPct(0);
    try {
      let from = 0;
      for (;;) {
        const r = await api<Prepared>(`/api/documents/${docId}/audio`, { method: "POST", json: { voice, from } });
        setPct(Math.min(99, Math.round((r.next / Math.max(1, r.total)) * 100)));
        if (r.done && r.url) { await deliver(r.url); toast("Your audio file is ready."); break; }
        from = r.next;
      }
    } catch (e) {
      toast(e instanceof ApiFailure ? e.message : "We couldn't prepare the audio. Please try again.", "error");
    }
    setPct(null);
  }

  const label = busy ? `Preparing… ${pct}%` : "Download audio";
  if (variant === "icon")
    return (
      <button onClick={start} disabled={busy} aria-label={busy ? `Preparing audio for ${title}, ${pct}%` : `Download audio of ${title}`} title={label} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-fg disabled:opacity-60">
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
      </button>
    );
  return (
    <Button size="sm" variant="secondary" onClick={start} disabled={busy} aria-label={`Download audio of ${title}`}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {label}
    </Button>
  );
}
