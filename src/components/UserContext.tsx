"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/auth";

type Ctx = { supportUnread: number; user: PublicUser | null; refresh: () => Promise<void>; unread: number; setUnread: (n: number) => void; refreshUnread: () => Promise<void> };
const C = createContext<Ctx | null>(null);
/** For pages that only render for signed-in users (the shell redirects visitors before they mount). */
export const useUser = () => { const c = useContext(C)!; return { ...c, user: c.user as PublicUser }; };
/** For pages open to visitors too: `user` is null when nobody is signed in. */
export const useAuth = () => useContext(C)!;

export function UserProvider({ initial, initialUnread, children }: { initial: PublicUser | null; initialUnread: number; children: ReactNode }) {
  const [user, setUser] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [supportUnread, setSupportUnread] = useState(0);
  const refresh = useCallback(async () => {
    if (!user) return;
    const d = await api<{ user: PublicUser }>("/api/me");
    setUser(d.user);
  }, []);
  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const d = await api<{ unread: number }>("/api/notifications");
      setUnread(d.unread);
      setSupportUnread((await api<{ unread: number }>("/api/tickets/unread")).unread);
    } catch {}
  }, []);
  useEffect(() => {
    const t = setInterval(refreshUnread, 30_000);
    const v = () => document.visibilityState === "visible" && refreshUnread();
    document.addEventListener("visibilitychange", v);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", v);
    };
  }, [refreshUnread]);
  useEffect(() => {
    if (!user) return;
    document.documentElement.dataset.theme = resolveTheme(user.theme);
    try { localStorage.setItem("ev-theme", user.theme); } catch {}
  }, [user]);
  return <C.Provider value={{ user, refresh, unread, setUnread, refreshUnread, supportUnread }}>{children}</C.Provider>;
}

export function resolveTheme(pref: string) {
  return pref === "dark" || (pref === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
