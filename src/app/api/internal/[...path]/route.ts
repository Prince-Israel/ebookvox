import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { verifyServiceRequest } from "@/lib/service-auth";
import { currencyForCountry } from "@/lib/countries";
import { notify } from "@/lib/notify";
import { CURRENCIES } from "@/lib/countries";

// ---------------------------------------------------------------------------------------------
// Internal service API for the Ebookvox Admin platform. Every request must carry an HMAC-SHA256
// signature made with READER_ADMIN_SECRET (see lib/service-auth.ts). Nothing here is reachable
// with a browser session.
// ---------------------------------------------------------------------------------------------

type Ctx = { q: URLSearchParams; body: any; p: string[] };
type H = (c: Ctx) => Promise<unknown>;
const routes: Array<[string, RegExp, H]> = [];
const on = (method: string, pattern: string, h: H) => routes.push([method, new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`), h]);

const page = (q: URLSearchParams) => ({ skip: (Math.max(1, Number(q.get("page") ?? 1)) - 1) * Math.min(100, Number(q.get("pageSize") ?? 25)), take: Math.min(100, Number(q.get("pageSize") ?? 25)) });
const PLATFORM_PUBLISHERS = ["ebookvox-classics", "ebookvox-admin"];
const sourceOf = (publisherExternalId: string) => (PLATFORM_PUBLISHERS.includes(publisherExternalId) ? "READER" : "PUBLISHER");

function bucketing(range: string) {
  const days = { "7d": 7, "30d": 30, "3m": 90, "6m": 182, "1y": 365 }[range] ?? 30;
  const step = days <= 31 ? 1 : days <= 190 ? 7 : 30;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const keys: string[] = [];
  for (let t = start.getTime(); t <= Date.now() + 86400_000; t += step * 86400_000) keys.push(new Date(t).toISOString().slice(0, 10));
  const idx = (d: Date) => { const i = Math.floor((new Date(d.toDateString()).getTime() - start.getTime()) / (step * 86400_000)); return Math.min(keys.length - 1, Math.max(0, i)); };
  return { start, keys, idx };
}

on("GET", "health", async () => ({ ok: true, service: "reader", time: new Date().toISOString(), users: await db.user.count() }));

on("GET", "stats", async ({ q }) => {
  const { start, keys, idx } = bucketing(q.get("range") ?? "30d");
  const [byStatus, books, pendingBooks, ord, rev, regs, sessions, suspended] = await Promise.all([
    db.user.groupBy({ by: ["status"], where: { role: "USER" }, _count: true }),
    db.book.groupBy({ by: ["status"], _count: true }),
    db.book.count({ where: { status: "PENDING" } }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.groupBy({ by: ["currency"], where: { status: "PAID" }, _sum: { amountMinor: true }, _count: true }),
    db.user.findMany({ where: { role: "USER", createdAt: { gte: start } }, select: { createdAt: true } }),
    db.session.findMany({ where: { createdAt: { gte: start }, user: { role: "USER" } }, select: { createdAt: true, userId: true } }),
    db.user.findMany({ where: { role: "USER", suspendedAt: { gte: start } }, select: { suspendedAt: true } }),
  ]);
  const n = (rows: Array<{ status: string; _count: number }>, s?: string) => rows.filter((r) => !s || r.status === s).reduce((a, r) => a + r._count, 0);
  const series = keys.map((date) => ({ date, registrations: 0, active: 0, suspended: 0 }));
  const activeSets = keys.map(() => new Set<string>());
  regs.forEach((r) => series[idx(r.createdAt)].registrations++);
  sessions.forEach((s) => activeSets[idx(s.createdAt)].add(s.userId));
  suspended.forEach((s) => series[idx(s.suspendedAt!)].suspended++);
  series.forEach((s, i) => (s.active = activeSets[i].size));
  const catalogue = await db.book.findMany({ where: { status: "APPROVED" }, select: { category: true, publisher: { select: { externalId: true } } } });
  const cats: Record<string, number> = {};
  catalogue.forEach((b) => (cats[b.category] = (cats[b.category] ?? 0) + 1));
  const readerBooks = await db.book.count({ where: { publisher: { externalId: { in: PLATFORM_PUBLISHERS } } } });
  return {
    users: { total: n(byStatus) - n(byStatus, "DELETED"), active: n(byStatus, "ACTIVE"), suspended: n(byStatus, "SUSPENDED") },
    books: { total: n(books), approved: n(books, "APPROVED"), pending: pendingBooks, reader: readerBooks, publisher: n(books) - readerBooks },
    orders: { total: n(ord), paid: n(ord, "PAID"), pending: n(ord, "PENDING"), failed: n(ord, "FAILED") },
    revenue: rev.map((r) => ({ currency: r.currency, grossMinor: r._sum.amountMinor ?? 0, sales: r._count })),
    categories: Object.entries(cats).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    series,
  };
});

// ---- users ----
const userRow = (u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, country: u.country, currency: u.currency, status: u.status, emailVerified: !!u.emailVerifiedAt, createdAt: u.createdAt, suspendedAt: u.suspendedAt });

on("GET", "users", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { role: "USER", status: q.get("status") ?? { not: "DELETED" }, ...(s ? { OR: [{ firstName: { contains: s } }, { lastName: { contains: s } }, { email: { contains: s } }, { phone: { contains: s } }] } : {}) };
  const [rows, total] = await Promise.all([db.user.findMany({ where, orderBy: { createdAt: "desc" }, include: { _count: { select: { orders: true } } }, ...page(q) }), db.user.count({ where })]);
  const ids = rows.map((r) => r.id);
  const purchased = await db.userBook.groupBy({ by: ["userId"], where: { userId: { in: ids }, source: "PURCHASE" }, _count: true });
  return { total, users: rows.map((u) => ({ ...userRow(u), orders: u._count.orders, purchasedBooks: purchased.find((p) => p.userId === u.id)?._count ?? 0 })) };
});

on("GET", "users/:id", async ({ p }) => {
  const u = await db.user.findFirst({ where: { id: p[0], role: "USER" }, include: { orders: { include: { book: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 100 }, library: { include: { book: { select: { id: true, title: true, author: true } } }, orderBy: { addedAt: "desc" } }, tickets: { orderBy: { updatedAt: "desc" } } } });
  if (!u) throw new ApiError(404, "User not found.");
  const activity = [
    { at: u.createdAt, text: "Registered an account" },
    ...u.library.map((l) => ({ at: l.addedAt, text: `${l.source === "PURCHASE" ? "Purchased" : "Added free book"}: ${l.book.title}` })),
    ...u.library.filter((l) => l.lastOpenedAt).map((l) => ({ at: l.lastOpenedAt!, text: `Read “${l.book.title}” (${Math.round(l.percent)}%)` })),
    ...u.orders.map((o) => ({ at: o.createdAt, text: `Order ${o.number}: ${o.status}` })),
    ...u.tickets.map((t) => ({ at: t.createdAt, text: `Opened support ticket “${t.subject}”` })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 60);
  return {
    user: { ...userRow(u), phoneCountry: u.phoneCountry },
    orders: u.orders.map((o) => ({ id: o.id, number: o.number, reference: o.reference, status: o.status, amountMinor: o.amountMinor, currency: o.currency, createdAt: o.createdAt, book: o.book })),
    library: u.library.map((l) => ({ bookId: l.bookId, title: l.book.title, author: l.book.author, source: l.source, percent: l.percent, addedAt: l.addedAt, lastOpenedAt: l.lastOpenedAt })),
    tickets: u.tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updatedAt })),
    activity,
  };
});

on("PATCH", "users/:id", async ({ p, body }) => {
  const d = z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().max(60), phone: z.string().trim().max(30).nullable(), country: z.string().length(2), email: z.string().trim().toLowerCase().email() }).partial().parse(body);
  const u = await db.user.findFirst({ where: { id: p[0], role: "USER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "User not found.");
  if (d.email && d.email !== u.email && (await db.user.findUnique({ where: { email: d.email } }))) throw new ApiError(409, "Another account already uses that email.");
  const upd = await db.user.update({ where: { id: u.id }, data: { ...d, ...(d.country ? { currency: currencyForCountry(d.country) } : {}), ...(d.email && d.email !== u.email ? { emailVerifiedAt: null } : {}) } });
  await notify(u.id, "ACCOUNT_UPDATE", "Account updated", "An administrator updated your account details.", "/profile");
  return { user: userRow(upd) };
});

on("POST", "users/:id/status", async ({ p, body }) => {
  const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse(body);
  const u = await db.user.findFirst({ where: { id: p[0], role: "USER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "User not found.");
  await db.user.update({ where: { id: u.id }, data: { status, suspendedAt: status === "SUSPENDED" ? new Date() : null } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId: u.id } });
  else await notify(u.id, "ACCOUNT_UPDATE", "Account reactivated", "Your account is active again.", "/home");
  return { id: u.id, status };
});

on("DELETE", "users/:id", async ({ p }) => {
  const u = await db.user.findFirst({ where: { id: p[0], role: "USER", status: { not: "DELETED" } } });
  if (!u) throw new ApiError(404, "User not found.");
  // Orders are financial records and are kept; everything personal is erased.
  await db.$transaction([
    db.session.deleteMany({ where: { userId: u.id } }), db.account.deleteMany({ where: { userId: u.id } }), db.authToken.deleteMany({ where: { userId: u.id } }),
    db.notification.deleteMany({ where: { userId: u.id } }), db.document.deleteMany({ where: { userId: u.id } }), db.avatar.deleteMany({ where: { userId: u.id } }),
    db.userBook.deleteMany({ where: { userId: u.id } }),
    db.user.update({ where: { id: u.id }, data: { status: "DELETED", email: `deleted-${u.id}@deleted.invalid`, firstName: "Deleted", lastName: "User", phone: null, passwordHash: null, avatarUpdatedAt: null } }),
  ]);
  return { id: u.id, deleted: true };
});

// ---- books ----
const bookRow = (b: any) => ({
  id: b.id, externalId: b.externalId, title: b.title, author: b.author, category: b.category, description: b.description, status: b.status, isFree: b.isFree,
  source: sourceOf(b.publisher.externalId), publisher: b.publisher.name, publisherId: b.publisher.externalId, coverUrl: b.coverUrl, coverHue: b.coverHue,
  chapterCount: b.chapterCount, totalChars: b.totalChars, createdAt: b.createdAt, approvedAt: b.approvedAt,
  prices: Object.fromEntries(b.prices.map((x: any) => [x.currency, x.amountMinor])),
});

on("GET", "books", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { ...(q.get("status") ? { status: q.get("status") } : {}), ...(q.get("source") === "READER" ? { publisher: { externalId: { in: PLATFORM_PUBLISHERS } } } : q.get("source") === "PUBLISHER" ? { publisher: { externalId: { notIn: PLATFORM_PUBLISHERS } } } : {}), ...(s ? { OR: [{ title: { contains: s } }, { author: { contains: s } }, { category: { contains: s } }] } : {}) };
  const [rows, total] = await Promise.all([db.book.findMany({ where, include: { publisher: true, prices: true, _count: { select: { userBooks: true, orders: true } } }, orderBy: { createdAt: "desc" }, ...page(q) }), db.book.count({ where })]);
  const sold = await db.order.groupBy({ by: ["bookId"], where: { status: "PAID", bookId: { in: rows.map((r) => r.id) } }, _count: true });
  return { total, books: rows.map((b) => ({ ...bookRow(b), owners: b._count.userBooks, orders: b._count.orders, sold: sold.find((x) => x.bookId === b.id)?._count ?? 0 })) };
});

on("GET", "books/:id", async ({ p }) => {
  const b = await db.book.findFirst({ where: { OR: [{ id: p[0] }, { externalId: p[0] }] }, include: { publisher: true, prices: true, _count: { select: { userBooks: true, orders: true } } } });
  if (!b) throw new ApiError(404, "Book not found.");
  const paid = await db.order.aggregate({ where: { bookId: b.id, status: "PAID" }, _count: true, _sum: { amountMinor: true } });
  return { book: { ...bookRow(b), owners: b._count.userBooks, orders: b._count.orders, paidOrders: paid._count } };
});

on("PATCH", "books/:id", async ({ p, body }) => {
  const d = z.object({
    title: z.string().trim().min(1).max(200), author: z.string().trim().min(1).max(150), category: z.string().trim().min(1).max(60), description: z.string().trim().min(10).max(5000),
    status: z.enum(["APPROVED", "ARCHIVED"]), prices: z.record(z.string(), z.number().int().positive().max(100_000_000)),
  }).partial().parse(body);
  const b = await db.book.findFirst({ where: { OR: [{ id: p[0] }, { externalId: p[0] }] }, include: { prices: true } });
  if (!b) throw new ApiError(404, "Book not found.");
  const baseCur = b.baseCurrency ?? b.prices[0]?.currency;
  if (d.prices && !b.isFree && baseCur && !(d.prices[baseCur] > 0)) throw new ApiError(400, `The price is set in ${baseCur} (the publisher's currency); other currencies are converted automatically.`);
  await db.$transaction(async (t) => {
    const { prices, ...rest } = d;
    await t.book.update({ where: { id: b.id }, data: { ...rest, ...(d.status === "APPROVED" && !b.approvedAt ? { approvedAt: new Date() } : {}) } });
    if (prices && !b.isFree && baseCur) for (const [currency, amountMinor] of Object.entries(prices)) if (currency === baseCur) await t.bookPrice.upsert({ where: { bookId_currency: { bookId: b.id, currency } }, create: { bookId: b.id, currency, amountMinor }, update: { amountMinor } });
  });
  return { id: b.id };
});

on("DELETE", "books/:id", async ({ p, q }) => {
  const b = await db.book.findFirst({ where: { OR: [{ id: p[0] }, { externalId: p[0] }] }, include: { publisher: true } });
  if (!b) throw new ApiError(404, "Book not found.");
  const paid = await db.order.count({ where: { bookId: b.id, status: "PAID" } });
  if (q.get("archive") === "1") { await db.book.update({ where: { id: b.id }, data: { status: "ARCHIVED" } }); return { id: b.id, archived: true }; }
  if (paid > 0) throw new ApiError(409, `This book has ${paid} paid order${paid === 1 ? "" : "s"}, so readers own it. Archive it instead — it disappears from the catalogue and readers keep access.`);
  await db.$transaction(async (t) => {
    await t.userBook.deleteMany({ where: { bookId: b.id } });
    await t.order.deleteMany({ where: { bookId: b.id } }); // only unpaid (pending / failed) attempts remain
    await t.book.delete({ where: { id: b.id } }); // chapters + prices cascade
    if ((await t.book.count({ where: { publisherId: b.publisherId } })) === 0) await t.publisher.delete({ where: { id: b.publisherId } });
  });
  return { id: b.id, deleted: true };
});

// ---- orders ----
const orderRow = (o: any) => ({ id: o.id, number: o.number, reference: o.reference, status: o.status, amountMinor: o.amountMinor, currency: o.currency, channel: o.channel, failureReason: o.failureReason, createdAt: o.createdAt, paidAt: o.paidAt, user: { id: o.user.id, name: `${o.user.firstName} ${o.user.lastName}`.trim(), email: o.user.email }, book: { id: o.book.id, title: o.book.title, externalId: o.book.externalId, publisher: o.book.publisher.name, publisherId: o.book.publisher.externalId } });
on("GET", "orders", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = {
    ...(q.get("status") ? { status: q.get("status") } : {}), ...(q.get("currency") ? { currency: q.get("currency") } : {}),
    ...(q.get("from") || q.get("to") ? { createdAt: { ...(q.get("from") ? { gte: new Date(q.get("from")!) } : {}), ...(q.get("to") ? { lte: new Date(q.get("to")!) } : {}) } } : {}),
    ...(q.get("publisherId") ? { book: { publisher: { externalId: q.get("publisherId") } } } : {}),
    ...(s ? { OR: [{ number: { contains: s } }, { reference: { contains: s } }, { user: { email: { contains: s } } }, { book: { title: { contains: s } } }] } : {}),
  };
  const [rows, total] = await Promise.all([db.order.findMany({ where, include: { user: true, book: { include: { publisher: true } } }, orderBy: { createdAt: "desc" }, ...page(q) }), db.order.count({ where })]);
  return { total, orders: rows.map(orderRow) };
});
on("GET", "orders/:id", async ({ p }) => {
  const o = await db.order.findFirst({ where: { OR: [{ id: p[0] }, { number: p[0] }, { reference: p[0] }] }, include: { user: true, book: { include: { publisher: true } } } });
  if (!o) throw new ApiError(404, "Order not found.");
  return { order: orderRow(o) };
});

