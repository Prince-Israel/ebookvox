import Link from "next/link";
import type { ReactNode } from "react";
import type { Block } from "@/lib/blog";

/** Turns [label](/path) into links and **word** into bold. */
export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[3]) out.push(<strong key={i++} className="text-fg">{m[3]}</strong>);
    else {
      const cls = "font-medium text-accent underline underline-offset-2 hover:no-underline";
      out.push(m[2].startsWith("http") ? <a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer" className={cls}>{m[1]}</a> : <Link key={i++} href={m[2]} className={cls}>{m[1]}</Link>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-lg leading-relaxed text-muted">
      {blocks.map((b, i) => {
        if ("h" in b) return <h2 key={i} className="!mt-10 font-serif text-3xl font-semibold text-fg">{b.h}</h2>;
        if ("p" in b) return <p key={i}>{inline(b.p)}</p>;
        if ("ul" in b) return <ul key={i} className="list-disc space-y-2 pl-6 marker:text-accent">{b.ul.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>;
        if ("ol" in b) return <ol key={i} className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-accent">{b.ol.map((x, j) => <li key={j}>{inline(x)}</li>)}</ol>;
        return <p key={i} className="rounded-2xl bg-accent-soft p-4 text-base text-accent-fg">{inline(b.note)}</p>;
      })}
    </div>
  );
}
