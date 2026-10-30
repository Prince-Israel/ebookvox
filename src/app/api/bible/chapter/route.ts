import { NextResponse } from "next/server";
import { BIBLE_VERSIONS, USFM, parseChapterHtml, type Verse } from "@/lib/bible";

export const dynamic = "force-dynamic";
const memo = new Map<string, { at: number; body: { verses: Verse[]; copyright: string; fumsToken: string } }>();
const TTL = 10 * 60_000;

// Licensed versions (NIV, AMP, MSG) are fetched from API.Bible on demand with the server-side key; the text is not stored.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const version = BIBLE_VERSIONS.find((v) => v.id === u.searchParams.get("version") && (v.apiId || v.yvId));
  const book = Number(u.searchParams.get("book"));
  const chapter = Number(u.searchParams.get("chapter"));
  if (!version || !USFM[book - 1] || !Number.isInteger(chapter) || chapter < 1 || chapter > 150) return NextResponse.json({ error: "Unknown version, book or chapter." }, { status: 400 });
  const key = version.yvId ? process.env.YOUVERSION_APP_KEY : process.env.BIBLE_API_KEY;
  if (!key) return NextResponse.json({ error: "This Bible version isn't switched on yet." }, { status: 503 });
  const id = `${version.id}.${book}.${chapter}`;
  const hit = memo.get(id);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);
  try {
    if (version.yvId) {
      const h = { "X-YVP-App-Key": key };
      const [r, m] = await Promise.all([
        fetch(`https://api.youversion.com/v1/bibles/${version.yvId}/passages/${USFM[book - 1]}.${chapter}?format=html`, { headers: h, signal: AbortSignal.timeout(10_000) }),
        fetch(`https://api.youversion.com/v1/bibles/${version.yvId}`, { headers: h, signal: AbortSignal.timeout(10_000) }),
      ]);
      if (r.status === 403) return NextResponse.json({ error: `${version.full} is waiting for its publisher's licence.` }, { status: 503 });
      if (!r.ok) return NextResponse.json({ error: "We couldn't load this chapter." }, { status: 502 });
      const j = await r.json();
      const meta = m.ok ? await m.json() : {};
      const body = { verses: parseChapterHtml(j.content ?? ""), copyright: String(meta.copyright || meta.promotional_content || ""), fumsToken: "" };
      if (!body.verses.length) return NextResponse.json({ error: "This chapter isn't available in this version." }, { status: 404 });
      if (memo.size > 300) memo.clear();
      memo.set(id, { at: Date.now(), body });
      return NextResponse.json(body);
    }
    const r = await fetch(`https://rest.api.bible/v1/bibles/${version.apiId}/chapters/${USFM[book - 1]}.${chapter}?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`, { headers: { "api-key": key }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return NextResponse.json({ error: "We couldn't load this chapter." }, { status: 502 });
    const j = await r.json();
    const body = { verses: parseChapterHtml(j.data?.content ?? ""), copyright: String(j.data?.copyright ?? ""), fumsToken: String(j.meta?.fumsToken ?? "") };
    if (!body.verses.length) return NextResponse.json({ error: "This chapter isn't available in this version." }, { status: 404 });
    if (memo.size > 300) memo.clear();
    memo.set(id, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "We couldn't load this chapter." }, { status: 502 });
  }
}
