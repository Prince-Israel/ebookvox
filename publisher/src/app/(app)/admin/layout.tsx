import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await getUser();
  if (!u || u.role !== "ADMIN") notFound();
  return children;
}
