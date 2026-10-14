import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validSignature } from "@/lib/reader";
import { splitSale, formatMoney } from "@/lib/money";
import { notify } from "@/lib/notify";
import { emitEvent } from "@/lib/events";

/**
 * Events from the Reader. Signed with HMAC-SHA256 (shared secret). Sales are only ever created here, from the Reader's
 * server-verified Paystack orders; the 85/15 split is computed on this server, never taken from the payload.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-ebookvox-signature"))) return new NextResponse("invalid signature", { status: 401 });
  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new NextResponse("bad json", { status: 400 }); }

  try {
    if (evt.type === "sale.completed") {
      const d = evt.data;
      // The publisher is always paid in their own currency: the list price they set, which the Reader converted for the buyer.
      const cur: string = d?.baseCurrency ?? d?.currency;
      const gross: number = d?.baseAmountMinor ?? d?.amountMinor;
      if (!d?.orderId || !Number.isInteger(gross) || gross <= 0 || !["NGN", "USD", "GBP", "EUR"].includes(cur)) return new NextResponse("bad sale", { status: 400 });
      const book = await db.book.findUnique({ where: { id: String(d.bookExternalId) }, include: { publisher: true } });
      if (!book) return new NextResponse("unknown book", { status: 202 }); // not ours; acknowledge so it isn't retried
      if (await db.sale.findUnique({ where: { readerOrderId: String(d.orderId) } })) return new NextResponse("duplicate");
      const { publisherMinor, platformMinor } = splitSale(gross);
      const sale = await db.$transaction(async (t) => {
        const s = await t.sale.create({
          data: {
            number: `SALE-${String(d.orderNumber ?? d.orderId).replace(/^ORD-/, "")}`.slice(0, 40), publisherId: book.publisherId, bookId: book.id, readerOrderId: String(d.orderId),
            buyerLabel: String(d.buyer ?? "Reader").slice(0, 60), currency: cur, grossMinor: gross, paidCurrency: d.currency ?? cur, paidMinor: d.amountMinor ?? gross, publisherMinor, platformMinor, paidAt: new Date(d.paidAt ?? Date.now()),
          },
        });
        await t.walletTx.create({ data: { publisherId: book.publisherId, currency: cur, type: "SALE_CREDIT", amountMinor: publisherMinor, description: `Sale of “${book.title}”`, saleId: s.id } });
        return s;
      });
      await emitEvent("sale.created", { id: sale.id, number: sale.number, book: book.title, publisher: book.publisher.publisherName, grossMinor: sale.grossMinor, publisherMinor, currency: sale.currency });
      await notify(book.publisherId, "SALE_COMPLETED", "New sale", `“${book.title}” was bought. You earned ${formatMoney(publisherMinor, sale.currency)}.`, "/sales");
      await notify(book.publisherId, "EARNINGS_CREDITED", "Earnings credited", `${formatMoney(publisherMinor, cur)} was added to your ${cur} wallet.`, "/wallet");
    } else if (evt.type === "book.status") {
      const d = evt.data;
      const book = await db.book.findUnique({ where: { id: String(d.externalId) } });
      if (!book) return new NextResponse("unknown book", { status: 202 });
      if (d.status === "APPROVED" && book.status !== "PUBLISHED") {
        await db.book.update({ where: { id: book.id }, data: { status: "PUBLISHED", publishedAt: new Date(), approvedAt: book.approvedAt ?? new Date(), syncError: null } });
        await notify(book.publisherId, "BOOK_PUBLISHED", "Your book is live", `“${book.title}” is now available to readers.`, `/books/${book.id}`);
      } else if (d.status === "REJECTED" && book.status !== "REJECTED") {
        await db.book.update({ where: { id: book.id }, data: { status: "REJECTED", rejectionReason: String(d.reason ?? "Did not meet our guidelines.").slice(0, 500) } });
        await notify(book.publisherId, "BOOK_REJECTED", "Book rejected", `“${book.title}” was rejected: ${d.reason ?? "see details"}`, `/books/${book.id}`);
      }
    }
  } catch (e) {
    console.error("[webhook]", e);
    return new NextResponse("error", { status: 500 });
  }
  return new NextResponse("ok");
}
