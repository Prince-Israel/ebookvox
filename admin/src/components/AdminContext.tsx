"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { PublicAdmin } from "@/lib/auth";
import type { Permission } from "@/lib/rbac";

type Ctx = { supportUnread: number; admin: PublicAdmin; can: (...p: Permission[]) => boolean; refresh: () => Promise<void>; unread: number; setUnread: (n: number) => void };
const C = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(C)!;

export const resolveTheme = (pref: string) => (pref === "dark" || (pref === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");

export function AdminProvider({ initial, initialUnread, children }: { initial: PublicAdmin; initialUnread: number; children: ReactNode }) {
  const [admin, setAdmin] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [supportUnread, setSupportUnread] = useState(0);
  const refresh = useCallback(async () => { const d = await api<{ admin: PublicAdmin; unread: number }>("/api/me"); setAdmin(d.admin); setUnread(d.unread); }, []);
  const can = useCallback((...p: Permission[]) => admin.role === "SUPER_ADMIN" || p.some((x) => admin.permissions.includes(x)), [admin]);
  useEffect(() => {
    const canSupport = initial.role === "SUPER_ADMIN" || initial.permissions.includes("support");
    const poll = async () => {
      try { setUnread((await api<{ unread: number }>("/api/notifications")).unread); } catch {}
      if (canSupport) try { setSupportUnread((await api<{ unread: number }>("/api/support/unread")).unread); } catch {}
    };
    void poll();
    const t = setInterval(poll, 15_000);
    const v = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [initial.role, initial.permissions]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(admin.theme);
    try { localStorage.setItem("eva-theme", admin.theme); } catch {}
  }, [admin.theme]);
  return <C.Provider value={{ admin, can, refresh, unread, setUnread, supportUnread }}>{children}</C.Provider>;
}
