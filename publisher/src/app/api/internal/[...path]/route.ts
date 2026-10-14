import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { verifyServiceRequest } from "@/lib/service-auth";
import { walletSummary } from "@/lib/wallet";
import { adminTicketReply, adminTicketStatus, processWithdrawal, reviewBook } from "@/lib/ops";
import { publishToReader } from "@/lib/reader";
import { CURRENCIES, currencyForCountry } from "@/lib/countries";
import { destLabel } from "@/lib/payout";
import { normalizePhone } from "@/lib/validation";

// Internal service API for the Ebookvox Admin platform (HMAC-signed with PUBLISHER_ADMIN_SECRET).
type Ctx = { q: URLSearchParams; body: any; p: string[] };
type H = (c: Ctx) => Promise<unknown>;
const routes: Array<[string, RegExp, H]> = [];
const on = (method: string, pattern: string, h: H) => routes.push([method, new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`), h]);
const page = (q: URLSearchParams) => { const take = Math.min(100, Number(q.get("pageSize") ?? 25)); return { skip: (Math.max(1, Number(q.get("page") ?? 1)) - 1) * take, take }; };

function bucketing(range: string) {
  const days = { "7d": 7, "30d": 30, "3m": 90, "6m": 182, "1y": 365 }[range] ?? 30;
  const step = days <= 31 ? 1 : days <= 190 ? 7 : 30;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const keys: string[] = [];
  for (let t = start.getTime(); t <= Date.now() + 86400_000; t += step * 86400_000) keys.push(new Date(t).toISOString().slice(0, 10));
  return { start, keys, idx: (d: Date) => Math.min(keys.length - 1, Math.max(0, Math.floor((new Date(d.toDateString()).getTime() - start.getTime()) / (step * 86400_000)))) };
}

on("GET", "health", async () => ({ ok: true, service: "publisher", time: new Date().toISOString(), publishers: await db.user.count({ where: { role: "PUBLISHER" } }) }));

on("GET", "stats", async ({ q }) => {
  const { start, keys, idx } = bucketing(q.get("range") ?? "30d");
  const [pub, books, sales, wd, regs, susp] = await Promise.all([
    db.user.groupBy({ by: ["status"], where: { role: "PUBLISHER" }, _count: true }),
    db.book.groupBy({ by: ["status"], _count: true }),
    db.sale.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { grossMinor: true, publisherMinor: true, platformMinor: true }, _count: true }),
    db.withdrawal.groupBy({ by: ["status", "currency"], _sum: { amountMinor: true }, _count: true }),
    db.user.findMany({ where: { role: "PUBLISHER", createdAt: { gte: start } }, select: { createdAt: true } }),
    db.user.findMany({ where: { role: "PUBLISHER", suspendedAt: { gte: start } }, select: { suspendedAt: true } }),
  ]);
  const n = (rows: Array<{ status: string; _count: number }>, ...s: string[]) => rows.filter((r) => !s.length || s.includes(r.status)).reduce((a, r) => a + r._count, 0);
  const series = keys.map((date) => ({ date, registrations: 0, suspended: 0 }));
  regs.forEach((r) => series[idx(r.createdAt)].registrations++);
  susp.forEach((s) => series[idx(s.suspendedAt!)].suspended++);
  return {
    publishers: { total: n(pub) - n(pub, "DELETED"), active: n(pub, "ACTIVE"), suspended: n(pub, "SUSPENDED") },
    books: { total: n(books), reviewing: n(books, "REVIEWING"), approved: n(books, "APPROVED", "PUBLISHED"), rejected: n(books, "REJECTED"), drafts: n(books, "DRAFT") },
    sales: sales.map((s) => ({ currency: s.currency, count: s._count, grossMinor: s._sum.grossMinor ?? 0, publisherMinor: s._sum.publisherMinor ?? 0, platformMinor: s._sum.platformMinor ?? 0 })),
    payouts: { processing: n(wd as any, "PROCESSING"), paid: n(wd as any, "PAID"), rejected: n(wd as any, "REJECTED") },
    series,
  };
});

// ---- publishers ----
const pubRow = (u: any) => ({ id: u.id, name: u.publisherName, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, country: u.country, currency: u.currency, status: u.status, verified: !!u.emailVerifiedAt, bio: u.bio, createdAt: u.createdAt, suspendedAt: u.suspendedAt });

on("GET", "publishers", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { role: "PUBLISHER", status: q.get("status") ?? { not: "DELETED" }, ...(s ? { OR: [{ publisherName: { contains: s } }, { email: { contains: s } }, { firstName: { contains: s } }, { lastName: { contains: s } }, { phone: { contains: s } }] } : {}) };
  const [rows, total] = await Promise.all([db.user.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q) }), db.user.count({ where })]);
  const out = [];
  for (const u of rows) {
    const w = await walletSummary(u.id);
    out.push({ ...pubRow(u), wallet: w.filter((x) => x.available !== 0 || x.earned > 0).map((x) => ({ currency: x.currency, availableMinor: x.available, earnedMinor: x.earned })) });
  }
  return { total, publishers: out };
});

on("GET", "publishers/:id", async ({ p }) => {
  const u = await db.user.findFirst({ where: { id: p[0], role: "PUBLISHER" } });
  if (!u) throw new ApiError(404, "Publisher not found.");
  const [books, sales, wallets, tx, withdrawals, tickets] = await Promise.all([
    db.book.findMany({ where: { publisherId: u.id }, include: { prices: true }, orderBy: { updatedAt: "desc" } }),
    db.sale.findMany({ where: { publisherId: u.id }, include: { book: { select: { title: true } } }, orderBy: { paidAt: "desc" }, take: 100 }),
    walletSummary(u.id),
    db.walletTx.findMany({ where: { publisherId: u.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.withdrawal.findMany({ where: { publisherId: u.id }, orderBy: { requestedAt: "desc" } }),
    db.ticket.findMany({ where: { userId: u.id }, orderBy: { updatedAt: "desc" } }),
  ]);
  const pm = await db.paymentMethod.findUnique({ where: { userId: u.id } });
  return {
    publisher: { ...pubRow(u), paymentMethod: pm && { type: pm.type, bankName: pm.bankName, accountName: pm.accountName, accountNumber: pm.accountNumber, paypalEmail: pm.paypalEmail } },
    books: books.map((b) => ({ id: b.id, title: b.title, author: b.author, category: b.category, status: b.status, isFree: b.isFree, prices: Object.fromEntries(b.prices.map((x) => [x.currency, x.amountMinor])), createdAt: b.createdAt })),
    sales: sales.map((s) => ({ id: s.id, number: s.number, book: s.book.title, buyer: s.buyerLabel, currency: s.currency, grossMinor: s.grossMinor, publisherMinor: s.publisherMinor, platformMinor: s.platformMinor, status: s.status, paidAt: s.paidAt })),
    wallets, transactions: tx.map((t) => ({ id: t.id, type: t.type, currency: t.currency, amountMinor: t.amountMinor, description: t.description, createdAt: t.createdAt })),
    withdrawals: withdrawals.map((w) => ({ id: w.id, number: w.number, amountMinor: w.amountMinor, currency: w.currency, method: w.method, destination: destLabel(w.methodSnapshot), status: w.status, reason: w.reason, payoutReference: w.payoutReference, requestedAt: w.requestedAt, processedAt: w.processedAt })),
    tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt })),
  };
});

on("PATCH", "publishers/:id", async ({ p, body }) => {
  const d = z.object({ publisherName: z.string().trim().min(2).max(120), firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(80), bio: z.string().trim().max(1500), phone: z.string().trim(), country: z.string().length(2) }).partial().parse(body);
  const u = await db.user.findFirst({ where: { id: p[0], role: "PUBLISHER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "Publisher not found.");
  const data: any = { ...d };
  if (d.phone !== undefined) { try { data.phone = normalizePhone(d.phone, u.phoneCountry); } catch (e) { throw new ApiError(400, (e as Error).message, { phone: (e as Error).message }); } }
  if (d.country && d.country !== u.country) {
    const money = await db.walletTx.count({ where: { publisherId: u.id } });
    if (money > 0) throw new ApiError(409, "This publisher already has wallet activity, so their country (and currency) can't be changed.");
    data.currency = currencyForCountry(d.country);
  }
  const upd = await db.user.update({ where: { id: u.id }, data });
  return { publisher: pubRow(upd) };
});

on("POST", "publishers/:id/status", async ({ p, body }) => {
  const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse(body);
  const u = await db.user.findFirst({ where: { id: p[0], role: "PUBLISHER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "Publisher not found.");
  await db.user.update({ where: { id: u.id }, data: { status, suspendedAt: status === "SUSPENDED" ? new Date() : null } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: u.id } });
  return { id: u.id, status };
});

on("DELETE", "publishers/:id", async ({ p }) => {
  const u = await db.user.findFirst({ where: { id: p[0], role: "PUBLISHER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "Publisher not found.");
  const live = await db.book.count({ where: { publisherId: u.id, status: { in: ["APPROVED", "PUBLISHED", "REVIEWING"] } } });
  if (live) throw new ApiError(409, `This publisher has ${live} live or in-review book${live === 1 ? "" : "s"}. Delete or reject those books first, or suspend the publisher instead.`);
  const open = await db.withdrawal.count({ where: { publisherId: u.id, status: "PROCESSING" } });
  if (open) throw new ApiError(409, "This publisher has a payout in progress. Process it first.");
  const bal = (await walletSummary(u.id)).filter((w) => w.available > 0);
  if (bal.length) throw new ApiError(409, "This publisher still has an unpaid wallet balance. Settle it (or suspend instead) before deleting.");
  await db.$transaction([
    db.book.deleteMany({ where: { publisherId: u.id, sales: { none: {} } } }),
    db.session.deleteMany({ where: { userId: u.id } }), db.authToken.deleteMany({ where: { userId: u.id } }), db.avatar.deleteMany({ where: { userId: u.id } }),
    db.paymentMethod.deleteMany({ where: { userId: u.id } }), db.notification.deleteMany({ where: { userId: u.id } }),
    db.user.update({ where: { id: u.id }, data: { status: "DELETED", email: `deleted-${u.id}@deleted.invalid`, firstName: "Deleted", lastName: "Publisher", publisherName: "Deleted Publisher", phone: "+0", bio: "", avatarUpdatedAt: null, passwordHash: "!" } }),
  ]);
  return { id: u.id, deleted: true };
});

// ---- books ----
const bookRow = (b: any) => ({
  id: b.id, title: b.title, author: b.author, category: b.category, description: b.description, isFree: b.isFree, status: b.status, rejectionReason: b.rejectionReason, syncError: b.syncError,
  publisher: { id: b.publisher.id, name: b.publisher.publisherName, email: b.publisher.email }, fileName: b.fileName, fileKind: b.fileKind, fileSize: b.fileSize, totalChars: b.totalChars, hasCover: !!b.cover, hasFile: !!b.file,
  submittedAt: b.submittedAt, approvedAt: b.approvedAt, publishedAt: b.publishedAt, createdAt: b.createdAt, updatedAt: b.updatedAt,
  prices: Object.fromEntries(b.prices.map((x: any) => [x.currency, x.amountMinor])),
});
const bookInc = { publisher: true, prices: true, cover: { select: { bookId: true } }, file: { select: { bookId: true } } } as const;

on("GET", "books", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { ...(q.get("status") ? { status: { in: q.get("status")!.split(",") } } : { status: { not: "DRAFT" } }), ...(q.get("publisherId") ? { publisherId: q.get("publisherId") } : {}), ...(s ? { OR: [{ title: { contains: s } }, { author: { contains: s } }, { category: { contains: s } }, { publisher: { publisherName: { contains: s } } }] } : {}) };
  const [rows, total] = await Promise.all([db.book.findMany({ where, include: bookInc, orderBy: q.get("sort") === "recent" ? [{ updatedAt: "desc" }] : [{ submittedAt: "asc" }], ...page(q) }), db.book.count({ where })]);
  return { total, books: rows.map(bookRow) };
});
on("GET", "books/:id", async ({ p }) => {
  const b = await db.book.findUnique({ where: { id: p[0] }, include: bookInc });
  if (!b || b.status === "DRAFT") throw new ApiError(404, "Book not found.");
  return { book: { ...bookRow(b), preview: b.content.slice(0, 2000) } };
});
on("GET", "books/:id/cover", async ({ p }) => {
  const c = await db.cover.findUnique({ where: { bookId: p[0] } });
  if (!c) throw new ApiError(404, "No cover.");
  return new Response(new Uint8Array(c.data), { headers: { "content-type": c.mime, "cache-control": "private, max-age=300" } });
});
on("GET", "books/:id/file", async ({ p }) => {
  const [f, b] = await Promise.all([db.bookFile.findUnique({ where: { bookId: p[0] } }), db.book.findUnique({ where: { id: p[0] }, select: { fileName: true } })]);
  if (!f) throw new ApiError(404, "No book file.");
  return new Response(new Uint8Array(f.data), { headers: { "content-type": f.mime, "content-disposition": `attachment; filename="${(b?.fileName ?? "book").replace(/[^\w.\- ]/g, "_")}"` } });
});
on("POST", "books/:id/review", async ({ p, body }) => {
  const d = z.object({ action: z.enum(["approve", "reject", "sync"]), reason: z.string().trim().max(500).optional() }).parse(body);
  return reviewBook(p[0], d.action, d.reason);
});
on("PATCH", "books/:id", async ({ p, body }) => {
  const d = z.object({ title: z.string().trim().min(1).max(200), author: z.string().trim().min(1).max(150), category: z.string().trim().min(1).max(60), description: z.string().trim().min(10).max(5000), prices: z.record(z.string(), z.number().int().positive().max(100_000_000)) }).partial().parse(body);
  const b = await db.book.findUnique({ where: { id: p[0] }, include: { prices: true, publisher: { select: { currency: true } } } });
  if (!b || b.status === "DRAFT") throw new ApiError(404, "Book not found.");
  const { prices, ...rest } = d;
  if (prices && !b.isFree && !(prices[b.publisher.currency] > 0)) throw new ApiError(400, `Prices are set in the publisher's currency (${b.publisher.currency}); other currencies are converted automatically.`);
  await db.$transaction(async (t) => {
    await t.book.update({ where: { id: b.id }, data: rest });
    if (prices && !b.isFree) for (const [currency, amountMinor] of Object.entries(prices)) if (currency === b.publisher.currency) await t.bookPrice.upsert({ where: { bookId_currency: { bookId: b.id, currency } }, create: { bookId: b.id, currency, amountMinor }, update: { amountMinor } });
  });
  let warning: string | undefined;
  if (b.status === "PUBLISHED") { const r = await publishToReader(b.id); if (!r.ok) warning = r.error; }
  return { id: b.id, warning };
});
on("DELETE", "books/:id", async ({ p }) => {
  const b = await db.book.findUnique({ where: { id: p[0] }, include: { _count: { select: { sales: true } } } });
  if (!b) throw new ApiError(404, "Book not found.");
  if (b._count.sales > 0) { await db.book.update({ where: { id: b.id }, data: { status: "REMOVED", rejectionReason: "Removed from the catalogue by an administrator." } }); await db.notification.create({ data: { userId: b.publisherId, type: "ACCOUNT_UPDATE", title: "Book removed", body: `“${b.title}” was removed from the catalogue by an administrator.`, link: `/books/${b.id}` } }); return { id: b.id, removed: true }; }
  await db.book.delete({ where: { id: b.id } });
  await db.notification.create({ data: { userId: b.publisherId, type: "ACCOUNT_UPDATE", title: "Book deleted", body: `“${b.title}” was deleted by an administrator.` } });
  return { id: b.id, deleted: true };
});

