"use client";
// "Add to Home Screen" support. Android and desktop Chrome/Edge let a page open the install dialog itself (beforeinstallprompt).
// iPhone and iPad never do: the person has to use Safari's Share menu, so we show them exactly where to tap.

type PromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: PromptEvent | null = null;

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as PromptEvent; });
  window.addEventListener("appinstalled", () => { deferred = null; });
  if ("serviceWorker" in navigator && window.isSecureContext && process.env.NODE_ENV === "production") {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }
}

export type Platform = { ios: boolean; android: boolean; iosChrome: boolean; standalone: boolean; canShare: boolean };
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return { ios, android: /Android/i.test(ua), iosChrome: ios && /CriOS|EdgiOS|FxiOS/.test(ua), standalone, canShare: typeof navigator.share === "function" };
}

/** Opens the browser's own install dialog when it is available. Returns what happened. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = deferred;
  if (!ev) return "unavailable";
  deferred = null; // a prompt can only be used once
  try {
    await ev.prompt();
    return (await ev.userChoice).outcome;
  } catch { return "unavailable"; }
}
