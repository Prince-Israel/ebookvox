import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
type Row = { b: number; c: number; v: number; text: string; strongs: Set<string> };
let rows: Row[] | null = null;

function load(): Row[] {
  if (rows) return rows;
  const dir = path.join(process.cwd(), "public", "bible");
  const out: Row[] = [];
  for (let b = 1; b <= 66; b++) {
    const chapters = JSON.parse(readFileSync(path.join(dir, "kjv", `${b}.json`), "utf8")) as [string, string | 0, number][][][];
    chapters.forEach((vs, ci) => vs.forEach((segs, vi) => out.push({ b, c: ci + 1, v: vi + 1, text: segs.map((s) => s[0]).join(""), strongs: new Set(segs.map((s) => s[1]).filter(Boolean) as string[]) })));
  }
  return (rows = out);
}

// Concordance: ?q=word (every verse containing the word(s)) or ?strong=G26 (every verse using that original-language word).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const strong = (u.searchParams.get("strong") ?? "").trim().toUpperCase();
  const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
  if (!strong && q.length < 2) return NextResponse.json({ error: "Type at least 2 letters." }, { status: 400 });
  try {
    const words = q.split(/\s+/).filter(Boolean);
    const hits = load().filter((r) => {
      if (strong) return r.strongs.has(strong);
      const t = r.text.toLowerCase();
      return words.every((w) => new RegExp(`(^|[^a-z])${w.replace(/[^a-z0-9']/g, "")}`).test(t));
    });
    return NextResponse.json({ total: hits.length, results: hits.slice(offset, offset + 40).map(({ strongs, ...r }) => r) });
  } catch {
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
