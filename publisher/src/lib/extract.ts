import { normalizeText } from "./text";

export class ExtractError extends Error {}

export const MAX_UPLOAD = 15 * 1024 * 1024;
export const MAX_CHARS = 400_000;

export type Kind = "PDF" | "DOCX" | "TXT";

export function detectKind(name: string, buf: Buffer): Kind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const head = buf.subarray(0, 4);
  const isPdf = head.toString("latin1") === "%PDF";
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (ext === "pdf") {
    if (!isPdf) throw new ExtractError("This file has a .pdf name but isn't a valid PDF. Please check the file and try again.");
    return "PDF";
  }
  if (ext === "docx") {
    if (!isZip) throw new ExtractError("This file isn't a valid .docx document. (Older .doc files aren't supported — save as .docx first.)");
    return "DOCX";
  }
  if (ext === "txt") {
    if (isPdf || isZip || buf.subarray(0, 2048).includes(0)) throw new ExtractError("This doesn't look like a plain text file.");
    return "TXT";
  }
  throw new ExtractError("Unsupported file type. Please upload a PDF, DOCX or TXT file.");
}

function decodeText(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function fromTxt(buf: Buffer): string {
  const t = normalizeText(decodeText(buf));
  // Hard-wrapped text (single newlines inside paragraphs): unwrap lines but keep blank-line paragraphs.
  const lines = t.split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  const avgLen = nonEmpty.reduce((n, l) => n + l.length, 0) / (nonEmpty.length || 1);
  const looksWrapped = nonEmpty.length > 4 && avgLen > 40 && t.includes("\n\n");
  return looksWrapped ? t.replace(/([^\n])\n(?!\n)/g, "$1 ") : t;
}

async function fromDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ buffer: buf })).value;
  } catch {
    throw new ExtractError("We couldn't open this Word document. It may be corrupted or password-protected.");
  }
  const decode = (s: string) =>
    s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
  const out: string[] = [];
  const re = /<(h[1-6]|p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1];
    let inner = m[2];
    if (tag === "tr") inner = inner.replace(/<\/t[dh]>/g, " | ");
    const text = decode(inner.replace(/<br\s*\/?>/g, "\n")).replace(/\s*\|\s*$/, "");
    if (!text) continue;
    out.push(tag.startsWith("h") ? `# ${text}` : tag === "li" ? `• ${text}` : text);
  }
  // Consecutive list items should stay together as one block.
  return out.join("\n\n").replace(/(• [^\n]*)\n\n(?=• )/g, "$1\n");
}

type Item = { str: string; x: number; y: number; h: number; w: number };

async function fromPdf(buf: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf));
  } catch (e) {
    const msg = String((e as Error).message);
    if (/password/i.test(msg)) throw new ExtractError("This PDF is password-protected. Remove the password and try again.");
    throw new ExtractError("We couldn't open this PDF. It may be corrupted.");
  }
  const pages: Array<{ lines: Array<{ y: number; h: number; text: string }> }> = [];
  const sizes: number[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items as Array<{ str?: string; transform: number[]; width: number; height: number }>) {
      if (typeof it.str !== "string") continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || it.height, w: it.width });
    }
    // group into lines by y
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Array<{ y: number; h: number; parts: Item[] }> = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) < Math.max(2, it.h * 0.4)) last.parts.push(it);
      else lines.push({ y: it.y, h: it.h, parts: [it] });
    }
    pages.push({
      lines: lines
        .map((l) => {
          l.parts.sort((a, b) => a.x - b.x);
          let text = "";
          let prev: Item | undefined;
          for (const part of l.parts) {
            if (prev && part.x - (prev.x + prev.w) > part.h * 0.15 && !text.endsWith(" ") && !part.str.startsWith(" ")) text += " ";
            text += part.str;
            prev = part;
          }
          sizes.push(l.h);
          return { y: l.y, h: l.h, text: text.replace(/\s+/g, " ").trim() };
        })
        .filter((l) => l.text),
    });
  }
  const body = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)] || 12;
  const blocks: string[] = [];
  for (const page of pages) {
    let cur = "";
    let prev: { y: number; h: number } | undefined;
    const flush = () => {
      if (cur.trim()) blocks.push(cur.trim());
      cur = "";
    };
    for (const l of page.lines) {
      const isHeading = l.h > body * 1.25 && l.text.length < 120;
      const gap = prev ? prev.y - l.y : 0;
      if (isHeading) {
        flush();
        blocks.push(`# ${l.text}`);
        prev = undefined;
        continue;
      }
      if (prev && gap > body * 1.7) flush();
      if (cur && cur.endsWith("-") && /^[a-z]/.test(l.text)) cur = cur.slice(0, -1) + l.text;
      else cur += (cur ? " " : "") + l.text;
      prev = l;
    }
    flush();
  }
  return blocks.join("\n\n");
}

export async function extractText(name: string, buf: Buffer): Promise<{ kind: Kind; text: string }> {
  if (buf.length === 0) throw new ExtractError("This file is empty.");
  if (buf.length > MAX_UPLOAD) throw new ExtractError(`This file is too large. The limit is ${MAX_UPLOAD / 1024 / 1024} MB.`);
  const kind = detectKind(name, buf);
  const raw = kind === "PDF" ? await fromPdf(buf) : kind === "DOCX" ? await fromDocx(buf) : fromTxt(buf);
  const text = normalizeText(raw);
  if (!text.replace(/^# /gm, "").trim())
    throw new ExtractError(
      kind === "PDF"
        ? "We couldn't find any readable text in this PDF. It may be a scanned image — try a PDF with selectable text."
        : "We couldn't find any text in this file.",
    );
  if (text.length > MAX_CHARS) throw new ExtractError("This document is very long. Please upload a document under 400,000 characters.");
  return { kind, text };
}
