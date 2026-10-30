"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, BookMarked, BookOpen, Crown, Home, Library, LifeBuoy, Receipt, Settings, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { Logo } from "./Logo";
import { LegalFooter } from "./LegalFooter";
import { Avatar } from "./Avatar";
import { Banner, Button, cx, useToast } from "./ui";
import { useAuth } from "./UserContext";
import { TopAdBand } from "./NativeBanners";
import { useIsNative } from "@/lib/public-config";
import { api, ApiFailure } from "@/lib/client";

const MAIN = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/books", label: "Books", Icon: BookOpen },
  { href: "/bible", label: "Bible", Icon: BookMarked },
  { href: "/library", label: "Library", Icon: Library },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

const MORE = [
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/orders", label: "Orders", Icon: Receipt },
  { href: "/support", label: "Support", Icon: LifeBuoy },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, unread, supportUnread, refreshUnread } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const guest = !user;
  const isPublic = path === "/home" || path === "/books" || path === "/bible" || path === "/subscribe" || /^\/books\/[^/]+$/.test(path);
  const active = (h: string) => path === h || path.startsWith(h + "/");
  const reading = path.startsWith("/read/");
  const native = useIsNative();
  const adTop = native && !user?.adFree && path === "/home"; // the header banner's band sits above the header, which then needs no status-bar padding of its own

  // Visitors may browse Home and Books; every other screen sends them to sign in and brings them back afterwards.
  useEffect(() => {
    if (guest && !isPublic) router.replace(`/sign-in?next=${encodeURIComponent(path)}`);
  }, [guest, isPublic, path, router]);
  useEffect(() => {
    void refreshUnread();
  }, [path, refreshUnread]);

  async function resend() {
    setSending(true);
    try {
      await api("/api/auth/resend", { method: "POST" });
      toast("Verification email sent. Check your inbox.");
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
    setSending(false);
  }

  if (guest && !isPublic) return <main className="grid min-h-dvh place-items-center text-muted">Taking you to sign in…</main>;

  const badge = (n: number, label: string) =>
    n > 0 ? <span aria-label={`${n} ${label}`} className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-accent-fg">{n > 99 ? "99+" : n}</span> : null;

  const bell = user ? (
    <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className={cx("relative grid size-11 place-items-center rounded-full hover:bg-surface2", active("/notifications") && "bg-accent-soft")}>
      <Bell className="size-6" />
      {unread > 0 && <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-accent-fg ring-2 ring-bg">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  ) : (
    <div className="flex items-center gap-2">
      <Link href={`/sign-in?next=${encodeURIComponent(path)}`}><Button size="sm" variant="secondary">Sign In</Button></Link>
      <Link href={`/sign-up?next=${encodeURIComponent(path)}`} className="hidden sm:block"><Button size="sm">Create Account</Button></Link>
    </div>
  );

  return (
    <div className="min-h-dvh min-[740px]:grid min-[740px]:grid-cols-[15rem_1fr] lg:grid-cols-[17rem_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-surface/70 p-4 min-[740px]:flex lg:p-5">
        <Link href="/home" className="mb-8 px-2"><Logo size={38} tagline /></Link>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {[...MAIN, ...(guest ? [] : MORE)].map(({ href, label, Icon }, i) => (
            <div key={href}>
              {!guest && i === MAIN.length && <div className="my-3 h-px bg-line" />}
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={cx("flex h-12 items-center gap-3 rounded-2xl px-4 font-medium transition", active(href) ? "bg-accent-soft text-accent-fg" : "text-fg hover:bg-surface2")}>
                <Icon className="size-5" /> <span className="flex-1">{label}</span>
                {href === "/support" && badge(supportUnread, "unread support messages")}
              </Link>
            </div>
          ))}
          <Link href="/subscribe" className={cx("mt-1 flex h-12 items-center gap-3 rounded-2xl px-4 font-medium transition", active("/subscribe") ? "bg-accent-soft text-accent-fg" : "text-fg hover:bg-surface2")}><Crown className="size-5 text-accent" /> <span className="flex-1">{user?.adFree ? "Subscription" : "Go ad-free"}</span>{user?.adFree && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase text-success">Active</span>}</Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className={cx("mt-1 flex h-12 items-center gap-3 rounded-2xl px-4 font-medium hover:bg-surface2", active("/admin") && "bg-accent-soft text-accent-fg")}><ShieldCheck className="size-5" /> Admin</Link>
          )}
        </nav>
        {user ? (
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface2">
            <Avatar user={user} size={42} />
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.firstName} {user.lastName}</span><span className="block truncate text-xs text-muted">{user.email}</span></span>
          </Link>
        ) : (
          <div className="space-y-2 rounded-2xl bg-surface2 p-4 text-center text-sm">
            <p className="text-muted">Create a free account to hear your documents read aloud and keep your library.</p>
            <Link href={`/sign-up?next=${encodeURIComponent(path)}`}><Button className="w-full" size="sm">Create Account</Button></Link>
            <Link href={`/sign-in?next=${encodeURIComponent(path)}`}><Button className="w-full" size="sm" variant="secondary">Sign In</Button></Link>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <TopAdBand active={path === "/home"} />
        <header className={cx(adTop ? "" : "safe-t", "sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2 backdrop-blur min-[740px]:justify-end min-[740px]:px-8")}>
          <Link href="/home" className="min-[740px]:hidden"><Logo size={32} /></Link>
          {bell}
        </header>
        <main className={cx("mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 pt-6 sm:px-6 lg:px-8", reading ? "pb-40 lg:pb-10" : "pb-28 min-[740px]:pb-24 lg:pb-12")}>
          {user && !user.emailVerified && (
            <div className="mb-5">
              <Banner tone="warn" action={<Button size="sm" variant="secondary" loading={sending} onClick={resend}>Resend email</Button>}>
                Please verify your email ({user.email}) — it's required before you can buy books.
              </Banner>
            </div>
          )}
          {children}
          <LegalFooter className="mt-12" />
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav aria-label="Main" data-hide-on-kb style={{ bottom: "var(--ad-bottom, 0px)" }} className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur min-[740px]:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-4">
          {MAIN.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition", active(href) ? "text-accent" : "text-muted")}>
                <span className={cx("relative grid h-8 w-14 place-items-center rounded-full transition", active(href) && "bg-accent-soft")}>
                  <Icon className="size-6" strokeWidth={active(href) ? 2.4 : 1.9} />
                  {href === "/profile" && supportUnread > 0 && <span className="absolute right-3 top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
