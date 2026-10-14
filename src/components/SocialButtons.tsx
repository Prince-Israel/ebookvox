"use client";

const Google = () => (
  <svg viewBox="0 0 48 48" className="size-7" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
const Apple = () => (
  <svg viewBox="0 0 384 512" className="size-7 fill-current" aria-hidden>
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export function SocialButtons({ verb = "Continue" }: { verb?: string }) {
  const cls = "flex h-14 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 text-base font-semibold text-fg shadow-card transition hover:bg-surface2 active:scale-[0.98]";
  return (
    <div className="space-y-3">
      <a href="/api/auth/oauth/google/start" className={cls}><Google /> {verb} with Google</a>
      <a href="/api/auth/oauth/apple/start" className={cls}><Apple /> {verb} with Apple</a>
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