on("GET", "authors", async () => {
  const books = await db.book.findMany({ where: { status: { notIn: ["DRAFT"] } }, include: { publisher: true, sales: { where: { status: "PAID" }, select: { grossMinor: true, currency: true } } } });
  const map = new Map<string, any>();
  for (const b of books) {
    const key = `${b.author.trim().toLowerCase()}|${b.publisherId}`;
    const a = map.get(key) ?? { author: b.author.trim(), publisherId: b.publisherId, publisher: b.publisher.publisherName, registeredAt: b.publisher.createdAt, bio: [b.publisher.publisherName, `${b.publisher.firstName} ${b.publisher.lastName}`].some((n) => n.trim().toLowerCase() === b.author.trim().toLowerCase()) ? b.publisher.bio : "", books: 0, published: 0, sales: 0, gross: {} as Record<string, number> };
    a.books++;
    if (["APPROVED", "PUBLISHED"].includes(b.status)) a.published++;
    for (const s of b.sales) { a.sales++; a.gross[s.currency] = (a.gross[s.currency] ?? 0) + s.grossMinor; }
    map.set(key, a);
  }
  return { authors: [...map.values()].sort((x, y) => y.books - x.books) };
});

// ---- sales & payouts ----
on("GET", "sales", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = {
    ...(q.get("publisherId") ? { publisherId: q.get("publisherId") } : {}), ...(q.get("currency") ? { currency: q.get("currency") } : {}), ...(q.get("status") ? { status: q.get("status") } : {}),
    ...(q.get("from") || q.get("to") ? { paidAt: { ...(q.get("from") ? { gte: new Date(q.get("from")!) } : {}), ...(q.get("to") ? { lte: new Date(q.get("to")!) } : {}) } } : {}),
    ...(s ? { OR: [{ number: { contains: s } }, { buyerLabel: { contains: s } }, { book: { title: { contains: s } } }, { publisher: { publisherName: { contains: s } } }] } : {}),
  };
  const [rows, total, totals] = await Promise.all([
    db.sale.findMany({ where, include: { book: { select: { id: true, title: true } }, publisher: { select: { id: true, publisherName: true } } }, orderBy: { paidAt: "desc" }, ...page(q) }),
    db.sale.count({ where }),
    db.sale.groupBy({ by: ["currency"], where, _sum: { grossMinor: true, publisherMinor: true, platformMinor: true }, _count: true }),
  ]);
  return {
    total, totals: totals.map((t) => ({ currency: t.currency, count: t._count, grossMinor: t._sum.grossMinor ?? 0, publisherMinor: t._sum.publisherMinor ?? 0, platformMinor: t._sum.platformMinor ?? 0 })),
    sales: rows.map((s) => ({ id: s.id, number: s.number, readerOrderId: s.readerOrderId, book: s.book, publisher: { id: s.publisher.id, name: s.publisher.publisherName }, buyer: s.buyerLabel, currency: s.currency, grossMinor: s.grossMinor, publisherMinor: s.publisherMinor, platformMinor: s.platformMinor, status: s.status, paidAt: s.paidAt })),
  };
});

