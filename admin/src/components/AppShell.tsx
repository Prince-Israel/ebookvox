"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, BookCheck, BookOpen, Coins, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon, PenLine, Receipt, Search, Settings, ShoppingBag, Sun, TrendingUp, UserCog, UserRound, Users, X, Loader2, Library, Crown } from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { cx } from "./ui";
import { useAdmin, resolveTheme } from "./AdminContext";
import { api } from "@/lib/client";
import { roleLabel, type Permission } from "@/lib/rbac";

type Item = { href: string; label: string; Icon: typeof Bell; perm?: Permission[]; superOnly?: boolean };
const GROUPS: Array<{ title: string; items: Item[] }> = [
  { title: "Overview", items: [{ href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard }] },
  { title: "People", items: [
    { href: "/users", label: "Users", Icon: Users, perm: ["users"] }, { href: "/subscribers", label: "Subscribers", Icon: Crown, perm: ["users"] }, { href: "/publishers", label: "Publishers", Icon: UserRound, perm: ["publishers"] }, { href: "/authors", label: "Authors", Icon: PenLine, perm: ["authors"] } ] },
  { title: "Catalogue", items: [
    { href: "/books", label: "All Books", Icon: Library, perm: ["books"] }, { href: "/publisher-books", label: "Publisher Books", Icon: BookOpen, perm: ["books", "book_review"] }, { href: "/book-review", label: "Book Review", Icon: BookCheck, perm: ["book_review"] } ] },
  { title: "Finance", items: [
    { href: "/orders", label: "Orders", Icon: ShoppingBag, perm: ["orders", "transactions"] }, { href: "/transactions", label: "Transactions", Icon: Receipt, perm: ["transactions"] }, { href: "/sales", label: "Publisher Sales", Icon: TrendingUp, perm: ["sales"] }, { href: "/payouts", label: "Publisher Payouts", Icon: Coins, perm: ["payouts"] } ] },
  { title: "Operations", items: [
    { href: "/support", label: "Support", Icon: LifeBuoy, perm: ["support"] }, { href: "/activity", label: "Activity Log", Icon: Activity, perm: ["activity_logs"] }, { href: "/admins", label: "Admins", Icon: UserCog, superOnly: true }, { href: "/settings", label: "Settings", Icon: Settings } ] },
];

