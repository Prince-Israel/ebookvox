"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, List, Minus, Pause, Play, Plus, SkipBack, SkipForward } from "lucide-react";
import { Async, Badge, Button, Card, Sheet, Skeleton, Spinner, cx } from "@/components/ui";
import { DocView } from "@/components/DocView";
import { Player } from "@/components/audio/Player";
import { useAudioEngine } from "@/components/audio/useAudioEngine";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure, useApi } from "@/lib/client";
import { parseBlocks, toChunks } from "@/lib/text";

type Meta = {
  book: { id: string; title: string; author: string; category: string; totalChars: number };
  chapters: Array<{ index: number; title: string; startChar: number; charCount: number }>;
  progress: { chapterIndex: number; paragraphIndex: number; audioTime: number; percent: number; completed: boolean; started: boolean };
};
type Chapter = { index: number; title: string; content: string; startChar: number };

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const meta = useApi<Meta>(`/api/books/${id}/read`, "We couldn't open this book. Please try again.");
  return (
    <Async state={meta} skeleton={<div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-96" /></div>}>
      {(m) => <Reader id={id} meta={m} />}
    </Async>
  );
}

function Reader({ id, meta }: { id: string; meta: Meta }) {
  const { user } = useUser();
  const [voice, setVoice] = useState(user.defaultVoice);
  const [speed, setSpeed] = useState(user.defaultSpeed);
  const [chapterIdx, setChapterIdx] = useState(Math.min(meta.progress.chapterIndex, meta.chapters.length - 1));
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [percent, setPercent] = useState(meta.progress.percent);
  const [toc, setToc] = useState(false);
  const [full, setFull] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const initial = useRef<{ paragraph: number; audioTime: number } | null>({ paragraph: meta.progress.paragraphIndex, audioTime: meta.progress.audioTime });
  const autoNext = useRef(false);
  const state = useRef({ chapterIndex: chapterIdx, paragraphIndex: meta.progress.paragraphIndex, audioTime: meta.progress.audioTime, percent: meta.progress.percent });
  const dirty = useRef(false);

  useEffect(() => { try { setFontScale(Number(localStorage.getItem("ev-font")) || 1); } catch {} }, []);

  const blocks = useMemo(() => (chapter ? parseBlocks(chapter.content) : []), [chapter]);
  const chunks = useMemo(() => toChunks(blocks), [blocks]);
  const cumulative = useMemo(() => { let s = 0; return blocks.map((b) => { const at = s; s += b.text.length + 2; return at; }); }, [blocks]);

  const computePercent = useCallback((blockIdx: number) => {
    if (!chapter) return state.current.percent;
    const done = chapter.startChar + (cumulative[blockIdx] ?? 0);
    return Math.min(100, Math.max(0, (done / Math.max(1, meta.book.totalChars)) * 100));
  }, [chapter, cumulative, meta.book.totalChars]);

  const flush = useCallback((keepalive = false) => {
    if (!dirty.current) return;
    dirty.current = false;
    fetch(`/api/books/${id}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state.current), keepalive }).catch(() => { dirty.current = true; });
  }, [id]);

  const record = useCallback((patch: Partial<typeof state.current>) => {
    state.current = { ...state.current, ...patch };
    dirty.current = true;
    if (patch.percent !== undefined) setPercent(patch.percent);
  }, []);

  useEffect(() => {
    const t = setInterval(() => flush(), 5000);
    const hide = () => document.visibilityState === "hidden" && flush(true);
    const unload = () => flush(true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", unload);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", unload); flush(true); };
  }, [flush]);

  const chunkOfBlock = useCallback((b: number) => Math.max(0, chunks.findIndex((c) => c.block >= b)), [chunks]);

  const engine = useAudioEngine({
    voice, speed,
    meta: { title: chapter?.title ?? meta.book.title, artist: meta.book.author },
    onChunk: (i) => {
      const block = chunks[i]?.block ?? 0;
      record({ paragraphIndex: block, percent: computePercent(block) });
    },
    onTick: (_i, t) => { state.current.audioTime = t; dirty.current = true; },
    onFinished: () => {
      if (chapterIdx < meta.chapters.length - 1) { autoNext.current = true; goChapter(chapterIdx + 1, true); }
      else { record({ percent: 100, paragraphIndex: 0, audioTime: 0 }); flush(); }
    },
  });

  // load chapter content
  useEffect(() => {
    let off = false;
    setChapter(null);
    setLoadError(null);
    api<{ chapter: Chapter }>(`/api/books/${id}/chapters/${chapterIdx}`)
      .then((d) => { if (!off) setChapter(d.chapter); })
      .catch((e: ApiFailure) => { if (!off) setLoadError(e.message || "We couldn't load this chapter. Please try again."); });
    return () => { off = true; };
  }, [id, chapterIdx]);

  // when a chapter arrives: prepare audio at the saved position (or the start for a new chapter)
  useEffect(() => {
    if (!chapter || !chunks.length) return;
    const init = initial.current;
    initial.current = null;
    const startBlock = init ? Math.min(init.paragraph, blocks.length - 1) : 0;
    const startChunk = chunkOfBlock(startBlock);
    const play = autoNext.current || (!!init && user.autoPlay);
    autoNext.current = false;
    engine.load(chunks.map((c) => c.text), startChunk, play, init && chunks[startChunk]?.block === init.paragraph ? init.audioTime : 0);
    record({ chapterIndex: chapter.index, paragraphIndex: startBlock, percent: init ? state.current.percent : computePercent(startBlock), audioTime: init?.audioTime ?? 0 });
    setTimeout(() => {
      const node = document.querySelector<HTMLElement>(`[data-block="${startBlock}"]`);
      if (init && startBlock > 0) node?.scrollIntoView({ block: "center" });
      else window.scrollTo({ top: 0 });
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter]);

  // track reading position by scroll when not listening
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (engine.playing || !blocks.length) return;
        const nodes = document.querySelectorAll<HTMLElement>("[data-block]");
        for (const n of nodes) {
          if (n.getBoundingClientRect().bottom > 140) {
            const b = Number(n.dataset.block);
            if (b !== state.current.paragraphIndex) record({ paragraphIndex: b, percent: computePercent(b), audioTime: 0 });
            break;
          }
        }
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [blocks.length, engine.playing, computePercent, record]);

  useEffect(() => { if (!engine.playing) flush(); }, [engine.playing, flush]);

  function goChapter(i: number, autoplay = false) {
    if (i < 0 || i >= meta.chapters.length) return;
    flush();
    if (autoplay) autoNext.current = true;
    record({ chapterIndex: i, paragraphIndex: 0, audioTime: 0 });
    setChapterIdx(i);
    setToc(false);
  }

  function pick(block: number) {
    engine.goTo(chunkOfBlock(block), true);
  }

  function resize(d: number) {
    const v = Math.min(1.6, Math.max(0.8, Math.round((fontScale + d) * 10) / 10));
    setFontScale(v);
    try { localStorage.setItem("ev-font", String(v)); } catch {}
  }

  const ch = meta.chapters[chapterIdx];
  const chunkText = chunks[engine.index]?.text ?? "";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/library" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"><ArrowLeft className="size-4" /> Library</Link>
        <div className="flex items-center gap-1">
          <button onClick={() => resize(-0.1)} aria-label="Smaller text" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><Minus className="size-4" /></button>
          <span className="w-9 text-center text-xs text-muted">{Math.round(fontScale * 100)}%</span>
          <button onClick={() => resize(0.1)} aria-label="Larger text" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><Plus className="size-4" /></button>
          <Button size="sm" variant="secondary" onClick={() => setToc(true)}><List className="size-4" /> Chapters</Button>
        </div>
      </div>

      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{meta.book.category}</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{meta.book.title}</h1>
        <p className="text-muted">by {meta.book.author}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} /></div>
          <span className="w-12 text-right text-sm font-medium tabular-nums">{Math.round(percent)}%</span>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-6">
        <Card className="min-h-[50dvh] px-5 py-6 sm:px-10 sm:py-10">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">{ch?.title}</h2>
            <Badge>{chapterIdx + 1} / {meta.chapters.length}</Badge>
          </div>
          {loadError ? (
            <div role="alert" className="rounded-2xl bg-danger-soft p-6 text-center text-sm"><p className="font-medium">{loadError}</p><Button className="mt-4" size="sm" variant="secondary" onClick={() => { setLoadError(null); setChapterIdx((i) => i); setChapter(null); api<{ chapter: Chapter }>(`/api/books/${id}/chapters/${chapterIdx}`).then((d) => setChapter(d.chapter)).catch((e: ApiFailure) => setLoadError(e.message)); }}>Try again</Button></div>
          ) : !chapter ? (
            <div className="space-y-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
          ) : (
            <div style={{ fontSize: `${fontScale}em` }}><DocView blocks={blocks} chunks={chunks} activeChunk={engine.index} onPick={pick} follow={engine.playing} /></div>
          )}
          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            <Button variant="secondary" disabled={chapterIdx === 0} onClick={() => goChapter(chapterIdx - 1)}><ChevronLeft className="size-4" /> Previous</Button>
            <Button variant="secondary" disabled={chapterIdx >= meta.chapters.length - 1} onClick={() => goChapter(chapterIdx + 1)}>Next chapter <ChevronRight className="size-4" /></Button>
          </div>
        </Card>

        <div className="sticky top-20 hidden lg:block">
          <Player engine={engine} voice={voice} onVoice={setVoice} speed={speed} onSpeed={setSpeed} />
          {meta.progress.started && meta.progress.percent > 0 && <p className="mt-3 text-center text-xs text-muted">Resumed from where you left off · position saves automatically</p>}
        </div>
      </div>

      {/* mobile mini player */}
      <div className="safe-b fixed inset-x-0 bottom-[4.2rem] z-30 px-3 lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-full border border-line bg-surface p-2 pr-3 shadow-pop">
          <button onClick={engine.toggle} aria-label={engine.playing ? "Pause" : "Play"} disabled={!engine.count} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg disabled:opacity-50">
            {engine.loading && !engine.playing ? <Spinner className="size-5" /> : engine.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
          </button>
          <button onClick={() => setFull(true)} className="min-w-0 flex-1 text-left" aria-label="Open full player">
            <span className="block truncate text-sm font-semibold">{engine.error ? "Tap to retry" : chunkText || ch?.title}</span>
            <span className="block text-xs text-muted">{speed}x · tap for controls</span>
          </button>
          <button onClick={engine.prev} aria-label="Previous passage" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><SkipBack className="size-5" /></button>
          <button onClick={engine.next} aria-label="Next passage" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><SkipForward className="size-5" /></button>
          <button onClick={() => setFull(true)} aria-label="Expand player" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><ChevronDown className="size-5 rotate-180" /></button>
        </div>
      </div>
      <Sheet open={full} onClose={() => setFull(false)} title="Player"><Player engine={engine} voice={voice} onVoice={setVoice} speed={speed} onSpeed={setSpeed} className="border-0 p-0 shadow-none" /></Sheet>

      <Sheet open={toc} onClose={() => setToc(false)} title="Chapters">
        <ol className="space-y-1.5">
          {meta.chapters.map((c) => (
            <li key={c.index}>
              <button onClick={() => goChapter(c.index)} aria-current={c.index === chapterIdx ? "true" : undefined} className={cx("flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-surface2", c.index === chapterIdx && "bg-accent-soft font-semibold")}>
                <span className="truncate">{c.title}</span>
                <span className="shrink-0 text-xs text-muted">{Math.round((c.startChar / Math.max(1, meta.book.totalChars)) * 100)}%</span>
              </button>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
