"use client";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cx } from "./ui";

export type Col<T> = { key: string; header: string; cell: (r: T) => ReactNode; primary?: boolean; hideCard?: boolean; className?: string };

/** Data table on desktop/tablet; stacked cards on phones. */
export function DataTable<T>({ rows, cols, rowKey, actions, onRow }: { rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; actions?: (r: T) => ReactNode; onRow?: (r: T) => void }) {
  const primary = cols.find((c) => c.primary) ?? cols[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-3xl border border-line bg-surface shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface2 text-xs uppercase tracking-wider text-muted"><tr>{cols.map((c) => <th key={c.key} className={cx("whitespace-nowrap px-4 py-3 font-semibold", c.className)}>{c.header}</th>)}{actions && <th className="px-4 py-3 text-right font-semibold">Actions</th>}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={cx("align-middle", onRow && "cursor-pointer hover:bg-surface2/60")}>
                {cols.map((c) => <td key={c.key} className={cx("px-4 py-3", c.className)}>{c.cell(r)}</td>)}
                {actions && <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}><div className="inline-flex flex-wrap justify-end gap-1.5">{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-3xl border border-line bg-surface p-4 shadow-card">
            <div className="font-semibold">{primary.cell(r)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {cols.filter((c) => c !== primary && !c.hideCard).map((c) => <div key={c.key} className="min-w-0"><dt className="text-xs text-muted">{c.header}</dt><dd className="break-words">{c.cell(r)}</dd></div>)}
            </dl>
            {actions && <div className="mt-3 flex flex-wrap gap-2">{actions(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return <p className="mt-3 text-sm text-muted">{total} {total === 1 ? "result" : "results"}</p>;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
        <span className="tabular-nums">Page {page} / {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-center gap-2">{children}</div>;
}
export const filterInput = "h-11 min-w-0 rounded-full border border-line bg-surface px-4 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25";
