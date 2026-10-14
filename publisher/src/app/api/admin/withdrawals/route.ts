import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = req.nextUrl.searchParams.get("status");
  const list = await db.withdrawal.findMany({ where: status ? { status } : {}, include: { publisher: { select: { publisherName: true, email: true, country: true } } }, orderBy: { requestedAt: "desc" }, take: 300 });
  return { withdrawals: list.map((w) => ({ id: w.id, number: w.number, publisher: w.publisher, amountMinor: w.amountMinor, currency: w.currency, method: w.method, destination: JSON.parse(w.methodSnapshot), status: w.status, reason: w.reason, requestedAt: w.requestedAt, processedAt: w.processedAt })) };
});
