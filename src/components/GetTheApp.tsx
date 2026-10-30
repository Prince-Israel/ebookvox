"use client";
import { useState } from "react";
import { Smartphone } from "lucide-react";
import { InstallSheet } from "./InstallApp";
import { promptInstall } from "@/lib/install";
import { cx } from "./ui";
import { useIsNative, usePublicConfig } from "@/lib/public-config";

const PlayLogo = () => (
  <svg viewBox="0 0 512 512" className="size-7 shrink-0" aria-hidden>
    <path fill="#00d2ff" d="M48 28c-8 8-12 20-12 36v384c0 16 4 28 12 36l216-228z" />
    <path fill="#ffce00" d="m352 164-88 92 88 92 100-57c20-12 20-30 0-42z" />
    <path fill="#ff3a44" d="M264 256 48 484c8 8 22 8 40-2l264-134z" />
    <path fill="#00f076" d="M352 164 88 30C70 20 56 20 48 28l216 228z" />
  </svg>
);
const AppleLogo = () => (
  <svg viewBox="0 0 384 512" className="size-7 shrink-0 fill-current" aria-hidden>
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

function Badge({ href, onClick, logo, small, big, label }: { href: string | null; onClick?: () => void; logo: React.ReactNode; small: string; big: string; label: string }) {
  const body = (
    <>
      {logo}
      <span className="min-w-0 text-left leading-none">
        <span className="block text-[10px] font-medium uppercase tracking-wide opacity-90">{href || onClick ? small : "Coming soon on"}</span>
        <span className="mt-1 block truncate text-lg font-semibold">{big}</span>
      </span>
    </>
  );
  const cls = "inline-flex h-14 min-w-[10.5rem] items-center gap-2.5 rounded-xl border border-white/25 bg-black px-4 text-white shadow-card transition";
  if (!href && onClick)
    return <button type="button" onClick={onClick} aria-label={label} className={cx(cls, "hover:bg-neutral-800 active:scale-[0.98]")}>{body}</button>;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={cx(cls, "hover:bg-neutral-800 active:scale-[0.98]")}>{body}</a>
  ) : (
    <span role="img" aria-label={`${big} — coming soon`} className={cx(cls, "cursor-default opacity-60")}>{body}</span>
  );
}

/** "Get the app" Google Play + App Store badges. Hidden inside the mobile apps themselves. */
export function StoreBadges({ className, heading, headingClassName }: { className?: string; heading?: string; headingClassName?: string }) {
  const c = usePublicConfig();
  const native = useIsNative();
  const [sheet, setSheet] = useState(false);
  if (native) return null;
  // Until there is an App Store listing, the App Store badge installs the website as an app: Android/Chrome opens the install dialog
  // straight away, and on iPhone it shows the Add to Home Screen steps.
  async function addToHome() {
    const r = await promptInstall();
    if (r === "unavailable") setSheet(true);
  }
  return (
    <div className={className}>
      {heading && <p className={cx("mb-2 text-xs uppercase tracking-widest", headingClassName)}>{heading}</p>}
      <div className="flex flex-wrap gap-3 [justify-content:inherit]">
      <Badge href={c?.playStoreUrl ?? c?.apkUrl ?? null} logo={<PlayLogo />} small={c?.playStoreUrl ? "Get it on" : "Download for"} big={c?.playStoreUrl ? "Google Play" : "Android (APK)"} label={c?.playStoreUrl ? "Get Ebookvox on Google Play" : "Download the Ebookvox Android app"} />
      <Badge href={c?.appStoreUrl ?? null} onClick={addToHome} logo={<AppleLogo />} small="Download on the" big="App Store" label={c?.appStoreUrl ? "Download Ebookvox on the App Store" : "Add Ebookvox to your iPhone Home Screen"} />
      </div>
      <InstallSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

export function GetTheApp() {
  const native = useIsNative();
  if (native) return null;
  return (
    <section aria-labelledby="getapp" className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-fg"><Smartphone className="size-6" /></div>
          <div className="min-w-0">
            <h2 id="getapp" className="text-xl font-semibold">Take Ebookvox with you</h2>
            <p className="mt-1 text-sm text-muted">Listen on the go — your library, progress and voices follow you. Keeps reading with the screen off.</p>
          </div>
        </div>
        <StoreBadges className="lg:shrink-0" />
      </div>
    </section>
  );
}
