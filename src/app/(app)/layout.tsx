import { db } from "@/lib/db";
import { getUser, publicUser } from "@/lib/auth";
import { UserProvider } from "@/components/UserContext";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

// Visitors may browse Home and Books; every other screen sends them to sign in (see AppShell).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <UserProvider initial={user ? publicUser(user) : null} initialUnread={unread}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
