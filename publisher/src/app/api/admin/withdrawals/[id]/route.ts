import { z } from "zod";
import { readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { processWithdrawal } from "@/lib/ops";

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const d = z.object({ action: z.enum(["paid", "reject"]), reason: z.string().trim().max(500).optional(), reference: z.string().trim().max(100).optional() }).parse(await readJson(req));
  await processWithdrawal((await params).id, d.action, { reason: d.reason, reference: d.reference, by: admin.email });
});
