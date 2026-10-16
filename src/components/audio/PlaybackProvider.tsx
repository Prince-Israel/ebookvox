"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { Sheet, Spinner } from "../ui";
import { Player } from "./Player";
import { useAudioEngine, type Engine } from "./useAudioEngine";
import { useAuth } from "../UserContext";
import { api, ApiFailure } from "@/lib/client";
import { parseBlocks, toChunks, type Block, type Chunk } from "@/lib/text";
import { DEFAULT_VOICE } from "@/lib/voices";
import { backgroundAudio } from "@/lib/native-audio";

export type BookMeta = {
  book: { id: string; title: string; author: string; category: string; totalChars: number };
  chapters: Array<{ index: number; title: string; startChar: number; charCount: number }>;
  progress: { chapterIndex: number; paragraphIndex: number; audioTime: number; percent: number; completed: boolean; started: boolean };
};
export type Chapter = { index: number; title: string; content: string; startChar: number };
export type Doc = { id: string; title: string; kind: string; text: string };
export type BookSession = { kind: "book"; id: string; meta: BookMeta; chapterIdx: number; chapter: Chapter | null; loadError: string | null; percent: number };
export type DocSession = { kind: "doc"; doc: Doc };
export type Session = BookSession | DocSession | null;

type Ctx = {
  engine: Engine;
  session: Session;
  opening: { id: string; error: string | null } | null;
  blocks: Block[];
  chunks: Chunk[];
  voice: string;
  setVoice: (id: string) => void;
  speed: number;
  setSpeed: (s: number) => void;
  openBook: (id: string) => Promise<void>;
  openDoc: (doc: Doc, autoplay: boolean) => void;
  goChapter: (i: number, autoplay?: boolean) => void;
  retryChapter: () => void;
  pickBlock: (block: number) => void;
  stop: () => void;
  openFull: () => void;
};
const C = createContext<Ctx | null>(null);
export const usePlayback = () => useContext(C)!;

