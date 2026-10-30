// Bible versions. Only public-domain texts can ship with the app; the others need a publisher licence
// (see docs/BIBLE.md) and stay locked until their text is connected.
export type BibleVersion = { id: string; name: string; full: string; available: boolean; apiId?: string; red?: boolean };
export const BIBLE_VERSIONS: BibleVersion[] = [
  { id: "KJV", name: "KJV", full: "King James Version", available: true, red: true },
  { id: "NKJV", name: "NKJV", full: "New King James Version", available: false },
  { id: "NIV", name: "NIV", full: "New International Version", available: true, apiId: "78a9f6124f344018-01", red: true },
  { id: "NLT", name: "NLT", full: "New Living Translation", available: false },
  { id: "AMP", name: "AMP", full: "Amplified Bible", available: true, apiId: "a81b73293d3080c9-01", red: true },
  { id: "AMPC", name: "AMPC", full: "Amplified Bible, Classic Edition", available: false },
  { id: "MSG", name: "MSG", full: "The Message", available: true, apiId: "6f11a7de016f942e-01", red: false },
  { id: "TPT", name: "TPT", full: "The Passion Translation", available: false },
  { id: "MIRROR", name: "Mirror", full: "The Mirror Bible", available: false },
];

// Segment: [text, strongs number or 0, flags] — flags: 1 = words of Jesus (red), 2 = added by translators (italic), 4 = divine name
export type Seg = [string, string | 0, number];
export type BibleBook = { n: number; name: string; abbr: string; ch: number; t: "OT" | "NT" };
export type XRef = [number, number, number, number, number]; // book, chapter, verse, endChapter, endVerse
export type StrongsEntry = [string, string, string, string, string, string]; // lemma, translit, pron, definition, kjv usage, derivation

export type Verse = { v: number; label: string; segs: Seg[] };
export const USFM = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");

// Turns an API.Bible chapter (HTML) into verses of segments: words of Jesus (class "wj") get flag 1, italics 2, divine name 4.
export function parseChapterHtml(html: string): Verse[] {
  const decode = (t: string) => t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const SKIP = /^(s\d?|r|d|cl|ms\d?|mr|sp|qa|h|sr|rq|mt\d?|cp|cd)$/;
  const verses: Verse[] = [];
  const stack: string[] = [];
  let skipP = false;
  let inNum = false;
  const cur = () => verses[verses.length - 1];
  const add = (text: string) => {
    if (!cur() || skipP || inNum || !text) return;
    const f = (stack.includes("wj") ? 1 : 0) | (stack.includes("it") ? 2 : 0) | (stack.includes("nd") ? 4 : 0);
    const segs = cur().segs;
    const last = segs[segs.length - 1];
    if (last && last[2] === f) last[0] += text; else segs.push([text, 0, f]);
  };
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    const [, close, tag, attrs, text] = m;
    if (text !== undefined) { add(decode(text)); continue; }
    const cls = /class="([^"]*)"/.exec(attrs)?.[1] ?? "";
    if (tag === "p") {
      if (close) { skipP = false; if (cur() && !skipP) add(" "); }
      else skipP = SKIP.test(cls);
    } else if (tag === "span") {
      if (close) { if (stack.pop() === "v") inNum = false; }
      else if (cls.split(" ").includes("v")) {
        const sid = /data-sid="[^"]*?(\d+)(?:-\d+)?"/.exec(attrs);
        const label = /data-number="([^"]*)"/.exec(attrs)?.[1] ?? "";
        if (!skipP) verses.push({ v: Number(sid?.[1] ?? label.split("-")[0]) || verses.length + 1, label, segs: [] });
        stack.push("v"); inNum = true;
      } else stack.push(cls.split(" ").find((c) => c === "wj" || c === "nd" || c === "it" || c === "add") === "add" ? "it" : cls.split(" ").find((c) => c === "wj" || c === "nd" || c === "it") ?? "");
    }
  }
  for (const v of verses) {
    v.segs = v.segs.map((s): Seg => [s[0].replace(/\s+/g, " "), 0, s[2]]).filter((s) => s[0] !== "");
    if (v.segs.length) v.segs[0][0] = v.segs[0][0].trimStart();
    const l = v.segs[v.segs.length - 1]; if (l) l[0] = l[0].trimEnd();
    v.segs = v.segs.filter((s) => s[0] !== "");
  }
  return verses.filter((v) => v.segs.length);
}