function ServiceDots() {
  const [s, setS] = useState<Array<{ label: string; ok: boolean; ms: number }> | null>(null);
  const load = () => api<{ services: Array<{ label: string; ok: boolean; ms: number }> }>("/api/status").then((d) => setS(d.services)).catch(() => setS([{ label: "Admin", ok: false, ms: 0 }]));
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);
  return (
    <button onClick={load} title="Refresh service status" className="flex w-full flex-wrap gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-left text-xs text-muted hover:bg-surface2" aria-label="Service status">
      {(s ?? [{ label: "Reader", ok: true, ms: 0 }, { label: "Publisher", ok: true, ms: 0 }]).map((x) => (
        <span key={x.label} className="inline-flex items-center gap-1.5"><span className={cx("size-2 rounded-full", s ? (x.ok ? "bg-success" : "bg-danger") : "bg-line")} />{x.label} {s ? (x.ok ? "online" : "down") : "…"}</span>
      ))}
    </button>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ results: Array<{ type: string; title: string; meta: string; link: string }>; unavailable: string[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    setBusy(true);
    const t = setTimeout(() => api<typeof res>(`/api/search?q=${encodeURIComponent(q.trim())}`).then(setRes).catch(() => setRes({ results: [], unavailable: ["Search"] })).finally(() => setBusy(false)), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { const c = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false); document.addEventListener("mousedown", c); return () => document.removeEventListener("mousedown", c); }, []);
  const go = (link: string) => { setOpen(false); setQ(""); router.push(link); };
  return (
    <div ref={box} className="relative min-w-0 flex-1 md:max-w-xl">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`); }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input id="global-search" type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search users, books, orders..." aria-label="Search users, books, orders" autoComplete="off" className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-10 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/25" />
        {busy && <Loader2 className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
      </form>
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-12 z-50 max-h-[70dvh] overflow-y-auto rounded-3xl border border-line bg-surface p-2 shadow-pop" role="listbox" aria-label="Search results">
          {res?.unavailable.length ? <p className="px-3 py-2 text-xs text-warn">Some results are unavailable: {res.unavailable.join(", ")} service not responding.</p> : null}
          {!res && <p className="px-3 py-3 text-sm text-muted">Searching…</p>}
          {res && res.results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No matches for “{q.trim()}”.</p>}
          {res?.results.slice(0, 12).map((r, i) => (
            <button key={i} role="option" aria-selected={false} onClick={() => go(r.link)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface2">
              <span className="w-24 shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-center text-[11px] font-semibold text-accent-fg">{r.type}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.title}</span><span className="block truncate text-xs text-muted">{r.meta}</span></span>
            </button>
          ))}
          {res && res.results.length > 0 && <button onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)} className="mt-1 w-full rounded-2xl px-3 py-2 text-center text-sm font-medium text-accent hover:bg-surface2">See all results</button>}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { admin, can, refresh, unread, supportUnread } = useAdmin();
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("eva-collapsed") === "1"); } catch {} }, []);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => { if (admin.mustChangePassword && path !== "/settings") router.replace("/settings"); }, [admin.mustChangePassword, path, router]);
  useEffect(() => { setDark(resolveTheme(admin.theme) === "dark"); }, [admin.theme]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    const k = (e: KeyboardEvent) => e.key === "Escape" && (setDrawer(false), setMenu(false));
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [drawer]);

  const toggleMenu = () => { if (window.matchMedia("(min-width: 1024px)").matches) { const v = !collapsed; setCollapsed(v); try { localStorage.setItem("eva-collapsed", v ? "1" : "0"); } catch {} } else setDrawer(true); };
  async function toggleTheme() { try { await api("/api/me", { method: "PATCH", json: { theme: dark ? "light" : "dark" } }); await refresh(); } catch {} }
  async function signOut() { try { await api("/api/auth/logout", { method: "POST" }); } catch {} window.location.href = "/login"; }

  const nav = (onNav?: () => void) => (
    <nav aria-label="Main" className="space-y-5">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => (i.superOnly ? admin.role === "SUPER_ADMIN" : !i.perm || can(...i.perm)));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="mb-1.5 px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{g.title}</p>
            {items.map(({ href, label, Icon }) => {
              const on = path === href || path.startsWith(href + "/");
              return <Link key={href} href={href} onClick={onNav} aria-current={on ? "page" : undefined} className={cx("flex min-h-11 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium transition", on ? "bg-accent-soft text-accent-fg" : "text-fg hover:bg-surface2")}><Icon className="size-5 shrink-0" /><span className="flex-1">{label}</span>{href === "/support" && supportUnread > 0 && <span aria-label={`${supportUnread} unread support messages`} className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg">{supportUnread > 99 ? "99+" : supportUnread}</span>}</Link>;
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className={cx("min-h-dvh", !collapsed && "lg:grid lg:grid-cols-[17rem_1fr]")}>
      <aside className={cx("sticky top-0 hidden h-dvh flex-col gap-4 overflow-y-auto border-r border-line bg-surface/70 p-4 lg:flex", collapsed && "lg:hidden")}>
        <Link href="/dashboard" className="px-2 pt-1"><Logo /></Link>
        <div className="flex-1">{nav()}</div>
        <ServiceDots />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="safe-t sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur sm:gap-3 sm:px-5">
          <button onClick={toggleMenu} aria-label="Toggle menu" aria-expanded={drawer} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2"><Menu className="size-6" /></button>
          <Link href="/dashboard" className={cx("shrink-0", !collapsed && "lg:hidden")}><Logo size={30} className="[&>span:last-child]:hidden sm:[&>span:last-child]:block" /></Link>
          <GlobalSearch />
          <button onClick={toggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
          <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface2">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-accent-fg ring-2 ring-bg">{unread > 99 ? "99+" : unread}</span>}
          </Link>
          <div className="relative shrink-0">
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Admin menu" className="flex items-center gap-3 rounded-full p-1 hover:bg-surface2 md:pr-3">
              <Avatar user={{ id: admin.id, firstName: admin.name.split(" ")[0] ?? "A", lastName: admin.name.split(" ")[1] ?? "", avatarUpdatedAt: admin.avatarUpdatedAt }} size={38} />
              <span className="hidden text-left md:block"><span className="block max-w-36 truncate text-sm font-semibold leading-tight">{admin.name}</span><span className="block text-xs leading-tight text-muted">{roleLabel(admin.role)}</span></span>
            </button>
            {menu && (<>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute right-0 top-14 z-50 w-64 rounded-3xl border border-line bg-surface p-2 shadow-pop">
                <div className="px-3 py-2"><p className="truncate font-semibold">{admin.name}</p><p className="truncate text-xs text-muted">{admin.email}</p><p className="mt-1 text-xs font-semibold text-accent">{roleLabel(admin.role)}</p></div>
                <Link role="menuitem" href="/settings" onClick={() => setMenu(false)} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium hover:bg-surface2"><Settings className="size-4" /> Profile & settings</Link>
                <button role="menuitem" onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium text-danger hover:bg-danger-soft"><LogOut className="size-4" /> Sign out</button>
              </div>
            </>)}
          </div>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-[88rem] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
        <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">© 2026 Ebookvox · Your Words. Our Voice.</footer>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="anim-in absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="safe-t safe-b anim-in absolute inset-y-0 left-0 flex w-[19rem] max-w-[86vw] flex-col gap-4 overflow-y-auto bg-surface p-4 shadow-pop">
            <div className="flex items-center justify-between"><Logo /><button onClick={() => setDrawer(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><X className="size-5" /></button></div>
            <div className="flex-1">{nav(() => setDrawer(false))}</div>
            <ServiceDots />
          </div>
        </div>
      )}
    </div>
  );
}
