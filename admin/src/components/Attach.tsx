"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { cx, useToast } from "./ui";

export const MAX_PHOTOS = 4;
const MAX_MB = 10;

/** Choose up to four photos (camera or gallery on a phone) with small previews that can be removed before sending. */
export function AttachPhotos({ files, onChange, disabled, className }: { files: File[]; onChange: (f: File[]) => void; disabled?: boolean; className?: string }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  function add(list: FileList | null) {
    if (!list?.length) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/")) { toast(`“${f.name}” isn't a photo.`, "error"); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { toast(`“${f.name}” is over ${MAX_MB} MB.`, "error"); continue; }
      if (next.length >= MAX_PHOTOS) { toast(`You can attach up to ${MAX_PHOTOS} photos.`, "error"); break; }
      next.push(f);
    }
    onChange(next);
    if (input.current) input.current.value = "";
  }

  return (
    <div className={cx("space-y-2", className)}>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" aria-label="Attach photos" onChange={(e) => add(e.target.files)} tabIndex={-1} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled || files.length >= MAX_PHOTOS} onClick={() => input.current?.click()} className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-surface2 disabled:opacity-50">
          <ImagePlus className="size-5" /> Add photo
        </button>
        {files.length > 0 && <span className="text-xs text-muted">{files.length} of {MAX_PHOTOS}</span>}
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Photos to send">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative size-20 overflow-hidden rounded-2xl border border-line bg-surface2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[i]} alt={f.name} className="size-full object-cover" />
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/65 text-white"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type Attachment = { id: string; name: string; url: string };

/** Photos inside a chat bubble; tapping one opens it full size. */
export function MessagePhotos({ photos }: { photos?: Attachment[] }) {
  const [open, setOpen] = useState<Attachment | null>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
  if (!photos?.length) return null;
  return (
    <>
      <div className={cx("mt-2 grid gap-1.5", photos.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p)} aria-label={`Open photo ${p.name}`} className="overflow-hidden rounded-2xl bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} loading="lazy" className={cx("w-full object-cover", photos.length === 1 ? "max-h-72" : "aspect-square")} />
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={open.name} className="max-h-full max-w-full rounded-2xl object-contain" />
          <button onClick={() => setOpen(null)} aria-label="Close photo" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/15 text-white"><X className="size-6" /></button>
        </div>
      )}
    </>
  );
}