// ---- support ----
const ticketRow = (t: any) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, name: `${t.user.firstName} ${t.user.lastName}`.trim(), email: t.user.email, userId: t.user.id, lastMessage: t.messages?.[0]?.body || "📷 Photo", lastFrom: t.messages?.[0]?.authorRole ?? "USER" });
on("GET", "tickets", async ({ q }) => {
  const s = q.get("q")?.trim();
  const where: any = { ...(q.get("status") ? { status: q.get("status") } : {}), ...(q.get("userId") ? { userId: q.get("userId") } : {}), ...(s ? { OR: [{ subject: { contains: s } }, { user: { email: { contains: s } } }] } : {}) };
  const [rows, total] = await Promise.all([db.ticket.findMany({ where, include: { user: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, ...page(q) }), db.ticket.count({ where })]);
  return { total, tickets: rows.map(ticketRow) };
});
on("GET", "tickets/attachments/:id", async ({ p }) => {
  const a = await db.ticketAttachment.findUnique({ where: { id: p[0] } });
  if (!a) throw new ApiError(404, "Photo not found.");
  return new Response(new Uint8Array(a.data), { headers: { "content-type": a.mime, "cache-control": "private, max-age=300" } });
});
on("GET", "tickets/:id", async ({ p }) => {
  const t = await db.ticket.findUnique({ where: { id: p[0] }, include: { user: true, messages: { orderBy: { createdAt: "asc" }, include: { attachments: { select: { id: true, name: true } } } } } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  return { ticket: { ...ticketRow(t), messages: t.messages.map((m) => ({ id: m.id, from: m.authorRole === "ADMIN" ? "ADMIN" : "USER", body: m.body, createdAt: m.createdAt, attachments: m.attachments.map((a) => ({ id: a.id, name: a.name })), author: m.authorRole === "ADMIN" ? (m.authorId.startsWith("admin:") ? m.authorId.slice(6) : "Support") : `${t.user.firstName} ${t.user.lastName}`.trim() })) } };
});
on("POST", "tickets/:id/reply", async ({ p, body }) => {
  const d = z.object({ message: z.string().trim().min(1).max(5000), adminName: z.string().max(100).default("Support") }).parse(body);
  const t = await db.ticket.findUnique({ where: { id: p[0] } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed, so it can't receive replies. Reopen it first.");
  await db.$transaction([db.ticketMessage.create({ data: { ticketId: t.id, authorId: `admin:${d.adminName}`, authorRole: "ADMIN", body: d.message } }), db.ticket.update({ where: { id: t.id }, data: { status: "WAITING_USER" } })]);
  await notify(t.userId, "SUPPORT_REPLY", "Support replied to your ticket", `Re: ${t.subject}`, `/support/${t.id}`);
  return { id: t.id, status: "WAITING_USER" };
});
on("POST", "tickets/:id/status", async ({ p, body }) => {
  const { status } = z.object({ status: z.enum(["OPEN", "WAITING_USER", "CLOSED"]) }).parse(body);
  const t = await db.ticket.findUnique({ where: { id: p[0] } });
  if (!t) throw new ApiError(404, "Ticket not found.");
  await db.ticket.update({ where: { id: t.id }, data: { status } });
  if (status === "CLOSED") await notify(t.userId, "SUPPORT_REPLY", "Your ticket was closed", `Re: ${t.subject}`, `/support/${t.id}`);
  return { id: t.id, status };
});

// ---- feed, search, config ----
on("GET", "events", async ({ q }) => {
  const after = Number(q.get("after") ?? 0);
  const rows = await db.serviceEvent.findMany({ where: { id: { gt: after } }, orderBy: { id: "asc" }, take: 200 });
  const last = await db.serviceEvent.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  return { events: rows.map((e) => ({ id: e.id, type: e.type, at: e.createdAt, data: JSON.parse(e.payload) })), latest: last?.id ?? 0 };
});

on("GET", "search", async ({ q }) => {
  const s = (q.get("q") ?? "").trim();
  if (s.length < 2) return { users: [], books: [], orders: [] };
  const [users, books, orders] = await Promise.all([
    db.user.findMany({ where: { role: "USER", status: { not: "DELETED" }, OR: [{ firstName: { contains: s } }, { lastName: { contains: s } }, { email: { contains: s } }, { phone: { contains: s } }] }, take: 6 }),
    db.book.findMany({ where: { OR: [{ title: { contains: s } }, { author: { contains: s } }] }, include: { publisher: true }, take: 6 }),
    db.order.findMany({ where: { OR: [{ number: { contains: s } }, { reference: { contains: s } }] }, include: { book: true, user: true }, take: 6 }),
  ]);
  return {
    users: users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, status: u.status })),
    books: books.map((b) => ({ id: b.id, title: b.title, author: b.author, status: b.status, source: sourceOf(b.publisher.externalId) })),
    orders: orders.map((o) => ({ id: o.id, number: o.number, reference: o.reference, status: o.status, amountMinor: o.amountMinor, currency: o.currency, book: o.book.title, buyer: o.user.email })),
  };
});

on("PUT", "config", async ({ body }) => {
  const d = z.object({ key: z.enum(["defaultVoice"]), value: z.string().min(1).max(100) }).parse(body);
  await db.platformConfig.upsert({ where: { key: d.key }, create: d, update: { value: d.value } });
  return { ok: true };
});

async function dispatch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const body = await verifyServiceRequest(req, process.env.READER_ADMIN_SECRET);
  const p = (await params).path;
  const path = p.join("/");
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
