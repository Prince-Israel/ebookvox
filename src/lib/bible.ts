// Bible versions. Only public-domain texts can ship with the app; the others need a publisher licence
// (see docs/BIBLE.md) and stay locked until their text is connected.
export type BibleVersion = { id: string; name: string; full: string; available: boolean };
export const BIBLE_VERSIONS: BibleVersion[] = [
  { id: "KJV", name: "KJV", full: "King James Version", available: true },
  { id: "NKJV", name: "NKJV", full: "New King James Version", available: false },
  { id: "NIV", name: "NIV", full: "New International Version", available: false },
  { id: "NLT", name: "NLT", full: "New Living Translation", available: false },
  { id: "AMP", name: "AMP", full: "Amplified Bible", available: false },
  { id: "AMPC", name: "AMPC", full: "Amplified Bible, Classic Edition", available: false },
  { id: "MSG", name: "MSG", full: "The Message", available: false },
  { id: "TPT", name: "TPT", full: "The Passion Translation", available: false },
  { id: "MIRROR", name: "Mirror", full: "The Mirror Bible", available: false },
];

// Segment: [text, strongs number or 0, flags] — flags: 1 = words of Jesus (red), 2 = added by translators (italic), 4 = divine name
export type Seg = [string, string | 0, number];
export type BibleBook = { n: number; name: string; abbr: string; ch: number; t: "OT" | "NT" };
export type XRef = [number, number, number, number, number]; // book, chapter, verse, endChapter, endVerse
export type StrongsEntry = [string, string, string, string, string, string]; // lemma, translit, pron, definition, kjv usage, derivation
