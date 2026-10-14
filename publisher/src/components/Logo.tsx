import { logoMarkSvg } from "./logo-svg";

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <span role="img" aria-label="Ebookvox Publisher logo" className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: logoMarkSvg().replace('width="64" height="64"', 'width="100%" height="100%"') }} />;
}

export function Logo({ size = 36, tagline = false, className = "" }: { size?: number; tagline?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-serif font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>Ebook<span className="text-accent">vox</span></span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.28em] text-accent">{tagline ? "Publisher · Your Words. Our Voice." : "Publisher"}</span>
      </span>
    </span>
  );
}
