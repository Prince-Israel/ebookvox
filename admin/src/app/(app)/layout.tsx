import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdmin, publicAdmin } from "@/lib/auth";
import { AdminProvider } from "@/components/AdminContext";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  const unread = await db.adminNotification.count({ where: { adminId: admin.id, readAt: null } });
  return <AdminProvider initial={publicAdmin(admin)} initialUnread={unread}><AppShell>{children}</AppShell></AdminProvider>;
}
