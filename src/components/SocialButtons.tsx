"use client";
import { isNativeApp } from "@/lib/public-config";
import { LegalLink } from "./LegalLink";

const Google = () => (
  <svg viewBox="0 0 48 48" className="size-7" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export function SocialButtons({ verb = "Continue", next }: { verb?: string; next?: string | null }) {
  const q = (mobile: boolean) => { const p = new URLSearchParams(); if (mobile) p.set("mobile", "1"); if (next && next.startsWith("/") && !next.startsWith("//")) p.set("next", next); const s = p.toString(); return s ? `?${s}` : ""; };
  // In the iOS/Android app, Google refuses to sign in inside an embedded web view, so open the phone's own browser instead
  // (it returns to the app through ebookvox://oauth — see NativeBridge).
  async function open(e: React.MouseEvent, provider: "google") {
    if (!isNativeApp()) return; // on the web the plain link does the job
    e.preventDefault();
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: `${window.location.origin}/api/auth/oauth/${provider}/start${q(true)}` });
    } catch { window.location.href = `/api/auth/oauth/${provider}/start${q(false)}`; }
  }
  const cls = "flex h-14 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 text-base font-semibold text-fg shadow-card transition hover:bg-surface2 active:scale-[0.98]";
  return (
    <div className="space-y-3">
      <a href={`/api/auth/oauth/google/start${q(false)}`} onClick={(e) => open(e, "google")} className={cls}><Google /> {verb} with Google</a>
      {verb === "Sign up" && <p className="px-2 text-center text-xs text-muted">By continuing with Google you agree to our <LegalLink href="/terms">Terms &amp; Conditions</LegalLink> and <LegalLink href="/privacy">Privacy Policy</LegalLink>.</p>}
      <div className="flex items-center gap-3 py-2 text-xs uppercase tracking-widest text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}

export const OAUTH_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet. Please use email and password.",
  apple_not_configured: "Apple sign-in isn't set up on this server yet. Please use email and password.",
  oauth_failed: "We couldn't complete that sign-in. Please try again or use email and password.",
  oauth_cancelled: "Sign-in was cancelled.",
  oauth_unknown: "That sign-in method isn't available.",
};
