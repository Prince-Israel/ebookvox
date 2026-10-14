"use client";
import { Cover } from "./Cover";
import { Confirm } from "./Confirm";
import type { useDeleteBook } from "./BookEdit";

export const BookThumb = ({ b }: { b: { title: string; author: string; coverUrl: string | null; coverHue?: number } }) => <div className="w-12"><Cover title={b.title} author={b.author} hue={b.coverHue ?? 25} url={b.coverUrl} /></div>;

export function DeleteBookDialog({ d }: { d: ReturnType<typeof useDeleteBook> }) {
  return (<>
    <Confirm open={!!d.target && !d.blocked} danger title="Delete this book?" confirmLabel="Delete book" onClose={() => d.setTarget(null)} onConfirm={() => d.del(false)}
      body={<>“{d.target?.title}” will be removed from the catalogue together with its chapters, prices, readers' library entries and unpaid orders. Publisher records are updated too. This can't be undone.</>} />
    <Confirm open={!!d.blocked} title="This book has been bought" confirmLabel="Archive instead" onClose={() => { d.setBlocked(null); d.setTarget(null); }} onConfirm={() => d.del(true)} body={d.blocked} />
  </>);
}
