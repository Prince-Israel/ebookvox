"use client";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, BookPlus, CheckCheck, CreditCard, LifeBuoy, Sparkles, UserCog } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Skeleton, cx, useToast, when } from "@/components/ui";
import { useUser } from "@/components/UserContext";
import { api, ApiFailure, useApi } from "@/lib/client";

type N = { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };
const ICON: Record<string, typeof Bell> = { PURCHASE_SUCCESS: CreditCard, PAYMENT_FAILED: AlertCircle, BOOK_ADDED: BookPlus, NEW_BOOK: Sparkles, SUPPORT_REPLY: LifeBuoy, ACCOUNT_UPDATE: UserCog };

export default function NotificationsPage() {
  const state = useApi<{ notifications: N[]; unread: number }>("/api/notifications", "We couldn't load your notifications. Please try again.");
  const { setUnread } = useUser();
  const router = useRouter();
  const toast = useToast();

  async function mark(body: { ids?: string[]; all?: boolean }) {
    try {
      const r = await api<{ unread: number }>("/api/notifications/read", { method: "POST", json: body });
      setUnread(r.unread);
      state.setData((d) => d && { notifications: d.notifications.map((n) => (body.all || body.ids?.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)), unread: r.unread });
    } catch (e) {
      toast((e as ApiFailure).message, "error");
    }
  }

  async function open(n: N) {
    if (!n.readAt) await mark({ ids: [n.id] });
    if (n.link) router.push(n.link);
  }

  const unread = state.data?.unread ?? 0;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Notifications" sub={state.data ? (unread ? `${unread} unread` : "You're all caught up") : undefined} action={unread > 0 ? <Button variant="secondary" size="sm" onClick={() => mark({ all: true })}><CheckCheck className="size-4" /> Mark all read</Button> : undefined} />
      <Async state={state} skeleton={<div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
        isEmpty={(d) => d.notifications.length === 0}
        empty={<EmptyState icon={<Bell className="size-8" />} title="No notifications yet" body="Purchases, new books and support replies will show up here." />}>
        {(d) => (
          <ul className="space-y-2.5">
            {d.notifications.map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={cx("flex w-full items-start gap-4 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5", n.readAt ? "border-line bg-surface" : "border-accent/50 bg-accent-soft")}>
                    <span className={cx("grid size-11 shrink-0 place-items-center rounded-full", n.type === "PAYMENT_FAILED" ? "bg-danger-soft text-danger" : "bg-surface2 text-accent")}><Icon className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><span className="font-semibold">{n.title}</span>{!n.readAt && <span className="size-2.5 rounded-full bg-accent" aria-label="Unread" />}</span>
                      <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted">{when(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </div>
  );
}
