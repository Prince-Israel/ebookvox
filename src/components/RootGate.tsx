"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Welcome } from "./Welcome";
import { LogoMark } from "./Logo";

/** The splash + onboarding belong to the native mobile apps. On the web, visitors go straight to the home page. */
export function RootGate() {
  const router = useRouter();
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => {
    const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
    setNative(isNative);
    if (!isNative) router.replace("/home");
  }, [router]);
  if (native) return <Welcome />;
  return <main className="grid min-h-dvh place-items-center"><LogoMark size={64} className="animate-pulse" /></main>;
}
