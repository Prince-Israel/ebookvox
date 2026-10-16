"use client";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/public-config";

/**
 * Finishes "Sign in with Google / Apple" inside the iOS and Android apps. Those providers refuse to run in an embedded web view, so the
 * sign-in happens in the phone's own browser; it ends by opening ebookvox://oauth?code=… which lands here. We swap the one-time code
 * for a session inside the app and carry on.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let off: (() => void) | undefined;
    (async () => {
      const [{ App }, { Browser }] = await Promise.all([import("@capacitor/app"), import("@capacitor/browser")]);
      const h = await App.addListener("appUrlOpen", async ({ url }) => {
        let u: URL;
        try { u = new URL(url); } catch { return; }
        if (u.protocol !== "ebookvox:" || u.hostname !== "oauth") return;
        const code = u.searchParams.get("code");
        const next = u.searchParams.get("next");
        try { await Browser.close(); } catch {}
        if (!code) return void (window.location.href = "/sign-in?error=oauth_failed");
        try {
          const r = await fetch("/api/auth/oauth/mobile/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
          window.location.href = r.ok ? (next && next.startsWith("/") && !next.startsWith("//") ? next : "/home") : "/sign-in?error=oauth_failed";
        } catch { window.location.href = "/sign-in?error=oauth_failed"; }
      });
      off = () => void h.remove();
    })().catch(() => {});
    return () => off?.();
  }, []);
  return null;
}