/**
 * The one audio player for the whole signed-in app. It lives above the pages, so reading carries on while the listener moves
 * between Home, Books, Library, Profile… and a mini player follows them around. It stops only when the listener pauses or closes it.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [voice, setVoice] = useState(user?.defaultVoice ?? DEFAULT_VOICE);
  const [speed, setSpeed] = useState(user?.defaultSpeed ?? 1);
  const [session, setSession] = useState<Session>(null);
  const [opening, setOpening] = useState<{ id: string; error: string | null } | null>(null);
  const [full, setFull] = useState(false);
  const [reload, setReload] = useState(0);

  const sessionRef = useRef<Session>(null);
  sessionRef.current = session;
  const initial = useRef<{ paragraph: number; audioTime: number } | null>(null);
  const autoNext = useRef(false);
  const progress = useRef({ chapterIndex: 0, paragraphIndex: 0, audioTime: 0, percent: 0 });
  const dirty = useRef(false);
  const handlers = useRef<{ onChunk: (i: number) => void; onTick: (i: number, t: number) => void; onFinished: () => void }>({ onChunk() {}, onTick() {}, onFinished() {} });

  const text = session?.kind === "book" ? session.chapter?.content ?? null : session?.kind === "doc" ? session.doc.text : null;
  const blocks = useMemo(() => (text ? parseBlocks(text) : []), [text]);
  const chunks = useMemo(() => toChunks(blocks), [blocks]);
  const cumulative = useMemo(() => { let s = 0; return blocks.map((b) => { const at = s; s += b.text.length + 2; return at; }); }, [blocks]);

  const title = session?.kind === "book" ? session.chapter?.title ?? session.meta.book.title : session?.kind === "doc" ? session.doc.title : undefined;
  const artist = session?.kind === "book" ? session.meta.book.author : "Ebookvox";
  const engine = useAudioEngine({
    voice, speed, meta: title ? { title, artist } : undefined,
    onChunk: (i) => handlers.current.onChunk(i),
    onTick: (i, t) => handlers.current.onTick(i, t),
    onFinished: () => handlers.current.onFinished(),
  });

  // ---- reading progress (books only) ----
  const flush = useCallback((keepalive = false) => {
    const s = sessionRef.current;
    if (!dirty.current || s?.kind !== "book") return;
    dirty.current = false;
    fetch(`/api/books/${s.id}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(progress.current), keepalive }).catch(() => { dirty.current = true; });
  }, []);
  const record = useCallback((patch: Partial<typeof progress.current>) => {
    progress.current = { ...progress.current, ...patch };
    dirty.current = true;
    if (patch.percent !== undefined) setSession((s) => (s?.kind === "book" ? { ...s, percent: patch.percent! } : s));
  }, []);
  const computePercent = useCallback((blockIdx: number) => {
    const s = sessionRef.current;
    if (s?.kind !== "book" || !s.chapter) return progress.current.percent;
    return Math.min(100, Math.max(0, ((s.chapter.startChar + (cumulative[blockIdx] ?? 0)) / Math.max(1, s.meta.book.totalChars)) * 100));
  }, [cumulative]);

  useEffect(() => {
    const t = setInterval(() => flush(), 5000);
    const hide = () => document.visibilityState === "hidden" && flush(true);
    const unload = () => flush(true);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", unload);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", unload); };
  }, [flush]);

  // ---- session control ----
  const stop = useCallback(() => {
    flush(true);
    engine.stop();
    setSession(null);
    setOpening(null);
    setFull(false);
    initial.current = null;
    autoNext.current = false;
  }, [engine, flush]);

  const openBook = useCallback(async (id: string) => {
    const cur = sessionRef.current;
    if (cur?.kind === "book" && cur.id === id) return; // already open (maybe playing): just show it
    flush(true);
    engine.stop();
    setSession(null);
    setOpening({ id, error: null });
    try {
      const meta = await api<BookMeta>(`/api/books/${id}/read`);
      initial.current = { paragraph: meta.progress.paragraphIndex, audioTime: meta.progress.audioTime };
      progress.current = { chapterIndex: meta.progress.chapterIndex, paragraphIndex: meta.progress.paragraphIndex, audioTime: meta.progress.audioTime, percent: meta.progress.percent };
      dirty.current = false;
      setSession({ kind: "book", id, meta, chapterIdx: Math.min(meta.progress.chapterIndex, meta.chapters.length - 1), chapter: null, loadError: null, percent: meta.progress.percent });
      setOpening(null);
    } catch (e) {
      setOpening({ id, error: (e as ApiFailure).message || "We couldn't open this book. Please try again." });
    }
  }, [engine, flush]);

  const openDoc = useCallback((doc: Doc, autoplay: boolean) => {
    flush(true);
    setSession({ kind: "doc", doc });
    setOpening(null);
    engine.load(toChunks(parseBlocks(doc.text)).map((c) => c.text), 0, autoplay);
  }, [engine, flush]);

  const goChapter = useCallback((i: number, autoplay = false) => {
    const s = sessionRef.current;
    if (s?.kind !== "book" || i < 0 || i >= s.meta.chapters.length) return;
    flush();
    if (autoplay) autoNext.current = true;
    record({ chapterIndex: i, paragraphIndex: 0, audioTime: 0 });
    setSession({ ...s, chapterIdx: i, chapter: null, loadError: null });
  }, [flush, record]);

  const pickBlock = useCallback((block: number) => {
    const idx = chunks.findIndex((c) => c.block >= block);
    if (idx >= 0) engine.goTo(idx, true);
  }, [chunks, engine]);

  handlers.current = {
    onChunk: (i) => {
      if (sessionRef.current?.kind !== "book") return;
      const block = chunks[i]?.block ?? 0;
      record({ paragraphIndex: block, percent: computePercent(block) });
    },
    onTick: (_i, t) => { if (sessionRef.current?.kind === "book") { progress.current.audioTime = t; dirty.current = true; } },
    onFinished: () => {
      const s = sessionRef.current;
      if (s?.kind !== "book") return;
      if (s.chapterIdx < s.meta.chapters.length - 1) goChapter(s.chapterIdx + 1, true);
      else { record({ percent: 100, paragraphIndex: 0, audioTime: 0 }); flush(); }
    },
  };

  // load the chapter's text whenever the book / chapter changes
  const bookId = session?.kind === "book" ? session.id : null;
  const chapterIdx = session?.kind === "book" ? session.chapterIdx : -1;
  useEffect(() => {
    if (!bookId) return;
    let off = false;
    api<{ chapter: Chapter }>(`/api/books/${bookId}/chapters/${chapterIdx}`)
      .then((d) => { if (!off) setSession((s) => (s?.kind === "book" && s.id === bookId && s.chapterIdx === chapterIdx ? { ...s, chapter: d.chapter, loadError: null } : s)); })
      .catch((e: ApiFailure) => { if (!off) setSession((s) => (s?.kind === "book" && s.id === bookId ? { ...s, loadError: e.message || "We couldn't load this chapter. Please try again." } : s)); });
    return () => { off = true; };
  }, [bookId, chapterIdx, reload]);
  const retryChapter = useCallback(() => { setSession((s) => (s?.kind === "book" ? { ...s, chapter: null, loadError: null } : s)); setReload((n) => n + 1); }, []);

  // when a chapter arrives: queue its audio at the saved position (or the start of a new chapter)
  const chapter = session?.kind === "book" ? session.chapter : null;
  useEffect(() => {
    if (!chapter || !chunks.length) return;
    const init = initial.current;
    initial.current = null;
    const startBlock = init ? Math.min(init.paragraph, blocks.length - 1) : 0;
    const startChunk = Math.max(0, chunks.findIndex((c) => c.block >= startBlock));
    const play = autoNext.current || (!!init && !!user?.autoPlay);
    autoNext.current = false;
    engine.load(chunks.map((c) => c.text), startChunk, play, init && chunks[startChunk]?.block === init.paragraph ? init.audioTime : 0);
    record({ chapterIndex: chapter.index, paragraphIndex: startBlock, percent: init ? progress.current.percent : computePercent(startBlock), audioTime: init?.audioTime ?? 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter]);

  useEffect(() => { if (!engine.playing) flush(); }, [engine.playing, flush]);

  // Native apps: keep the process alive and show a "reading" notification while audio plays with the screen off or the app minimised.
  // "Reading" includes the moments between passages (loading the next one). Only a real pause of a few seconds ends it,
  // so the service isn't torn down and restarted at every passage — starting one from the background is not allowed on newer Android.
  const reading = engine.playing || engine.loading;
  useEffect(() => {
    if (reading) { backgroundAudio.start(title ?? "Ebookvox", artist); return; }
    const t = setTimeout(() => backgroundAudio.stop(), 6000);
    return () => clearTimeout(t);
  }, [reading, title, artist]);
  useEffect(() => backgroundAudio.onStopRequested(() => engine.pause()), [engine]);

  // the mini player is for being somewhere else: it hides on the page that already shows this session in full on desktop
  const onOwnPage = session?.kind === "book" ? pathname === `/read/${session.id}` : session?.kind === "doc" ? pathname === "/home" : false;
  const active = !!session && (engine.count > 0 || engine.loading);
  const go = () => { if (session?.kind === "book" && !onOwnPage) router.push(`/read/${session.id}`); else if (session?.kind === "doc" && !onOwnPage) router.push("/home#reader"); else setFull(true); };

  const value: Ctx = { engine, session, opening, blocks, chunks, voice, setVoice, speed, setSpeed, openBook, openDoc, goChapter, retryChapter, pickBlock, stop, openFull: () => setFull(true) };
  const chunkText = chunks[engine.index]?.text ?? "";

  return (
    <C.Provider value={value}>
      {children}
      {active && (
        <div data-hide-on-kb className={`safe-b fixed inset-x-0 bottom-[4.2rem] z-30 px-3 ${onOwnPage ? "lg:hidden" : "lg:bottom-4 lg:left-auto lg:right-4 lg:w-[26rem]"}`}>
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-full border border-line bg-surface p-2 pr-3 shadow-pop">
            <button onClick={engine.toggle} aria-label={engine.playing ? "Pause" : "Play"} disabled={!engine.count} className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg disabled:opacity-50">
              {engine.loading && !engine.playing ? <Spinner className="size-5" /> : engine.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
            </button>
            <button onClick={go} className="min-w-0 flex-1 text-left" aria-label={onOwnPage ? "Open full player" : "Back to what you're reading"}>
              <span className="block truncate text-sm font-semibold">{engine.error ? "Tap to retry" : title ?? chunkText}</span>
              <span className="block truncate text-xs text-muted">{engine.playing ? "Reading" : "Paused"} · {speed}x · {onOwnPage ? "tap for controls" : "tap to open"}</span>
            </button>
            <button onClick={engine.prev} aria-label="Previous passage" className="hidden size-10 place-items-center rounded-full hover:bg-surface2 min-[380px]:grid"><SkipBack className="size-5" /></button>
            <button onClick={engine.next} aria-label="Next passage" className="hidden size-10 place-items-center rounded-full hover:bg-surface2 min-[380px]:grid"><SkipForward className="size-5" /></button>
            {onOwnPage
              ? <button onClick={() => setFull(true)} aria-label="Expand player" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface2"><ChevronDown className="size-5 rotate-180" /></button>
              : <button onClick={stop} aria-label="Stop and close player" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface2"><X className="size-5" /></button>}
          </div>
        </div>
      )}
      <Sheet open={full} onClose={() => setFull(false)} title="Player">
        <Player engine={engine} voice={voice} onVoice={setVoice} speed={speed} onSpeed={setSpeed} className="border-0 p-0 shadow-none" />
        <button onClick={stop} className="mt-4 w-full rounded-full border border-line py-3 text-sm font-semibold text-muted hover:bg-surface2">Stop and close player</button>
      </Sheet>
    </C.Provider>
  );
}
