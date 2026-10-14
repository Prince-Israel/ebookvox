import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { RootGate } from "@/components/RootGate";

export default async function Root() {
  if (await getUser()) redirect("/home");
  return <RootGate />;
}
