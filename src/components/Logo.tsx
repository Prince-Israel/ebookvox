import { useId } from "react";
import { logoMarkSvg } from "./logo-svg";

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <span
      role="img"
      aria-label="Ebookvox logo"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: logoMarkSvg(uid).replace('width="64" height="64"', 'width="100%" height="100%"') }}
    />
  );
}

export function Logo({ size = 36, tagline = false, className = "" }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-serif text-[1.35em] font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>
          Ebook<span className="text-accent">vox</span>
        </span>
        {tagline && <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-muted">Your Words. Our Voice.</span>}
      </span>
    </span>
  );
}
