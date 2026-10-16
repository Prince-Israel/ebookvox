"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, ClipboardPaste, FileText, FileUp, History, Sparkles, Trash2, Type, UploadCloud, X } from "lucide-react";
import { Async, Badge, Button, Card, EmptyState, ErrorState, Skeleton, Textarea, cx, useToast, when } from "@/components/ui";
import { Cover } from "@/components/Cover";
import { DocView } from "@/components/DocView";
import { Player } from "@/components/audio/Player";
import { usePlayback, type Doc } from "@/components/audio/PlaybackProvider";
import { useAuth } from "@/components/UserContext";
import { AuthPrompt } from "@/components/AuthPrompt";
import { BookCarousel } from "@/components/BookCarousel";
import { api, ApiFailure, useApi } from "@/lib/client";
import { wordCount } from "@/lib/text";
import { formatMoney } from "@/lib/money";

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export default function HomePage() {
  const { user } = useAuth();
  const guest = !user;
  const [prompt, setPrompt] = useState<string | null>(null);
  const toast = useToast();
  const [tab, setTab] = useState<"text" | "upload">("text");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "save" | "upload" | "open">(null);
  const [stage, setStage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);

  // The player is shared by the whole app, so audio keeps playing when you leave this page.
  const pb = usePlayback();
  const { engine, blocks, chunks, voice, setVoice, speed, setSpeed } = pb;
  const doc: Doc | null = pb.session?.kind === "doc" ? pb.session.doc : null;

  const recent = useApi<{ documents: Array<{ id: string; title: string; kind: string; createdAt: string }> }>(user ? "/api/documents" : null, "We couldn't load your recent documents.");
  const library = useApi<{ reading: Array<{ id: string; title: string; author: string; coverHue: number; coverUrl: string | null; percent: number }> }>(user ? "/api/library" : null, "We couldn't load your books.");

  // Text typed while signed out is kept, so it is waiting for them right after they register or sign in.
  useEffect(() => {
    try {
      const d = sessionStorage.getItem("ev-draft-text");
      if (d) { setText(d); if (user) sessionStorage.removeItem("ev-draft-text"); }
    } catch {}
  }, [user]);

  function start(d: Doc, autoplay: boolean) {
    pb.openDoc(d, autoplay);
    recent.reload();
    setTimeout(() => document.getElementById("reader")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function readAloud() {
    if (guest) {
      try { sessionStorage.setItem("ev-draft-text", text); } catch {}
      return setPrompt("Create a free account or sign in to hear your text read aloud. We've kept what you typed.");
    }
    engine.unlock(); // must happen synchronously inside the tap for mobile browsers
    setBusy("save");
    try {
      const { document: d } = await api<{ document: Doc }>("/api/documents", { method: "POST", json: { text } });
      start(d, true);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
    setBusy(null);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    if (guest) { if (fileRef.current) fileRef.current.value = ""; return setPrompt(`Create a free account or sign in to turn “${file.name}” into audio.`); }
    lastFile.current = file;
    setUploadError(null);
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "docx", "txt"].includes(ext ?? "")) return setUploadError("Unsupported file type. Please choose a PDF, DOCX or TXT file.");
    if (file.size > 15 * 1024 * 1024) return setUploadError("This file is too large. The limit is 15 MB.");
    engine.unlock();
    setBusy("upload");
    setStage("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const t = setTimeout(() => setStage("Extracting text…"), 700);
      const { document: d } = await api<{ document: Doc }>("/api/extract", { method: "POST", body: fd });
      clearTimeout(t);
      setStage("Preparing audio…");
      start(d, user!.autoPlay);
    } catch (e) {
      setUploadError((e as ApiFailure).message);
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function openRecent(id: string) {
    engine.unlock();
    setBusy("open");
    try {
      const { document: d } = await api<{ document: Doc }>(`/api/documents/${id}`);
      start(d, false);
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
    setBusy(null);
  }

  async function removeRecent(id: string) {
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      if (doc?.id === id) pb.stop();
      recent.reload();
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
  }

  const pickBlock = pb.pickBlock;

  const tabBtn = (id: "text" | "upload", label: string, Icon: typeof Type) => (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx("flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-wide transition", tab === id ? "bg-primary text-primary-fg shadow-card" : "text-muted hover:text-fg")}>
      <Icon className="size-5" /> {label}
    </button>
  );

  return (
    <div className="space-y-10">
      <section className="anim-up">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Your Words. Our Voice.</p>
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{user ? `Welcome back, ${user.firstName}` : "Welcome to Ebookvox"}</h1>
      </section>

      <section aria-labelledby="ra" className="anim-up [animation-delay:.08s]">
        <Card className="p-4 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent-fg"><Sparkles className="size-6" /></div>
            <div>
              <h2 id="ra" className="text-sm font-bold uppercase tracking-[0.2em]">Read Aloud</h2>
              <p className="text-sm text-muted">Type, paste or upload — then listen.</p>
            </div>
          </div>
          <div role="tablist" className="mb-5 flex gap-1 rounded-full bg-surface2 p-1">{tabBtn("text", "TEXT", Type)}{tabBtn("upload", "UPLOAD", FileUp)}</div>

          {tab === "text" ? (
            <div role="tabpanel" className="space-y-3">
              <Textarea label="Your text" id="ra-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste anything you'd like to hear…" maxLength={400000} hint={`${wordCount(text).toLocaleString()} words · blank lines start a new paragraph`} />
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="flex-1 sm:flex-none" loading={busy === "save"} disabled={!text.trim()} onClick={readAloud}>Read Aloud</Button>
                <Button size="lg" variant="secondary" onClick={async () => { try { setText(await navigator.clipboard.readText()); } catch { toast("Your browser wouldn't let us read the clipboard. Paste with Ctrl/⌘+V instead.", "error"); } }}><ClipboardPaste className="size-5" /> Paste</Button>
                {text && <Button size="lg" variant="ghost" onClick={() => setText("")}><X className="size-5" /> Clear</Button>}
              </div>
            </div>
          ) : (
            <div role="tabpanel" className="space-y-3">
              <label
                htmlFor="ra-file"
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                className={cx("flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-accent bg-accent-soft" : "border-line bg-surface2/50 hover:bg-surface2", busy === "upload" && "pointer-events-none opacity-70")}
              >
                <div className="mb-3 grid size-16 place-items-center rounded-full bg-accent-soft text-accent-fg"><UploadCloud className="size-8" /></div>
                {busy === "upload" ? <p className="font-semibold">{stage}</p> : (<><p className="text-lg font-semibold">Tap to choose a file</p><p className="mt-1 text-sm text-muted">or drag and drop · PDF, DOCX or TXT · up to 15 MB</p></>)}
              </label>
              <input ref={fileRef} id="ra-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
              {uploadError && <ErrorState message={uploadError} onRetry={lastFile.current ? () => handleFile(lastFile.current) : () => fileRef.current?.click()} />}
            </div>
          )}
        </Card>
      </section>

      <BookCarousel />

      {doc && (
        <section id="reader" aria-label="Reading view" className="anim-up scroll-mt-20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2"><FileText className="size-5 shrink-0 text-accent" /><h2 className="truncate text-2xl font-semibold">{doc.title}</h2><Badge tone="accent">{doc.kind}</Badge></div>
            <Button size="sm" variant="ghost" onClick={pb.stop}><X className="size-4" /> Close</Button>
          </div>
          <div className="lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-6">
            <Card className="mb-4 max-h-[60dvh] overflow-y-auto lg:mb-0 lg:max-h-[70dvh]"><DocView blocks={blocks} chunks={chunks} activeChunk={engine.index} onPick={pickBlock} /></Card>
            <div className="hidden lg:sticky lg:top-20 lg:block">
              <Player engine={engine} voice={voice} onVoice={setVoice} speed={speed} onSpeed={setSpeed} />
            </div>
          </div>
        </section>
      )}

      {user && (<section aria-labelledby="cont">
        <h2 id="cont" className="mb-4 text-2xl font-semibold">Continue reading</h2>
        <Async state={library} skeleton={<div className="scroll-x">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-72" />)}</div>}
          isEmpty={(d) => d.reading.length === 0}
          empty={<EmptyState icon={<BookOpen className="size-8" />} title="Nothing in progress" body="Open a free book and your place will be saved here." action={<Link href="/books"><Button variant="secondary">Browse books</Button></Link>} />}>
          {(d) => (
            <div className="scroll-x">
              {d.reading.slice(0, 8).map((b) => (
                <Link key={b.id} href={`/read/${b.id}`} className="flex w-72 gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5">
                  <div className="w-20 shrink-0"><Cover title={b.title} author={b.author} hue={b.coverHue} url={b.coverUrl} /></div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div><p className="line-clamp-2 font-serif text-lg font-semibold leading-snug">{b.title}</p><p className="truncate text-sm text-muted">{b.author}</p></div>
                    <div><div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${b.percent}%` }} /></div><p className="mt-1 text-xs text-muted">{Math.round(b.percent)}% · Continue</p></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Async>
      </section>)}

      {user && (<section aria-labelledby="rec">
        <h2 id="rec" className="mb-4 flex items-center gap-2 text-2xl font-semibold"><History className="size-6 text-accent" /> Recent documents</h2>
        <Async state={recent} skeleton={<Skeleton className="h-24 w-full" />} isEmpty={(d) => d.documents.length === 0}
          empty={<EmptyState icon={<FileText className="size-8" />} title="No documents yet" body="Text you read aloud and files you upload are saved here so you can listen again." />}>
          {(d) => (
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.documents.map((x) => (
                <li key={x.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pl-4">
                  <button onClick={() => openRecent(x.id)} disabled={busy === "open"} className="min-w-0 flex-1 text-left">
                    <p className="truncate font-semibold">{x.title}</p>
                    <p className="text-xs text-muted">{x.kind} · {when(x.createdAt)}</p>
                  </button>
                  <button onClick={() => removeRecent(x.id)} aria-label={`Delete ${x.title}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-5" /></button>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </section>)}
      <AuthPrompt open={!!prompt} onClose={() => setPrompt(null)} next="/home" reason={prompt ?? ""} />
    </div>
  );
}
