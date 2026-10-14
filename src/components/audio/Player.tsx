"use client";
import { useState } from "react";
import { Mic2, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Spinner, cx } from "../ui";
import { VoicePicker } from "./VoicePicker";
import { resolveVoice, SPEEDS } from "@/lib/voices";
import type { Engine } from "./useAudioEngine";

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export function Player({ engine: e, voice, onVoice, speed, onSpeed, className }: { engine: Engine; voice: string; onVoice: (id: string) => void; speed: number; onSpeed: (s: number) => void; className?: string }) {
  const [picker, setPicker] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const v = resolveVoice(voice);
  const pct = e.total ? Math.min(100, (e.elapsed / e.total) * 100) : 0;
  const disabled = e.count === 0;
  const RepeatIcon = e.repeat === "one" ? Repeat1 : Repeat;
  const nextRepeat = { off: "all", all: "one", one: "off" } as const;
  const iconBtn = "grid size-11 place-items-center rounded-full transition hover:bg-surface2 disabled:opacity-40";

  return (
    <div className={cx("rounded-3xl border border-line bg-surface p-4 shadow-pop sm:p-5", className)} role="region" aria-label="Audio player">
      <div className="mb-3 flex items-center gap-2 text-sm">
        {e.loading ? (
          <span className="flex items-center gap-2 text-muted"><Spinner className="size-4" /> Preparing audio…</span>
        ) : e.error ? (
          <span role="alert" className="flex flex-wrap items-center gap-2 text-danger">
            {e.error}
            <button onClick={() => e.play()} className="font-semibold underline">Retry</button>
          </span>
        ) : e.ready ? (
          <span className="text-muted">{e.playing ? "Now reading" : "Audio ready"} · passage {e.index + 1} of {e.count}</span>
        ) : (
          <span className="text-muted">Add some text to start listening.</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="w-10 text-right text-xs tabular-nums text-muted">{fmt(e.elapsed / speed)}</span>
        <input
          type="range" min={0} max={Math.max(1, Math.round(e.total))} step={1} value={Math.round(e.elapsed)}
          onChange={(ev) => e.seekTotal(Number(ev.target.value))}
          aria-label="Seek" aria-valuetext={`${fmt(e.elapsed / speed)} of ${fmt(e.total / speed)}`}
          disabled={disabled} className="range flex-1" style={{ ["--p" as string]: `${pct}%` }}
        />
        <span className="w-10 text-xs tabular-nums text-muted">{fmt(e.total / speed)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-1">
        <button onClick={() => e.setRepeat(nextRepeat[e.repeat])} aria-label={`Repeat: ${e.repeat}`} aria-pressed={e.repeat !== "off"} disabled={disabled} className={cx(iconBtn, e.repeat !== "off" && "bg-accent-soft text-accent-fg")}>
          <RepeatIcon className="size-5" />
        </button>
        <button onClick={e.prev} aria-label="Previous passage" disabled={disabled} className={iconBtn}><SkipBack className="size-6" /></button>
        <button onClick={e.toggle} aria-label={e.playing ? "Pause" : "Play"} disabled={disabled} className="grid size-16 place-items-center rounded-full bg-primary text-primary-fg shadow-card transition active:scale-95 disabled:opacity-40">
          {e.loading && !e.playing ? <Spinner className="size-7" /> : e.playing ? <Pause className="size-7 fill-current" /> : <Play className="ml-1 size-7 fill-current" />}
        </button>
        <button onClick={e.next} aria-label="Next passage" disabled={disabled} className={iconBtn}><SkipForward className="size-6" /></button>
        <div className="relative">
          <button onClick={() => setSpeedOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={speedOpen} aria-label={`Playback speed ${speed}x`} className="h-11 min-w-12 rounded-full px-3 text-sm font-semibold tabular-nums hover:bg-surface2">{speed}x</button>
          {speedOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSpeedOpen(false)} />
              <ul role="listbox" aria-label="Playback speed" className="anim-up absolute bottom-14 right-0 z-20 w-28 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-pop">
                {SPEEDS.map((s) => (
                  <li key={s}>
                    <button role="option" aria-selected={s === speed} onClick={() => { onSpeed(s); setSpeedOpen(false); }} className={cx("flex h-10 w-full items-center justify-between px-4 text-sm hover:bg-surface2", s === speed && "font-semibold text-accent")}>
                      {s}x {s === speed && "✓"}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <button onClick={() => setPicker(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-surface2 px-3 py-2 text-left hover:bg-line" aria-label={`Voice: ${v.name}, ${v.accent}. Change voice`}>
          <Mic2 className="size-5 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{v.name} · {v.style}</span>
            <span className="block truncate text-xs text-muted">{v.accent}</span>
          </span>
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <button onClick={() => e.setVolume(e.volume === 0 ? 1 : 0)} aria-label={e.volume === 0 ? "Unmute" : "Mute"} className="text-muted">
            {e.volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={e.volume} onChange={(ev) => e.setVolume(Number(ev.target.value))} aria-label="Volume" className="range w-24" style={{ ["--p" as string]: `${e.volume * 100}%` }} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 sm:hidden">
        <button onClick={() => e.setVolume(e.volume === 0 ? 1 : 0)} aria-label={e.volume === 0 ? "Unmute" : "Mute"} className="text-muted">
          {e.volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        <input type="range" min={0} max={1} step={0.05} value={e.volume} onChange={(ev) => e.setVolume(Number(ev.target.value))} aria-label="Volume" className="range flex-1" style={{ ["--p" as string]: `${e.volume * 100}%` }} />
      </div>
      <VoicePicker open={picker} onClose={() => setPicker(false)} value={voice} onChange={onVoice} />
    </div>
  );
}
