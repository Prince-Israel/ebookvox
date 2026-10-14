"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/auth";

type Ctx = { supportUnread: number; user: PublicUser; refresh: () => Promise<void>; unread: number; setUnread: (n: number) => void; refreshUnread: () => Promise<void> };
const C = createContext<Ctx | null>(null);
export const useUser = () => useContext(C)!;

export function resolveTheme(pref: string) {
  return pref === "dark" || (pref === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}

export function UserProvider({ initial, initialUnread, children }: { initial: PublicUser; initialUnread: number; children: ReactNode }) {
  const [user, setUser] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [supportUnread, setSupportUnread] = useState(0);
  const refresh = useCallback(async () => setUser((await api<{ user: PublicUser }>("/api/me")).user), []);
  const refreshUnread = useCallback(async () => {
    try { setUnread((await api<{ unread: number }>("/api/notifications")).unread); setSupportUnread((await api<{ unread: number }>("/api/tickets/unread")).unread); } catch {}
  }, []);
  useEffect(() => {
    const t = setInterval(refreshUnread, 30_000);
    const v = () => document.visibilityState === "visible" && refreshUnread();
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [refreshUnread]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(user.theme);
    try { localStorage.setItem("evp-theme", user.theme); } catch {}
  }, [user.theme]);
  return <C.Provider value={{ user, refresh, unread, setUnread, refreshUnread, supportUnread }}>{children}</C.Provider>;
}
