import { db } from "./db";
import { reader, publisher, type ServiceName } from "./services";
import { notifyAdmins } from "./notify";
import { formatMoney } from "./money";
import type { Permission } from "./rbac";

type Evt = { id: number; type: string; at: string; data: any };
type Mapped = { perm: Permission; type: string; title: string; body: string; link?: string };

function map(service: ServiceName, e: Evt): Mapped | null {
  const d = e.data;
  if (service === "reader") {
    if (e.type === "user.created") return { perm: "users", type: "NEW_USER", title: "New user", body: `${d.name} (${d.email}) registered.`, link: `/users/${d.id}` };
    if (e.type === "order.paid") return { perm: "transactions", type: "NEW_TRANSACTION", title: "New transaction", body: `${d.buyer} bought “${d.book}” for ${formatMoney(d.amountMinor, d.currency)}.`, link: "/transactions" };
    if (e.type === "order.failed") return { perm: "transactions", type: "NEW_TRANSACTION", title: "Failed payment", body: `${d.buyer}'s payment for “${d.book}” failed (${formatMoney(d.amountMinor, d.currency)}).`, link: "/transactions" };
    if (e.type === "ticket.message") return { perm: "support", type: d.created ? "SUPPORT_MESSAGE" : "USER_RESPONSE", title: d.created ? "New support message" : "User response", body: `${d.name}: ${d.subject}`, link: `/support/reader/${d.ticketId}` };
  } else {
    if (e.type === "publisher.created") return { perm: "publishers", type: "NEW_PUBLISHER", title: "New publisher", body: `${d.name} (${d.email}) registered.`, link: `/publishers/${d.id}` };
    if (e.type === "book.submitted") return { perm: "book_review", type: "NEW_BOOK_SUBMISSION", title: d.resubmit ? "Book resubmitted" : "New book submission", body: `“${d.title}” by ${d.author} (${d.publisher}) awaits review.`, link: "/book-review" };
    if (e.type === "sale.created") return { perm: "sales", type: "NEW_SALE", title: "New sale", body: `“${d.book}” sold for ${formatMoney(d.grossMinor, d.currency)} (${d.publisher}).`, link: "/sales" };
    if (e.type === "payout.requested") return { perm: "payouts", type: "NEW_PAYOUT_REQUEST", title: "New payout request", body: `${d.publisher} requested ${formatMoney(d.amountMinor, d.currency)}.`, link: "/payouts" };
    if (e.type === "ticket.message") return { perm: "support", type: d.created ? "SUPPORT_MESSAGE" : "PUBLISHER_RESPONSE", title: d.created ? "New support message" : "Publisher response", body: `${d.name}: ${d.subject}`, link: `/support/publisher/${d.ticketId}` };
  }
  return null;
}

/** The 15% platform share lands in the admin ledger as soon as the payment is confirmed. */
async function recordCommission(d: any) {
  const id = String(d.orderId);
  if (await db.commission.findUnique({ where: { orderId: id } })) return;
  await db.commission.create({
    data: {
      orderId: id, orderNumber: String(d.number ?? id), book: String(d.book ?? ""), publisher: String(d.publisher ?? ""), currency: d.currency, grossMinor: d.amountMinor,
      feeMinor: d.feeMinor, baseCurrency: d.baseCurrency ?? null, baseAmountMinor: d.baseAmountMinor ?? null,
    },
  });
  await notifyAdmins("sales", "NEW_COMMISSION", "Commission received", `${formatMoney(d.feeMinor, d.currency)} (15%) from “${d.book}” — ${d.publisher}.`, "/sales");
}

let last = 0;
let running: Promise<void> | null = null;

/** Pulls new events from each service (cursor based, so nothing is missed or duplicated) and turns them into admin notifications. */
export function pollEvents(force = false): Promise<void> {
  if (running) return running;
  if (!force && Date.now() - last < 2500) return Promise.resolve();
  last = Date.now();
  running = (async () => {
    for (const service of ["reader", "publisher"] as const) {
      const call = service === "reader" ? reader : publisher;
      try {
        const cur = await db.serviceCursor.findUnique({ where: { service } });
        if (!cur) {
          // First contact: start from "now" so history doesn't flood the bell.
          const { latest } = await call<{ latest: number }>("GET", "events", { query: { after: 2_000_000_000 } });
          await db.serviceCursor.create({ data: { service, lastId: latest } });
          continue;
        }
        const { events } = await call<{ events: Evt[] }>("GET", "events", { query: { after: cur.lastId } });
        for (const e of events) {
          if (service === "reader" && e.type === "order.paid" && typeof e.data?.feeMinor === "number") await recordCommission(e.data);
          const m = map(service, e);
          if (m) await notifyAdmins(m.perm, m.type, m.title, m.body, m.link);
        }
        await db.serviceCursor.update({ where: { service }, data: { lastId: events.at(-1)?.id ?? cur.lastId, lastPolledAt: new Date(), lastError: null } });
      } catch (e) {
        await db.serviceCursor.updateMany({ where: { service }, data: { lastError: (e as Error).message.slice(0, 200) } });
      }
    }
  })().finally(() => { running = null; });
  return running;
}
