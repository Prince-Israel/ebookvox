import { route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getCategories, getMinWithdrawals } from "@/lib/platform-config";

export const GET = route(async () => {
  await requireUser();
  return { categories: await getCategories(), minWithdrawals: await getMinWithdrawals() };
});
