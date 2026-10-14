"use client";
import { useId, useRef, useState } from "react";

type Pt = { label: string; value: number };

const niceMax = (m: number) => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

/** Single-series line/area over time with a hover crosshair + tooltip. Colour comes from theme tokens (works in light and dark). */
export function LineChart({ data, format, title }: { data: Pt[]; format: (v: number) => string; title: string }) {
  const W = 640, H = 220, L = 8, R = 8, T = 12, B = 26;
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => L + (data.length <= 1 ? (W - L - R) / 2 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${H - B} L${x(0)},${H - B} Z` : "";
  const empty = data.every((d) => d.value === 0);
  const ticks = [0, 0.5, 1].map((f) => f * max).filter((t, i, a) => a.findIndex((u) => format(u) === format(t)) === i);
  const labelIdx = data.length <= 1 ? [0] : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  function move(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  }
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-pan-y select-none" role="img" aria-label={`${title}. ${empty ? "No data in this period." : `Peak ${format(Math.max(...data.map((d) => d.value)))}.`}`} onPointerMove={move} onPointerLeave={() => setHover(null)} onPointerDown={move}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} /><text x={L + 2} y={y(t) - 4} fontSize="11" fill="var(--muted)">{format(t)}</text></g>))}
        {!empty && <path d={area} fill={`url(#${id})`} />}
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {labelIdx.map((i) => data[i] && <text key={i} x={x(i)} y={H - 7} fontSize="11" fill="var(--muted)" textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>{data[i].label}</text>)}
        {h && hover !== null && (<g><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeWidth="1" /><circle cx={x(hover)} cy={y(h.value)} r="5" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" /></g>)}
      </svg>
      {empty && <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted">No activity in this period yet</p>}
      {h && hover !== null && <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs shadow-pop" style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}><div className="text-muted">{h.label}</div><div className="text-sm font-semibold">{format(h.value)}</div></div>}
    </div>
  );
}

/** Horizontal bars, one hue, ranked. Values printed at the bar end. */
export function BarList({ items, format }: { items: Array<{ label: string; value: number }>; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-medium">{i.label}</span><span className="shrink-0 tabular-nums text-muted">{format(i.value)}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-r-full bg-primary" style={{ width: `${Math.max(3, (i.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
