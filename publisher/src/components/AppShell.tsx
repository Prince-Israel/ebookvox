"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Bell, BookOpen, Coins, CreditCard, FileCheck2, Inbox, LayoutDashboard, LifeBuoy, LogOut, Menu, Receipt, Settings, ShieldCheck, TrendingUp, Upload, UserRound, Users, Wallet, X } from "lucide-react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { cx } from "./ui";
import { useUser } from "./UserContext";
import { api } from "@/lib/client";

type Item = { href: string; label: string; Icon: typeof Bell; sub?: Array<{ href: string; label: string }> };

const PUBLISHER_NAV: Item[] = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/books", label: "My Books", Icon: BookOpen, sub: [
    { href: "/books", label: "All Books" }, { href: "/books?tab=approved", label: "Approved" }, { href: "/books?tab=reviewing", label: "Under Review" },
    { href: "/books?tab=rejected", label: "Rejected" }, { href: "/books?tab=drafts", label: "Drafts" } ] },
  { href: "/books/new", label: "Upload Book", Icon: Upload },
  { href: "/sales", label: "Sales", Icon: TrendingUp },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/payouts", label: "Payouts", Icon: Coins },
  { href: "/payment-method", label: "Payment Method", Icon: CreditCard },
  { href: "/support", label: "Support", Icon: LifeBuoy },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/profile", label: "Profile", Icon: UserRound },
  { href: "/settings", label: "Settings", Icon: Settings },
];
const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Overview", Icon: ShieldCheck },
  { href: "/admin/review", label: "Book review", Icon: FileCheck2 },
  { href: "/admin/withdrawals", label: "Withdrawals", Icon: Receipt },
  { href: "/admin/support", label: "Support", Icon: Inbox },
  { href: "/admin/publishers", label: "Publishers", Icon: Users },
  { href: "/notifications", label: "Notifications", Icon: Bell },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const sp = useSearchParams();
  const { user, unread, supportUnread } = useUser();
  const items = user.role === "ADMIN" ? ADMIN_NAV : PUBLISHER_NAV;
  const tab = sp.get("tab");
  const link = "flex min-h-11 items-center gap-3 rounded-2xl px-4 text-[15px] font-medium transition";
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map(({ href, label, Icon, sub }) => {
        const exact = href === "/dashboard" || href === "/admin" || href === "/books/new";
        const active = exact ? path === href : path === href || path.startsWith(href + "/");
        const booksActive = href === "/books" && (path === "/books" || (path.startsWith("/books/") && path !== "/books/new"));
        const on = href === "/books" ? booksActive : active;
        return (
          <div key={href}>
            <Link href={href} onClick={onNavigate} aria-current={on && !sub ? "page" : undefined} className={cx(link, on ? "bg-accent-soft text-accent-fg" : "text-fg hover:bg-surface2")}>
              <Icon className="size-5 shrink-0" /> <span className="flex-1">{label}</span>
              {href === "/support" && supportUnread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg" aria-label={`${supportUnread} unread support messages`}>{supportUnread > 99 ? "99+" : supportUnread}</span>}
              {href === "/notifications" && unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
            </Link>
            {sub && booksActive && (
              <ul className="ml-7 mt-1 space-y-0.5 border-l border-line pl-3">
                {sub.map((s) => {
                  const t = new URL(s.href, "http://x").searchParams.get("tab");
                  const subOn = path === "/books" && (t ?? null) === (tab ?? null);
                  return <li key={s.href}><Link href={s.href} onClick={onNavigate} aria-current={subOn ? "page" : undefined} className={cx("flex min-h-10 items-center rounded-xl px-3 text-sm transition", subOn ? "font-semibold text-accent" : "text-muted hover:bg-surface2 hover:text-fg")}>{s.label}</Link></li>;
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, unread, refreshUnread } = useUser();
  const path = usePathname();
  useEffect(() => { void refreshUnread(); }, [path, refreshUnread]);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  async function signOut() { try { await api("/api/auth/signout", { method: "POST" }); } catch {} window.location.href = "/sign-in"; }

  const profileCard = (
    <div className="border-t border-line pt-4">
      <Link href={user.role === "ADMIN" ? "/settings" : "/profile"} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface2">
        <Avatar user={user} size={42} />
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.publisherName}</span><span className="block truncate text-xs text-muted">{user.role === "ADMIN" ? "Administrator" : user.email}</span></span>
      </Link>
      <button onClick={signOut} className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-medium text-danger hover:bg-danger-soft"><LogOut className="size-5" /> Sign out</button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r border-line bg-surface/70 p-5 lg:flex">
        <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"} className="px-2"><Logo size={38} /></Link>
        <div className="flex-1"><Suspense><Nav /></Suspense></div>
        {profileCard}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="safe-t sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="relative grid size-11 place-items-center rounded-full hover:bg-surface2"><Menu className="size-6" />{unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full bg-accent" />}</button>
          <Logo size={30} />
          <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative grid size-11 place-items-center rounded-full hover:bg-surface2"><Bell className="size-6" />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-accent-fg ring-2 ring-bg">{unread > 99 ? "99+" : unread}</span>}</Link>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="anim-in absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="safe-t safe-b absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] animate-[slide_.25s_ease] flex-col gap-5 overflow-y-auto bg-surface p-5 shadow-pop" style={{ animation: "fade-in .25s ease" }}>
            <div className="flex items-center justify-between"><Logo size={34} /><button onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-full hover:bg-surface2"><X className="size-5" /></button></div>
            <div className="flex-1"><Suspense><Nav onNavigate={() => setOpen(false)} /></Suspense></div>
            {profileCard}
          </div>
        </div>
      )}
    </div>
  );
}
