// Turns a Project Gutenberg plain-text file into readable chapters.
const HEADING = /^(CHAPTER|Chapter|STAVE|PART|Part|BOOK|ADVENTURE)\s+[\w.\-—]+.*$|^[IVXLC]+\.?(\s+[A-Z][A-Za-z'’,\-—: ]*)?$/;

export function toChapters(raw: string, fallbackTitle: string) {
  let t = raw.replace(/\r\n?/g, "\n");
  const s = t.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/);
  if (s >= 0) t = t.slice(t.indexOf("\n", s) + 1);
  const e = t.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/);
  if (e >= 0) t = t.slice(0, e);
  const lines = t.split("\n");
  const marks: Array<{ i: number; end: number; title: string }> = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const l = lines[i].trim();
    if (!l || l.length > 90 || lines[i - 1].trim() || !HEADING.test(l)) continue;
    // Optional subtitle on the next line ("CHAPTER I." / "Down the Rabbit-Hole")
    let title = l;
    let end = i + 1;
    const next = lines[i + 1].trim();
    const after = lines[i + 2]?.trim();
    const isSub = (x?: string) => !!x && x.length < 60 && !/[.,;:!?”"]$/.test(x) && x.split(/\s+/).length <= 8;
    if (!next && isSub(after)) {
      title = `${l.replace(/\.$/, "")}. ${after}`;
      end = i + 3;
    }
    marks.push({ i, end, title: title.replace(/\s+/g, " ").replace(/[.\]]+$/, "") });
  }
  const para = (block: string[]) =>
    block.join("\n").split(/\n\s*\n/).map((p) => p.replace(/\[Illustration[^\]]*\]/gi, "").replace(/_/g, "").replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).join("\n\n");
  let chapters = marks
    .map((m, k) => ({ title: /^[IVXLC]+$/.test(m.title) ? `Chapter ${m.title}` : m.title, content: para(lines.slice(m.end, marks[k + 1]?.i ?? lines.length)) }))
    .filter((c) => c.content.length > 1200 && (c.content.match(/\bCHAPTER\b/g) ?? []).length < 3);
  if (chapters.length < 3) {
    const all = para(lines).split("\n\n");
    chapters = [];
    let cur: string[] = [];
    let len = 0;
    for (const p of all) {
      cur.push(p);
      len += p.length;
      if (len > 14000) { chapters.push({ title: `Part ${chapters.length + 1}`, content: cur.join("\n\n") }); cur = []; len = 0; }
    }
    if (cur.length) chapters.push({ title: `Part ${chapters.length + 1}`, content: cur.join("\n\n") });
  }
  return chapters.length ? chapters : [{ title: fallbackTitle, content: para(lines) }];
}
