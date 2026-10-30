"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Lock, Search } from "lucide-react";
import { Banner, Button, PageTitle, Sheet, Skeleton, cx } from "@/components/ui";
import { api } from "@/lib/client";
import { BIBLE_VERSIONS, type BibleBook, type Seg, type StrongsEntry, type XRef } from "@/lib/bible";

type Hit = { b: number; c: number; v: number; text: string };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const cache: Record<string, Promise<any>> = {};
const getJson = <T,>(url: string): Promise<T> => (cache[url] ??= fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).catch((e) => { delete cache[url]; throw e; }));

export default function BiblePage() {
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [book, setBook] = useState(43);
  const [chapter, setChapter] = useState(3);
  const [version, setVersion] = useState("KJV");
  const [red, setRed] = useState(true);
  const [strongs, setStrongs] = useState(true);
  const [text, setText] = useState<Seg[][] | null>(null);
  const [xrefs, setXrefs] = useState<Record<string, XRef[]>>({});
  const [error, setError] = useState(false);
  const [verse, setVerse] = useState<number | null>(null);
  const [word, setWord] = useState<{ num: string; label: string } | null>(null);
  const [mode, setMode] = useState<"read" | "search">("read");
  const [hl, setHl] = useState<number | null>(null);

  useEffect(() => {
    getJson<{ books: BibleBook[] }>("/bible/index.json").then((d) => setBooks(d.books)).catch(() => setError(true));
    try {
      const s = JSON.parse(store.get("bible-pos") ?? "null");
      if (s) { setBook(s.b); setChapter(s.c); }
      if (store.get("bible-red") === "0") setRed(false);
      if (store.get("bible-strongs") === "0") setStrongs(false);
    } catch { /* default position */ }
  }, []);

  const meta = books[book - 1];
  useEffect(() => {
    setText(null); setError(false);
    Promise.all([getJson<Seg[][][]>(`/bible/kjv/${book}.json`), getJson<Record<string, XRef[]>>(`/bible/xref/${book}.json`).catch(() => ({}))])
      .then(([t, x]) => { setText(t[chapter - 1] ?? t[0]); setXrefs(x); })
      .catch(() => setError(true));
    store.set("bible-pos", JSON.stringify({ b: book, c: chapter }));
  }, [book, chapter]);

  const go = useCallback((b: number, c: number, v?: number) => {
    setBook(b); setChapter(c); setVerse(null); setMode("read"); setHl(v ?? null);
    window.scrollTo({ top: 0 });
  }, []);
  const step = (d: number) => {
    if (!meta) return;
    if (d > 0) meta.ch > chapter ? go(book, chapter + 1) : book < 66 && go(book + 1, 1);
    else chapter > 1 ? go(book, chapter - 1) : book > 1 && go(book - 1, books[book - 2]?.ch ?? 1);
  };
  const ref = (b: number, c: number, v: number) => `${books[b - 1]?.name ?? ""} ${c}:${v}`;
  const selected = BIBLE_VERSIONS.find((x) => x.id === version)!;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Bible" sub={`${selected.full}${red ? " · words of Jesus in red" : ""}`} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select aria-label="Bible version" value={version} onChange={(e) => setVersion(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 font-medium">
          {BIBLE_VERSIONS.map((v) => <option key={v.id} value={v.id}>{v.name}{v.available ? "" : " — licence needed"}</option>)}
        </select>
        <div className="ml-auto flex rounded-xl border border-line p-0.5" role="tablist">
          {(["read", "search"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx("h-10 rounded-lg px-4 text-sm font-semibold", mode === m ? "bg-accent text-accent-fg" : "text-muted")}>{m === "read" ? "Read" : "Concordance"}</button>)}
        </div>
      </div>

      {!selected.available ? (
        <Banner tone="warn"><Lock className="mr-1 inline size-4" /> The {selected.full} is copyrighted, so it can only be added with the publisher's licence. Until it is connected, please read the KJV. <button className="font-semibold underline" onClick={() => setVersion("KJV")}>Switch to KJV</button></Banner>
      ) : mode === "search" ? (
        <Concordance books={books} onOpen={go} onWord={(num) => setWord({ num, label: num })} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select aria-label="Book" value={book} onChange={(e) => go(Number(e.target.value), 1)} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3">
              <optgroup label="Old Testament">{books.filter((b) => b.t === "OT").map((b) => <option key={b.n} value={b.n}>{b.name}</option>)}</optgroup>
              <optgroup label="New Testament">{books.filter((b) => b.t === "NT").map((b) => <option key={b.n} value={b.n}>{b.name}</option>)}</optgroup>
            </select>
            <select aria-label="Chapter" value={chapter} onChange={(e) => go(book, Number(e.target.value))} className="h-11 w-24 rounded-xl border border-line bg-surface px-3">
              {Array.from({ length: meta?.ch ?? 1 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </div>
          <div className="mb-5 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={red} onChange={(e) => { setRed(e.target.checked); store.set("bible-red", e.target.checked ? "1" : "0"); }} /> <span className="font-semibold text-[#c62828]">Words of Jesus in red</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={strongs} onChange={(e) => { setStrongs(e.target.checked); store.set("bible-strongs", e.target.checked ? "1" : "0"); }} /> Tap words for Strong's concordance</label>
          </div>

          <h2 className="mb-3 text-2xl font-bold">{meta?.name} {chapter}</h2>
          {error ? <Banner tone="danger" action={<Button size="sm" onClick={() => go(book, chapter)}>Try again</Button>}>We couldn't load this chapter.</Banner>
            : !text ? <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6" />)}</div>
            : (
              <article className="font-serif text-lg leading-8">
                {text.map((segs, i) => (
                  <p key={i} className={cx("mb-2", hl === i + 1 && "rounded-lg bg-accent-soft px-2")}>
                    <button onClick={() => setVerse(i + 1)} aria-label={`Verse ${i + 1}: cross-references`} className="mr-1.5 align-super text-xs font-bold text-accent">{i + 1}</button>
                    {segs.map(([t, s, f], j) => {
                      const cls = cx(red && f & 1 && "text-[#c62828]", f & 2 && "italic", f & 4 && "uppercase tracking-wide text-[0.9em]");
                      return s && strongs ? <button key={j} onClick={() => setWord({ num: s, label: t.trim() })} className={cx(cls, "inline cursor-pointer rounded-sm p-0 text-left decoration-dotted underline-offset-4 hover:underline")}>{t}</button> : <span key={j} className={cls}>{t}</span>;
                    })}
                  </p>
                ))}
              </article>
            )}
          <div className="my-8 flex justify-between">
            <Button variant="secondary" onClick={() => step(-1)} disabled={book === 1 && chapter === 1}><ChevronLeft className="size-4" /> Previous</Button>
            <Button variant="secondary" onClick={() => step(1)} disabled={book === 66 && chapter === (meta?.ch ?? 0)}>Next <ChevronRight className="size-4" /></Button>
          </div>
        </>
      )}

      <p className="mb-10 text-xs text-muted">King James Version (public domain) with Strong's numbers from the CrossWire/OpenScriptures project. Strong's dictionary: OpenScriptures, CC-BY-SA. Cross-references: openbible.info, CC-BY.</p>

      <Sheet open={verse !== null} onClose={() => setVerse(null)} title={verse ? `${meta?.name} ${chapter}:${verse}` : ""}>
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Link2 className="size-4" /> Cross-references</h3>
        {(xrefs[`${chapter}:${verse}`] ?? []).length === 0 ? <p className="text-muted">No cross-references for this verse.</p> : (
          <ul className="flex flex-wrap gap-2">
            {(xrefs[`${chapter}:${verse}`] ?? []).map((r, i) => (
              <li key={i}><button onClick={() => go(r[0], r[1], r[2])} className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface2">{ref(r[0], r[1], r[2])}{r[3] !== r[1] || r[4] !== r[2] ? `–${r[3] !== r[1] ? `${r[3]}:` : ""}${r[4]}` : ""}</button></li>
            ))}
          </ul>
        )}
      </Sheet>
      <WordSheet word={word} onClose={() => setWord(null)} onSearch={(num) => { setWord(null); setMode("search"); sessionStorage.setItem("bible-strong", num); window.dispatchEvent(new Event("bible-strong")); }} />
    </div>
  );
}

function WordSheet({ word, onClose, onSearch }: { word: { num: string; label: string } | null; onClose: () => void; onSearch: (num: string) => void }) {
  const [entry, setEntry] = useState<StrongsEntry | null | undefined>(undefined);
  useEffect(() => {
    if (!word) return;
    setEntry(undefined);
    getJson<Record<string, StrongsEntry>>(`/bible/strongs-${word.num[0].toLowerCase()}.json`).then((d) => setEntry(d[word.num] ?? null)).catch(() => setEntry(null));
  }, [word]);
  return (
    <Sheet open={!!word} onClose={onClose} title={word ? `“${word.label}” · ${word.num}` : ""}>
      {entry === undefined ? <Skeleton className="h-24" /> : !entry ? <p className="text-muted">No entry found.</p> : (
        <div className="space-y-3">
          <p className="text-3xl">{entry[0]} <span className="text-lg text-muted">{entry[1]}{entry[2] ? ` · ${entry[2]}` : ""}</span></p>
          <p><b>Meaning:</b> {entry[3]}</p>
          {entry[4] && <p><b>Translated in the KJV as:</b> {entry[4]}</p>}
          {entry[5] && <p className="text-sm text-muted"><b>Origin:</b> {entry[5]}</p>}
          <Button onClick={() => word && onSearch(word.num)}><Search className="size-4" /> Find every verse with this word</Button>
        </div>
      )}
    </Sheet>
  );
}

function Concordance({ books, onOpen, onWord }: { books: BibleBook[]; onOpen: (b: number, c: number, v: number) => void; onWord: (num: string) => void }) {
  const [q, setQ] = useState("");
  const [strong, setStrong] = useState("");
  const [res, setRes] = useState<{ total: number; results: Hit[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = useCallback(async (opts: { q?: string; strong?: string }, offset = 0) => {
    setBusy(true); setErr("");
    try {
      const d = await api<{ total: number; results: Hit[] }>(`/api/bible/search?${new URLSearchParams({ ...(opts.strong ? { strong: opts.strong } : { q: opts.q ?? "" }), ...(offset && { offset: String(offset) }) })}`);
      setRes((p) => (offset && p ? { total: d.total, results: [...p.results, ...d.results] } : d));
    } catch (e: any) { setErr(e?.message || "Search failed."); setRes(null); } finally { setBusy(false); }
  }, []);
  useEffect(() => {
    const pick = () => { const s = sessionStorage.getItem("bible-strong"); if (s) { sessionStorage.removeItem("bible-strong"); setStrong(s); setQ(""); run({ strong: s }); } };
    pick(); window.addEventListener("bible-strong", pick);
    return () => window.removeEventListener("bible-strong", pick);
  }, [run]);

  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const mark = (t: string) => {
    if (strong || !words.length) return t;
    const re = new RegExp(`(${words.map((w) => w.replace(/[^a-z0-9']/g, "")).filter(Boolean).join("|")})`, "gi");
    return t.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-accent-soft px-0.5">{p}</mark> : p));
  };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); setStrong(""); run({ q }); }} className="mb-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a word or phrase, e.g. grace" aria-label="Search the Bible" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4" />
        <Button type="submit" loading={busy}><Search className="size-4" /> Search</Button>
      </form>
      {strong && <p className="mb-3 text-sm"><button className="font-semibold text-accent underline" onClick={() => onWord(strong)}>{strong}</button> — every verse using this original-language word</p>}
      {err && <Banner tone="danger">{err}</Banner>}
      {res && <p className="mb-3 text-sm text-muted">{res.total.toLocaleString()} verse{res.total === 1 ? "" : "s"} found</p>}
      <ul className="divide-y divide-line">
        {res?.results.map((h) => (
          <li key={`${h.b}-${h.c}-${h.v}`} className="py-3">
            <button onClick={() => onOpen(h.b, h.c, h.v)} className="text-left"><b className="text-accent">{books[h.b - 1]?.name} {h.c}:{h.v}</b> <span className="font-serif">{mark(h.text)}</span></button>
          </li>
        ))}
      </ul>
      {res && res.results.length < res.total && <div className="my-4 text-center"><Button variant="secondary" loading={busy} onClick={() => run(strong ? { strong } : { q }, res.results.length)}>Show more</Button></div>}
    </div>
  );
}
