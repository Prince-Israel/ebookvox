"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, List, Minus, Plus } from "lucide-react";
import { Badge, Button, Card, ErrorState, Sheet, Skeleton, cx } from "@/components/ui";
import { DocView } from "@/components/DocView";
import { Player } from "@/components/audio/Player";
import { usePlayback, type BookSession } from "@/components/audio/PlaybackProvider";

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pb = usePlayback();
  // Opening a book that is already being read just shows it again — the audio carries on from where it is.
  useEffect(() => { void pb.openBook(id); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = pb.session?.kind === "book" && pb.session.id === id ? pb.session : null;

  if (!s) {
    if (pb.opening?.id === id && pb.opening.error) return <ErrorState message={pb.opening.error} onRetry={() => void pb.openBook(id)} />;
    return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-96" /></div>;
  }
  return <Reader s={s} />;
}

function Reader({ s }: { s: BookSession }) {
  const pb = usePlayback();
  const { engine, blocks, chunks } = pb;
  const [toc, setToc] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const scrolledFor = useRef<string | null>(null);
  const ch = s.meta.chapters[s.chapterIdx];

  useEffect(() => { try { setFontScale(Number(localStorage.getItem("ev-font")) || 1); } catch {} }, []);

  // When the chapter's text appears (first open, or coming back to a book that's playing), bring the current passage into view.
  useEffect(() => {
    if (!s.chapter || !blocks.length) return;
    const key = `${s.id}:${s.chapter.index}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    const block = chunks[engine.index]?.block ?? 0;
    setTimeout(() => {
      const node = document.querySelector<HTMLElement>(`[data-block="${block}"]`);
      if (block > 0 && node) node.scrollIntoView({ block: "center" }); else window.scrollTo({ top: 0 });
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.chapter, blocks.length]);

  function resize(d: number) {
    const v = Math.min(1.6, Math.max(0.8, Math.round((fontScale + d) * 10) / 10));
    setFontScale(v);
    try { localStorage.setItem("ev-font", String(v)); } catch {}
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/library" className="inline-flex h-10 items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Library</Link>
        <div className="flex items-center gap-1">
          <button onClick={() => resize(-0.1)} aria-label="Smaller text" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><Minus className="size-4" /></button>
          <span className="w-9 text-center text-xs text-muted">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => resize(0.1)} aria-label="Larger text" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><Plus className="size-4" /></button>
          <Button size="sm" variant="secondary" onClick={() => setToc(true)}><List className="size-4" /> Chapters</Button>
        </div>
      </div>

      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{s.meta.book.category}</p>
        <h1 className="mt-1 break-words text-3xl font-semibold leading-tight sm:text-4xl">{s.meta.book.title}</h1>
        <p className="text-muted">by {s.meta.book.author}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(s.percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${s.percent}%` }} /></div>
          <span className="w-12 text-right text-sm font-medium tabular-nums">{Math.round(s.percent)}%</span>
        </div>
      </header>

      <div className="xl:grid xl:grid-cols-[1fr_24rem] xl:items-start xl:gap-6">
        <Card className="min-h-[50dvh] px-4 py-6 sm:px-10 sm:py-10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="min-w-0 break-words text-2xl font-semibold">{ch?.title}</h2>
            <Badge>{s.chapterIdx + 1} / {s.meta.chapters.length}</Badge>
          </div>
          {s.loadError ? (
            <div role="alert" className="rounded-2xl bg-danger-soft p-6 text-center text-sm"><p className="font-medium">{s.loadError}</p><Button className="mt-4" size="sm" variant="secondary" onClick={pb.retryChapter}>Try again</Button></div>
          ) : !s.chapter ? (
            <div className="space-y-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : (
            <div style={{ fontSize: `${fontScale}em` }}><DocView blocks={blocks} chunks={chunks} activeChunk={engine.index} onPick={pb.pickBlock} follow={engine.playing} /></div>
          )}
          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            <Button variant="secondary" disabled={s.chapterIdx === 0} onClick={() => pb.goChapter(s.chapterIdx - 1)}><ChevronLeft className="size-4" /> Previous</Button>
            <Button variant="secondary" disabled={s.chapterIdx >= s.meta.chapters.length - 1} onClick={() => pb.goChapter(s.chapterIdx + 1)}>Next chapter <ChevronRight className="size-4" /></Button>
          </div>
        </Card>

        <div className="sticky top-20 hidden xl:block">
          <Player engine={engine} voice={pb.voice} onVoice={pb.setVoice} speed={pb.speed} onSpeed={pb.setSpeed} />
          {s.meta.progress.started && s.meta.progress.percent > 0 && <p className="mt-3 text-center text-xs text-muted">Resumed from where you left off · position saves automatically</p>}
        </div>
      </div>
      <div className="h-24 xl:hidden" aria-hidden />

      <Sheet open={toc} onClose={() => setToc(false)} title="Chapters">
        <ol className="space-y-1.5">
          {s.meta.chapters.map((c) => (
            <li key={c.index}>
              <button onClick={() => { pb.goChapter(c.index); setToc(false); }} aria-current={c.index === s.chapterIdx ? "true" : undefined} className={cx("flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-surface2", c.index === s.chapterIdx && "bg-accent-soft font-semibold")}>
                <span className="min-w-0 truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-muted">{Math.round((c.startChar / Math.max(1, s.meta.book.totalChars)) * 100)}%</span>
              </button>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
