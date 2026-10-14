import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser, publicUser } from "@/lib/auth";
import { UserProvider } from "@/components/UserContext";
import { AppShell } from "@/components/AppShell";
import { VerifyGate } from "@/components/VerifyGate";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <UserProvider initial={publicUser(user)} initialUnread={unread}>
      {user.emailVerifiedAt ? <AppShell>{children}</AppShell> : <VerifyGate />}
    </UserProvider>
  );
}