const wdRow = (w: any) => { let dest: any = {}; try { dest = JSON.parse(w.methodSnapshot); } catch {} return { id: w.id, number: w.number, publisher: { id: w.publisher.id, name: w.publisher.publisherName, email: w.publisher.email, country: w.publisher.country }, amountMinor: w.amountMinor, currency: w.currency, method: w.method, destination: dest, destinationLabel: destLabel(w.methodSnapshot), status: w.status, reason: w.reason, payoutReference: w.payoutReference, processedBy: w.processedBy, requestedAt: w.requestedAt, processedAt: w.processedAt }; };
on("GET", "withdrawals", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { ...(q.get("status") ? { status: q.get("status") } : {}), ...(q.get("publisherId") ? { publisherId: q.get("publisherId") } : {}), ...(q.get("currency") ? { currency: q.get("currency") } : {}), ...(s ? { OR: [{ number: { contains: s } }, { publisher: { publisherName: { contains: s } } }] } : {}) };
  const [rows, total] = await Promise.all([db.withdrawal.findMany({ where, include: { publisher: true }, orderBy: { requestedAt: "desc" }, ...page(q) }), db.withdrawal.count({ where })]);
  return { total, withdrawals: rows.map(wdRow) };
});
on("GET", "withdrawals/:id", async ({ p }) => {
  const w = await db.withdrawal.findUnique({ where: { id: p[0] }, include: { publisher: true } });
  if (!w) throw new ApiError(404, "Withdrawal not found.");
  return { withdrawal: wdRow(w) };
});
on("POST", "withdrawals/:id/process", async ({ p, body }) => {
  const d = z.object({ action: z.enum(["paid", "reject"]), reason: z.string().trim().max(500).optional(), reference: z.string().trim().max(100).optional(), by: z.string().max(120).optional() }).parse(body);
  return processWithdrawal(p[0], d.action, { reason: d.reason, reference: d.reference, by: d.by });
});

