"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** If the connection drops while the app is open, say so (and say when it's back) instead of leaving screens silently stuck. */
export function OfflineBanner() {
  const [off, setOff] = useState(false);
  useEffect(() => {
    setOff(!navigator.onLine);
    const down = () => setOff(true), up = () => setOff(false);
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => { window.removeEventListener("offline", down); window.removeEventListener("online", up); };
  }, []);
  if (!off) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[120] flex items-center justify-center gap-2 bg-[#3a261c] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-[#fbf1e4]">
      <WifiOff className="size-4 shrink-0" /> You&apos;re offline — connect to the internet to keep going.
    </div>
  );
}
