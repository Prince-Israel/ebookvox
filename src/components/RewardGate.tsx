"use client";
import Link from "next/link";
import { Gift, Play } from "lucide-react";
import { Button, Sheet } from "@/components/ui";

/** "Watch a short video to unlock listening": the reward gate shown to free listeners. */
export function RewardGate({ open, watching, note, onWatch, onClose }: { open: boolean; watching: boolean; note: string | null; onWatch: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={() => { if (!watching) onClose(); }} title="Watch a video to listen">
      <div className="space-y-5 text-left">
        <div className="flex items-start gap-4 rounded-2xl bg-accent-soft p-4 text-accent-fg">
          <Gift className="mt-0.5 size-7 shrink-0" />
          <div>
            <p className="font-semibold">Your reward: listening, free</p>
            <p className="mt-1 text-sm">Ebookvox is free because of one short video. Watch it to the end and your voice starts straight away.</p>
          </div>
        </div>
        {note && <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger">{note}</p>}
        <Button size="lg" className="w-full" onClick={onWatch} loading={watching}><Play className="size-5 fill-current" /> {watching ? "Playing video…" : "Watch video"}</Button>
        <div className="flex flex-col items-center gap-1 text-sm">
          <Link href="/subscribe" onClick={() => !watching && onClose()} className="font-semibold text-accent underline underline-offset-2">Go ad-free: no videos, from $1.80 a month</Link>
          <button type="button" onClick={onClose} disabled={watching} className="h-10 rounded-full px-4 text-muted hover:bg-surface2 disabled:opacity-50">Not now</button>
        </div>
      </div>
    </Sheet>
  );
}
