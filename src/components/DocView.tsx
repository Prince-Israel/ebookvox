"use client";
import { useEffect, useRef } from "react";
import { cx } from "./ui";
import type { Block, Chunk } from "@/lib/text";

/** Renders blocks with the one currently being spoken highlighted; tapping a block jumps playback there. */
export function DocView({ blocks, chunks, activeChunk, onPick, follow = true, className }: { blocks: Block[]; chunks: Chunk[]; activeChunk: number; onPick?: (block: number) => void; follow?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const activeBlock = chunks[activeChunk]?.block ?? -1;

  useEffect(() => {
    if (!follow || activeBlock < 0) return;
    const node = ref.current?.querySelector<HTMLElement>(`[data-block="${activeBlock}"]`);
    if (!node) return;
    const r = node.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 260) node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeBlock, follow]);

  return (
    <div ref={ref} className={cx("prose-book font-serif text-[1.08rem] leading-[1.85] sm:text-[1.15rem]", className)}>
      {blocks.map((b, i) => {
        const on = i === activeBlock;
        const common = {
          "data-block": i,
          onClick: onPick ? () => onPick(i) : undefined,
          className: cx("rounded-xl px-3 py-1 -mx-3 transition-colors", onPick && "cursor-pointer hover:bg-surface2/70", on && "bg-accent-soft"),
        };
        return b.kind === "heading" ? (
          <h3 key={i} {...common} className={cx(common.className, "mb-3 mt-6 text-2xl font-semibold")}>{b.text}</h3>
        ) : (
          <p key={i} {...common} className={cx(common.className, "whitespace-pre-wrap")}>{b.text}</p>
        );
      })}
    </div>
  );
}
