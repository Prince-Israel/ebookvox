// Shared (client + server) helpers for turning raw text into paragraphs and
// speakable chunks. Documents are stored as plain text where blocks are
// separated by blank lines and headings are prefixed with "# ".

export type Block = { kind: "heading" | "para"; text: string };

export function normalizeText(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseBlocks(text: string): Block[] {
  return normalizeText(text)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => (b.startsWith("# ") ? { kind: "heading" as const, text: b.slice(2).trim() } : { kind: "para" as const, text: b }));
}

export const MAX_CHUNK = 900;

/** Split one block into sentence-sized pieces no longer than MAX_CHUNK. */
export function chunkBlock(text: string): string[] {
  const flat = text.replace(/\s*\n\s*/g, " ").trim();
  if (flat.length <= MAX_CHUNK) return flat ? [flat] : [];
  const sentences = flat.match(/[^.!?…]+[.!?…]+["”’')\]]*\s*|[^.!?…]+$/g) ?? [flat];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > MAX_CHUNK && cur) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > MAX_CHUNK) {
      for (let i = 0; i < s.length; i += MAX_CHUNK) out.push(s.slice(i, i + MAX_CHUNK).trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export type Chunk = { text: string; block: number };

export function toChunks(blocks: Block[]): Chunk[] {
  const chunks: Chunk[] = [];
  blocks.forEach((b, i) => chunkBlock(b.text).forEach((t) => chunks.push({ text: t, block: i })));
  return chunks;
}

export const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
