"use client";
import { useEffect, useState } from "react";
import { isNativeApp, usePublicConfig } from "@/lib/public-config";

/** Shows exactly which build you are running (web release time, and the installed app's version when inside the iOS/Android app). */
export function AppVersion() {
  const [native, setNative] = useState<string | null>(null);
  const cfg = usePublicConfig();
  useEffect(() => {
    if (!isNativeApp()) return;
    import("@capacitor/app").then(({ App }) => App.getInfo()).then((i) => setNative(`${i.version} (build ${i.build})`)).catch(() => {});
  }, []);
  return (
    <p className="mt-8 text-center text-xs text-muted">
      Ebookvox {native ? `app ${native} · ` : ""}site build {cfg?.build ?? "…"}
    </p>
  );
}