// ---- support ----
const tRow = (t: any) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, name: t.user.publisherName, email: t.user.email, userId: t.user.id, lastMessage: t.messages?.[0]?.body ?? "", lastFrom: t.messages?.[0]?.authorRole ?? "PUBLISHER" });
on("GET", "tickets", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { ...(q.get("status") ? { status: q.get("status") } : {}), ...(q.get("userId") ? { userId: q.get("userId") } : {}), ...(s ? { OR: [{ subject: { contains: s } }, { user: { email: { contains: s } } }, { user: { publisherName: { contains: s } } }] } : {}) };
  const [rows, total] = await Promise.all([db.ticket.findMany({ where, include: { user: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, ...page(q) }), db.ticket.count({ where })]);
  return { total, tickets: rows.map(tRow) };
});
on("GET", "tickets/:id", async ({ p }) => {
  const t = await db.ticket.findUnique({ where: { id: p[0] }, include: { user: true, messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  return { ticket: { ...tRow(t), messages: t.messages.map((m) => ({ id: m.id, from: m.authorRole === "ADMIN" ? "ADMIN" : "USER", body: m.body, createdAt: m.createdAt, author: m.authorRole === "ADMIN" ? (m.authorId.startsWith("admin:") ? m.authorId.slice(6) : "Admin") : t.user.publisherName })) } };
});
on("POST", "tickets/:id/reply", async ({ p, body }) => { const d = z.object({ message: z.string().trim().min(1).max(5000), adminName: z.string().max(100).default("Admin") }).parse(body); return adminTicketReply(p[0], d.message, d.adminName); });
on("POST", "tickets/:id/status", async ({ p, body }) => { const { status } = z.object({ status: z.enum(["OPEN", "WAITING_PUBLISHER", "CLOSED"]) }).parse(body); return adminTicketStatus(p[0], status); });

on("GET", "events", async ({ q }) => {
  const after = Number(q.get("after") ?? 0);
  const rows = await db.serviceEvent.findMany({ where: { id: { gt: after } }, orderBy: { id: "asc" }, take: 200 });
  const last = await db.serviceEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  return { events: rows.map((e) => ({ id: e.id, type: e.type, at: e.createdAt, data: JSON.parse(e.payload) })), latest: last?.id ?? 0 };
});

on("GET", "search", async ({ q }) => {
  const s = (q.get("q") ?? "").trim();
  if (s.length < 2) return { publishers: [], books: [], sales: [] };
  const [pubs, books, sales] = await Promise.all([
    db.user.findMany({ where: { role: "PUBLISHER", status: { not: "DELETED" }, OR: [{ publisherName: { contains: s } }, { email: { contains: s } }, { firstName: { contains: s } }, { lastName: { contains: s } }] }, take: 6 }),
    db.book.findMany({ where: { status: { not: "DRAFT" }, OR: [{ title: { contains: s } }, { author: { contains: s } }] }, include: { publisher: true }, take: 6 }),
    db.sale.findMany({ where: { OR: [{ number: { contains: s } }] }, include: { book: true }, take: 6 }),
  ]);
  return { publishers: pubs.map((u) => ({ id: u.id, name: u.publisherName, email: u.email, status: u.status })), books: books.map((b) => ({ id: b.id, title: b.title, author: b.author, status: b.status, publisher: b.publisher.publisherName })), sales: sales.map((x) => ({ id: x.id, number: x.number, book: x.book.title, grossMinor: x.grossMinor, currency: x.currency })) };
});

on("PUT", "config", async ({ body }) => {
  const d = z.object({ key: z.enum(["categories", "minWithdrawals"]), value: z.any() }).parse(body);
  if (d.key === "categories") z.array(z.string().trim().min(1).max(60)).min(1).max(100).parse(d.value);
  else z.object({ NGN: z.number().int().positive(), USD: z.number().int().positive(), GBP: z.number().int().positive(), EUR: z.number().int().positive() }).parse(d.value);
  await db.platformConfig.upsert({ where: { key: d.key }, create: { key: d.key, value: JSON.stringify(d.value) }, update: { value: JSON.stringify(d.value) } });
  return { ok: true };
});

async function dispatch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const body = await verifyServiceRequest(req, process.env.PUBLISHER_ADMIN_SECRET);
  const path = (await params).path.join("/");
  for (const [method, re, h] of routes) {
    if (method !== req.method) continue;
    const m = path.match(re);
    if (m) {
      let json: any = {};
      if (body) { try { json = JSON.parse(body); } catch { throw new ApiError(400, "Invalid JSON body."); } }
      const out = await h({ q: req.nextUrl.searchParams, body: json, p: m.slice(1).map(decodeURIComponent) });
      return out instanceof Response ? out : NextResponse.json(out);
    }
  }
  throw new ApiError(404, "Unknown internal endpoint.");
}
const wrap = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => route(dispatch as any, { skipOrigin: true })(req, ctx as any);
export const GET = wrap, POST = wrap, PUT = wrap, PATCH = wrap, DELETE = wrap;
