"use client";
import { useState } from "react";

export function Cover({ title, author, hue, url, className = "" }: { title: string; author: string; hue: number; url?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken)
    return (
       
      <img src={url} alt={`Cover of ${title}`} onError={() => setBroken(true)} loading="lazy" className={`aspect-[2/3] w-full rounded-xl object-cover shadow-pop ${className}`} />
    );
  const a = `hsl(${hue} 42% 34%)`;
  const b = `hsl(${(hue + 28) % 360} 52% 18%)`;
  const gold = `hsl(${(hue + 20) % 360} 70% 78%)`;
  return (
    <div
      role="img"
      aria-label={`Cover of ${title} by ${author}`}
      className={`relative flex aspect-[2/3] w-full select-none [container-type:inline-size] flex-col justify-between overflow-hidden rounded-xl p-[9%] text-center shadow-pop ${className}`}
      style={{ background: `linear-gradient(155deg, ${a}, ${b})` }}
    >
      <div className="absolute inset-y-0 left-0 w-[6%] bg-black/25" />
      <div className="absolute inset-[5%] rounded-lg border" style={{ borderColor: `${gold}55` }} />
      <div className="relative mx-auto mt-[6%] h-px w-1/3" style={{ background: gold }} />
      <div className="relative px-[4%]">
        <p className="font-serif font-semibold leading-tight" style={{ color: "#fff7ec", fontSize: "clamp(0.8rem, 5.2cqw, 1.5rem)" }}>
          {title}
        </p>
      </div>
      <div className="relative mb-[4%]">
        <div className="mx-auto mb-[6%] h-px w-1/4" style={{ background: gold }} />
        <p className="text-[0.62rem] uppercase tracking-[0.18em]" style={{ color: gold }}>
          {author}
        </p>
      </div>
    </div>
  );
}
