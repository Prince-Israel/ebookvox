"use client";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Async, Button, EmptyState, PageTitle, Skeleton, cx, useToast, when } from "@/components/ui";
import { useAdmin } from "@/components/AdminContext";
import { api, ApiFailure, useApi } from "@/lib/client";

export default function NotificationsPage() {
  const s = useApi<{ notifications: any[]; unread: number }>("/api/notifications", "We couldn't load notifications.");
  const { setUnread } = useAdmin();
  const router = useRouter();
  const toast = useToast();
  async function mark(body: { ids?: string[]; all?: boolean }) {
    try {
      const r = await api<{ unread: number }>("/api/notifications/read", { method: "POST", json: body });
      setUnread(r.unread);
      s.setData((d) => d && { notifications: d.notifications.map((n) => (body.all || body.ids?.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)), unread: r.unread });
    } catch (e) { toast((e as ApiFailure).message, "error"); }
  }
  const unread = s.data?.unread ?? 0;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Notifications" sub={s.data ? (unread ? `${unread} unread` : "You're all caught up") : undefined} action={unread > 0 ? <Button variant="secondary" size="sm" onClick={() => mark({ all: true })}><CheckCheck className="size-4" /> Mark all read</Button> : undefined} />
      <Async state={s} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>} isEmpty={(d) => d.notifications.length === 0} empty={<EmptyState icon={<Bell className="size-8" />} title="No notifications yet." body="New users, publishers, submissions, sales, payouts and support messages will appear here." />}>
        {(d) => <ul className="space-y-2.5">{d.notifications.map((n) => (
          <li key={n.id}><button onClick={async () => { if (!n.readAt) await mark({ ids: [n.id] }); if (n.link) router.push(n.link); }} className={cx("flex w-full items-start gap-4 rounded-3xl border p-4 text-left transition hover:-translate-y-0.5", n.readAt ? "border-line bg-surface" : "border-accent/50 bg-accent-soft")}>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-semibold">{n.title}</span>{!n.readAt && <span className="size-2.5 rounded-full bg-accent" aria-label="Unread" />}</span><span className="mt-0.5 block text-sm text-muted">{n.body}</span><span className="mt-1 block text-xs text-muted">{when(n.createdAt)}</span></span>
          </button></li>))}</ul>}
      </Async>
    </div>
  );
}
