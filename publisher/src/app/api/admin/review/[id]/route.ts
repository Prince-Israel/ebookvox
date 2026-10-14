import { z } from "zod";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { reviewBook } from "@/lib/ops";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const d = z.object({ action: z.enum(["approve", "reject", "sync"]), reason: z.string().trim().max(500).optional() }).parse(await readJson(req));
  return reviewBook((await params).id, d.action, d.reason);
});
