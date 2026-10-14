"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { Sheet, Spinner, cx } from "../ui";
import { VOICES, type VoiceGroup } from "@/lib/voices";

const GROUPS: Array<"All" | VoiceGroup> = ["All", "African", "International", "Narrator"];

export function VoicePicker({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: string; onChange: (id: string) => void }) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!open) stop();
    return () => stop();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function stop() {
    audio.current?.pause();
    setPreviewing(null);
    setLoadingId(null);
  }

  async function preview(id: string, name: string) {
    setErr(null);
    if (previewing === id) return stop();
    stop();
    const a = (audio.current ??= new Audio());
    // synchronous play inside the tap unlocks audio on iOS before we await the network
    a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
    a.play().catch(() => {});
    setLoadingId(id);
    try {
      let url = urls.current.get(id);
      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `Hello, I'm ${name}. This is how I'll read your words aloud.`, voice: id }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Preview unavailable.");
        url = URL.createObjectURL(await res.blob());
        urls.current.set(id, url);
      }
      a.src = url;
      a.onended = () => setPreviewing(null);
      await a.play();
      setPreviewing(id);
    } catch (e) {
      setErr((e as Error).message || "We couldn't play that preview. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  const list = VOICES.filter((v) => group === "All" || v.group === group);
  return (
    <Sheet open={open} onClose={onClose} title="Choose a voice">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {GROUPS.map((g) => (
          <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)} className={cx("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition", group === g ? "bg-primary text-primary-fg" : "bg-surface2 text-fg hover:bg-line")}>
            {g}
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
      <p className="mb-3 text-sm text-muted">{VOICES.length} voices · every voice sounds different — tap Preview to hear it.</p>
      <ul className="space-y-2.5">
        {list.map((v) => {
          const selected = v.id === value;
          return (
            <li key={v.id} className={cx("flex items-center gap-3 rounded-2xl border p-3 transition", selected ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary font-serif text-lg text-primary-fg">{v.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-semibold">{v.name}</span>
                  <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-semibold text-muted">{v.style}</span>
                </div>
                <p className="truncate text-sm text-muted">{v.accent} · {v.gender}</p>
                <p className="line-clamp-2 text-xs text-muted">{v.description}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <button onClick={() => preview(v.id, v.name)} aria-label={`Preview voice ${v.name}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-medium hover:bg-surface2">
                  {loadingId === v.id ? <Spinner className="size-4" /> : previewing === v.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                  Preview
                </button>
                <button onClick={() => { onChange(v.id); stop(); onClose(); }} aria-pressed={selected} className={cx("inline-flex h-9 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium", selected ? "bg-primary text-primary-fg" : "bg-surface2 hover:bg-line")}>
                  {selected ? <><Check className="size-4" /> Selected</> : "Use voice"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
