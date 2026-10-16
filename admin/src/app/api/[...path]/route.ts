import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";
import { db } from "@/lib/db";
import { ApiError, rateLimit, route } from "@/lib/api";
import { createSession, destroySession, hashPassword, publicAdmin, requireAdmin, requirePermission, requireSuper, verifyPassword, getAdmin, type Admin } from "@/lib/auth";
import { ALL_PERMISSIONS, PERMISSIONS, ROLES, ROLE_DEFAULTS, permsOf, type Permission } from "@/lib/rbac";
import { ServiceError, health, publisher, reader, settle, serviceLabel } from "@/lib/services";
import { logActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notify";
import { pollEvents } from "@/lib/events";
import { getSettings, saveSetting, APP_VERSION, DEVELOPER, COPYRIGHT } from "@/lib/settings";
import { emailSchema, passwordSchema, phoneSchema } from "@/lib/validation";
import { sniffImage } from "@/lib/images";
import { formatMoney } from "@/lib/money";

// =====================================================================================
// Every Admin API route lives here, each declaring the permission it needs. The check
// happens on the server for every request; the UI's hidden menu items are cosmetic.
// =====================================================================================

type Guard = "public" | "auth" | "super" | Permission | Permission[];
type Ctx = { q: URLSearchParams; body: any; p: string[]; admin: Admin; req: NextRequest };
type H = (c: Ctx) => Promise<unknown>;
const table: Array<{ method: string; re: RegExp; guard: Guard; h: H }> = [];
const on = (method: string, pattern: string, guard: Guard, h: H) => table.push({ method, re: new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}$`), guard, h });
const qp = (q: URLSearchParams, ...keys: string[]) => Object.fromEntries(keys.map((k) => [k, q.get(k) ?? undefined]));
const sensitive = (a: Admin, what: string, max = 30) => rateLimit(`sens:${what}:${a.id}`, max, 60_000);
const ok = { ok: true };

// ------------------------------------------------------------------ auth & profile
on("POST", "auth/login", "public", async ({ body, req }) => {
  const d = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") }).parse(body);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  rateLimit(`login:${ip}:${d.email}`, 6, 15 * 60_000);
  const a = await db.adminUser.findUnique({ where: { email: d.email } });
  const good = await verifyPassword(d.password, a?.passwordHash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5zsGZ1ZrVWuRz6C5rYQ8JpV5B4h4j8y");
  if (!a || !good) throw new ApiError(401, "Incorrect email or password.");
  if (a.status !== "ACTIVE") throw new ApiError(403, "This administrator account is suspended. Contact a Super Admin.");
  await db.adminUser.update({ where: { id: a.id }, data: { lastLoginAt: new Date() } });
  await createSession(a.id);
  await logActivity(a, "Signed in", "Session");
  return { admin: publicAdmin(a) };
});
on("POST", "auth/logout", "public", async () => { const a = await getAdmin(); if (a) await logActivity(a, "Signed out", "Session"); await destroySession(); return ok; });

on("GET", "me", "auth", async ({ admin }) => ({ admin: publicAdmin(admin), unread: await db.adminNotification.count({ where: { adminId: admin.id, readAt: null } }) }));
on("PATCH", "me", "auth", async ({ admin, body }) => {
  const d = z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema, jobTitle: z.string().trim().max(80), bio: z.string().trim().max(1000), theme: z.enum(["light", "dark", "system"]) }).partial().parse(body);
  const u = await db.adminUser.update({ where: { id: admin.id }, data: d });
  if (Object.keys(d).some((k) => k !== "theme")) await logActivity(admin, "Updated own profile", "Admin", admin.id, admin.name);
  return { admin: publicAdmin(u) };
});
on("POST", "me/password", "auth", async ({ admin, body }) => {
  rateLimit(`chpw:${admin.id}`, 6, 15 * 60_000);
  const d = z.object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: passwordSchema, confirmPassword: z.string() }).parse(body);
  if (d.newPassword !== d.confirmPassword) throw new ApiError(400, "Passwords do not match.", { confirmPassword: "Passwords do not match." });
  if (!(await verifyPassword(d.currentPassword, admin.passwordHash))) throw new ApiError(400, "Your current password is incorrect.", { currentPassword: "Incorrect password." });
  if (await verifyPassword(d.newPassword, admin.passwordHash)) throw new ApiError(400, "Choose a password you haven't used.", { newPassword: "Must be different from the current password." });
  await db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(d.newPassword), mustChangePassword: false } });
  await logActivity(admin, "Changed own password", "Admin", admin.id, admin.name);
  return ok;
});
on("POST", "me/avatar", "auth", async ({ admin, req }) => {
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Choose a photo to upload.");
  if (file.size > 6 * 1024 * 1024) throw new ApiError(413, "That photo is too large (6 MB max).");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(buf)) throw new ApiError(415, "Please upload a JPG, PNG or WebP image.");
  let data: Buffer;
  try { data = await sharp(buf).rotate().resize(512, 512, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer(); } catch { throw new ApiError(415, "We couldn't read that image."); }
  await db.adminAvatar.upsert({ where: { adminId: admin.id }, create: { adminId: admin.id, mime: "image/jpeg", data: new Uint8Array(data) }, update: { mime: "image/jpeg", data: new Uint8Array(data) } });
  const now = new Date();
  await db.adminUser.update({ where: { id: admin.id }, data: { avatarUpdatedAt: now } });
  return { avatarUpdatedAt: now.toISOString() };
});
on("DELETE", "me/avatar", "auth", async ({ admin }) => { await db.adminAvatar.deleteMany({ where: { adminId: admin.id } }); await db.adminUser.update({ where: { id: admin.id }, data: { avatarUpdatedAt: null } }); return ok; });
on("GET", "avatar/:id", "auth", async ({ p }) => {
  const a = await db.adminAvatar.findUnique({ where: { adminId: p[0] } });
  if (!a) throw new ApiError(404, "No photo.");
  return new Response(new Uint8Array(a.data), { headers: { "content-type": a.mime, "cache-control": "private, max-age=31536000, immutable" } });
});

// ------------------------------------------------------------------ status, dashboard, search
on("GET", "status", "auth", async () => ({ services: await health(), version: APP_VERSION }));

on("GET", "dashboard", "auth", async ({ admin, q }) => {
  const mine = permsOf(admin), has = (...p: Permission[]) => admin.role === "SUPER_ADMIN" || p.some((x) => mine.includes(x));
  const range = q.get("range") ?? "30d";
  const needReader = has("users", "orders", "books", "analytics", "transactions");
  const needPub = has("publishers", "sales", "books", "book_review", "analytics", "payouts");
  const [r, p, recentR, recentP] = await Promise.all([
    needReader ? settle("reader", () => reader("GET", "stats", { query: { range } })) : null,
    needPub ? settle("publisher", () => publisher("GET", "stats", { query: { range } })) : null,
    has("books", "analytics") ? settle("reader", () => reader("GET", "books", { query: { pageSize: 8 } })) : null,
    has("books", "book_review", "analytics") ? settle("publisher", () => publisher("GET", "books", { query: { pageSize: 8, sort: "recent" } })) : null,
  ]);
  void pollEvents();
  return { range, allowed: { users: has("users", "analytics"), publishers: has("publishers", "analytics"), books: has("books", "analytics"), orders: has("orders", "analytics", "transactions"), revenue: has("transactions", "analytics", "sales", "orders"), charts: has("analytics", "users") }, reader: r, publisher: p, recentReader: recentR, recentPublisher: recentP };
});

on("GET", "search", "auth", async ({ admin, q }) => {
  const s = (q.get("q") ?? "").trim();
  const mine = permsOf(admin), has = (...p: Permission[]) => admin.role === "SUPER_ADMIN" || p.some((x) => mine.includes(x));
  if (s.length < 2) return { results: [], unavailable: [] };
  const results: Array<{ type: string; title: string; meta: string; link: string }> = [];
  const unavailable: string[] = [];
  const [r, p] = await Promise.all([
    has("users", "books", "orders", "transactions") ? settle("reader", () => reader("GET", "search", { query: { q: s } })) : null,
    has("publishers", "books", "sales", "authors", "transactions") ? settle("publisher", () => publisher("GET", "search", { query: { q: s } })) : null,
  ]);
  const authors = new Set<string>();
  if (r) { if (!r.ok) unavailable.push(serviceLabel("reader")); else {
    if (has("users")) r.data.users.forEach((u: any) => results.push({ type: "User", title: u.name, meta: `${u.email} · ${u.status}`, link: `/users/${u.id}` }));
    if (has("books")) r.data.books.forEach((b: any) => { results.push({ type: "Book", title: b.title, meta: `${b.author} · ${b.source === "PUBLISHER" ? "Publisher" : "Reader"} · ${b.status}`, link: `/books/${b.id}` }); authors.add(b.author); });
    if (has("orders", "transactions")) r.data.orders.forEach((o: any) => results.push({ type: "Order", title: o.number, meta: `${o.book} · ${formatMoney(o.amountMinor, o.currency)} · ${o.status}`, link: `/transactions?q=${encodeURIComponent(o.number)}` }));
  } }
  if (p) { if (!p.ok) unavailable.push(serviceLabel("publisher")); else {
    if (has("publishers")) p.data.publishers.forEach((u: any) => results.push({ type: "Publisher", title: u.name, meta: `${u.email} · ${u.status}`, link: `/publishers/${u.id}` }));
    if (has("book_review", "books")) p.data.books.forEach((b: any) => { results.push({ type: "Publisher book", title: b.title, meta: `${b.author} · ${b.publisher} · ${b.status}`, link: b.status === "REVIEWING" ? "/book-review" : "/publisher-books" }); authors.add(b.author); });
    if (has("sales", "transactions")) p.data.sales.forEach((x: any) => results.push({ type: "Transaction", title: x.number, meta: `${x.book} · ${formatMoney(x.grossMinor, x.currency)}`, link: `/transactions?q=${encodeURIComponent(x.number)}` }));
  } }
  if (has("authors")) authors.forEach((a) => results.push({ type: "Author", title: a, meta: "Author", link: `/authors?q=${encodeURIComponent(a)}` }));
  return { results, unavailable };
});

// ------------------------------------------------------------------ users
on("GET", "users", "users", async ({ q }) => reader("GET", "users", { query: qp(q, "q", "status", "page", "pageSize") }));
on("GET", "users/:id", "users", async ({ p }) => reader("GET", `users/${p[0]}`));
on("PATCH", "users/:id", "users", async ({ admin, p, body }) => {
  sensitive(admin, "user-edit");
  const r = await reader("PATCH", `users/${p[0]}`, { body });
  await logActivity(admin, "Edited user", "User", p[0], r.user?.name);
  return r;
});
on("POST", "users/:id/status", "users", async ({ admin, p, body }) => {
  sensitive(admin, "user-status");
  const r = await reader("POST", `users/${p[0]}/status`, { body });
  const u = await reader("GET", `users/${p[0]}`).catch(() => null);
  await logActivity(admin, body.status === "SUSPENDED" ? "Suspended user" : "Activated user", "User", p[0], u?.user?.name);
  return r;
});
on("DELETE", "users/:id", "users", async ({ admin, p }) => {
  sensitive(admin, "user-delete", 10);
  const u = await reader("GET", `users/${p[0]}`).catch(() => null);
  const r = await reader("DELETE", `users/${p[0]}`);
  await logActivity(admin, "Deleted user", "User", p[0], u?.user?.name ?? p[0]);
  return r;
});

// ------------------------------------------------------------------ publishers
on("GET", "publishers", "publishers", async ({ q }) => publisher("GET", "publishers", { query: qp(q, "q", "status", "page", "pageSize") }));
on("GET", "publishers/:id", "publishers", async ({ p }) => publisher("GET", `publishers/${p[0]}`));
on("PATCH", "publishers/:id", "publishers", async ({ admin, p, body }) => {
  sensitive(admin, "pub-edit");
  const r = await publisher("PATCH", `publishers/${p[0]}`, { body });
  await logActivity(admin, "Edited publisher", "Publisher", p[0], r.publisher?.name);
  return r;
});
on("POST", "publishers/:id/status", "publishers", async ({ admin, p, body }) => {
  sensitive(admin, "pub-status");
  const r = await publisher("POST", `publishers/${p[0]}/status`, { body });
  const u = await publisher("GET", `publishers/${p[0]}`).catch(() => null);
  await logActivity(admin, body.status === "SUSPENDED" ? "Suspended publisher" : "Activated publisher", "Publisher", p[0], u?.publisher?.name);
  return r;
});
on("DELETE", "publishers/:id", "publishers", async ({ admin, p }) => {
  sensitive(admin, "pub-delete", 10);
  const u = await publisher("GET", `publishers/${p[0]}`).catch(() => null);
  const r = await publisher("DELETE", `publishers/${p[0]}`);
  await logActivity(admin, "Deleted publisher", "Publisher", p[0], u?.publisher?.name ?? p[0]);
  return r;
});

// ------------------------------------------------------------------ authors
on("GET", "authors", "authors", async ({ q }) => {
  const [pubA, readerBooks] = await Promise.all([
    settle("publisher", () => publisher("GET", "authors")),
    settle("reader", async () => { const all: any[] = []; for (let page = 1; page <= 10; page++) { const r = await reader("GET", "books", { query: { source: "READER", pageSize: 100, page } }); all.push(...r.books); if (all.length >= r.total) break; } return all; }),
  ]);
  const unavailable = [!pubA.ok && "Publisher", !readerBooks.ok && "Reader"].filter(Boolean) as string[];
  const rows: any[] = pubA.ok ? pubA.data.authors.map((a: any) => ({ ...a, source: "Publisher", sales: a.sales })) : [];
  if (readerBooks.ok) {
    const m = new Map<string, any>();
    for (const b of readerBooks.data) {
      const a = m.get(b.author.toLowerCase()) ?? { author: b.author, publisher: b.publisher, publisherId: b.publisherId, registeredAt: null, bio: "", books: 0, published: 0, sales: 0, gross: {}, source: "Reader" };
      a.books++; if (b.status === "APPROVED") a.published++; a.sales += b.sold ?? 0;
      m.set(b.author.toLowerCase(), a);
    }
    rows.push(...m.values());
  }
  const s = q.get("q")?.trim().toLowerCase();
  const filtered = s ? rows.filter((a) => a.author.toLowerCase().includes(s) || a.publisher.toLowerCase().includes(s)) : rows;
  return { authors: filtered.sort((a, b) => b.books - a.books || a.author.localeCompare(b.author)), unavailable };
});

// ------------------------------------------------------------------ books
on("GET", "books", "books", async ({ q }) => reader("GET", "books", { query: qp(q, "q", "status", "source", "page", "pageSize") }));
on("GET", "books/:id", "books", async ({ p }) => {
  const r = await reader("GET", `books/${p[0]}`);
  let pub = null, warning: string | undefined;
  if (r.book.source === "PUBLISHER" && r.book.externalId) { try { pub = (await publisher("GET", `books/${r.book.externalId}`)).book; } catch (e) { warning = (e as Error).message; } }
  return { ...r, publisherBook: pub, warning };
});
on("PATCH", "books/:id", "books", async ({ admin, p, body }) => {
  sensitive(admin, "book-edit");
  const cur = (await reader("GET", `books/${p[0]}`)).book;
  let warning: string | undefined;
  if (cur.source === "PUBLISHER" && cur.externalId) {
    // The Publisher platform owns these books: edit there and it re-publishes the change to the Reader.
    const { status, ...rest } = body;
    const r = await publisher("PATCH", `books/${cur.externalId}`, { body: rest });
    warning = r.warning;
    if (status) await reader("PATCH", `books/${p[0]}`, { body: { status } });
  } else await reader("PATCH", `books/${p[0]}`, { body });
  await logActivity(admin, "Edited book", "Book", p[0], cur.title);
  return { ok: true, warning };
});
on("DELETE", "books/:id", "books", async ({ admin, p, q }) => {
  sensitive(admin, "book-delete", 10);
  const archive = q.get("archive") === "1";
  const cur = (await reader("GET", `books/${p[0]}`)).book;
  let r: any;
  try { r = await reader("DELETE", `books/${p[0]}`, { query: { archive: archive ? "1" : undefined } }); }
  catch (e) { if (e instanceof ServiceError && e.status === 409) throw new ApiError(409, e.message, { code: "HAS_SALES" }); throw e; }
  let warning: string | undefined;
  if (cur.source === "PUBLISHER" && cur.externalId) {
    try { await publisher("DELETE", `books/${cur.externalId}`); } catch (e) { warning = `Removed from the Reader, but the Publisher record could not be updated: ${(e as Error).message}`; }
  }
  await logActivity(admin, archive ? "Archived book" : "Deleted book", "Book", p[0], cur.title);
  return { ...r, warning };
});

on("GET", "publisher-books", ["books", "book_review"], async ({ q }) => publisher("GET", "books", { query: { ...qp(q, "q", "page", "pageSize"), status: "APPROVED,PUBLISHED" } }));

// ------------------------------------------------------------------ book review (moderation queue)
on("GET", "book-review", "book_review", async ({ q }) => {
  const f = q.get("filter") ?? "pending";
  const status = { pending: "REVIEWING", approved: "APPROVED", rejected: "REJECTED", all: "REVIEWING,APPROVED,PUBLISHED,REJECTED" }[f] ?? "REVIEWING";
  return publisher("GET", "books", { query: { ...qp(q, "q", "page", "pageSize"), status } });
});
on("GET", "book-review/:id", "book_review", async ({ p }) => publisher("GET", `books/${p[0]}`));
on("GET", "book-review/:id/cover", ["book_review", "books"], async ({ p }) => {
  const res = await publisher<Response>("GET", `books/${p[0]}/cover`, { raw: true });
  return new Response(res.body, { headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg", "cache-control": "private, max-age=300" } });
});
on("GET", "book-review/:id/file", "book_review", async ({ admin, p }) => {
  const res = await publisher<Response>("GET", `books/${p[0]}/file`, { raw: true });
  await logActivity(admin, "Downloaded book file for review", "Book", p[0]);
  return new Response(res.body, { headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "content-disposition": res.headers.get("content-disposition") ?? "attachment" } });
});
on("POST", "book-review/:id/decision", "book_review", async ({ admin, p, body }) => {
  sensitive(admin, "book-review", 40);
  const d = z.object({ action: z.enum(["approve", "reject", "sync"]), reason: z.string().trim().max(500).optional() }).parse(body);
  if (d.action === "reject" && (!d.reason || d.reason.length < 5)) throw new ApiError(400, "Give the publisher a reason for the rejection (at least 5 characters).", { reason: "Required." });
  const bk = (await publisher("GET", `books/${p[0]}`)).book;
  const r = await publisher("POST", `books/${p[0]}/review`, { body: d });
  if (d.action === "reject") { await logActivity(admin, "Rejected book", "Book", p[0], bk.title, d.reason); await notifyAdmins("book_review", "BOOK_REJECTION", "Book rejected", `${admin.name} rejected “${bk.title}”.`, "/book-review"); }
  else { await logActivity(admin, d.action === "approve" ? "Approved book" : "Retried publishing book", "Book", p[0], bk.title); if (d.action === "approve") await notifyAdmins("book_review", "BOOK_APPROVAL", "Book approved", `${admin.name} approved “${bk.title}” (${r.status === "PUBLISHED" ? "live in Reader" : "sync pending"}).`, "/publisher-books"); }
  return r;
});

on("GET", "orders", ["orders", "transactions"], async ({ q }) => reader("GET", "orders", { query: qp(q, "q", "status", "currency", "from", "to", "page", "pageSize") }));

on("GET", "lookup/publishers", ["transactions", "sales", "payouts", "publishers"], async () => {
  const r = await publisher("GET", "publishers", { query: { pageSize: 100 } });
  return { publishers: r.publishers.map((x: any) => ({ id: x.id, name: x.name })) };
});

// ------------------------------------------------------------------ sales, payouts, transactions
on("GET", "sales", "sales", async ({ q }) => publisher("GET", "sales", { query: qp(q, "q", "publisherId", "currency", "status", "from", "to", "page", "pageSize") }));

on("GET", "commissions", "sales", async () => {
  const [totals, recent] = await Promise.all([
    db.commission.groupBy({ by: ["currency"], _sum: { feeMinor: true, grossMinor: true }, _count: true }),
    db.commission.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  return {
    totals: totals.map((t) => ({ currency: t.currency, count: t._count, feeMinor: t._sum.feeMinor ?? 0, grossMinor: t._sum.grossMinor ?? 0 })),
    recent: recent.map((c) => ({ orderId: c.orderId, number: c.orderNumber, book: c.book, publisher: c.publisher, currency: c.currency, grossMinor: c.grossMinor, feeMinor: c.feeMinor, createdAt: c.createdAt })),
  };
});

on("GET", "payouts", "payouts", async ({ q }) => {
  const status = q.get("status");
  if (status === "PENDING") return { total: 0, withdrawals: [] }; // requests move straight to Processing; nothing sits in "Pending"
  return publisher("GET", "withdrawals", { query: qp(q, "q", "status", "publisherId", "currency", "page", "pageSize") });
});
on("POST", "payouts/:id/process", "payouts", async ({ admin, p, body }) => {
  sensitive(admin, "payout", 20);
  const d = z.object({ action: z.enum(["paid", "reject"]), reason: z.string().trim().max(500).optional(), reference: z.string().trim().max(100).optional() }).parse(body);
  const w = (await publisher("GET", `withdrawals/${p[0]}`)).withdrawal;
  const r = await publisher("POST", `withdrawals/${p[0]}/process`, { body: { ...d, by: admin.email } });
  await logActivity(admin, d.action === "paid" ? "Marked payout Paid" : "Rejected payout", "Payout", p[0], `${w.number} · ${w.publisher.name} · ${formatMoney(w.amountMinor, w.currency)}`, d.action === "paid" ? `Reference ${d.reference}` : d.reason);
  return r;
});

on("GET", "transactions", "transactions", async ({ q }) => {
  const type = q.get("type"), status = q.get("status"), currency = q.get("currency"), pub = q.get("publisherId"), from = q.get("from"), to = q.get("to"), s = q.get("q");
  const page = Math.max(1, Number(q.get("page") ?? 1)), size = 25;
  const rows: any[] = [];
  const unavailable: string[] = [];
  const wantPurchase = !type || type === "PURCHASE" || type === "FAILED";
  const wantSale = (!type || type === "SALE") && !(status === "FAILED");
  const wantPayout = !type || type === "PAYOUT";
  // "Refund" is a supported type but the platform has no refund flow yet, so it is always (truthfully) empty.
  const [orders, sales, payouts] = await Promise.all([
    wantPurchase ? settle("reader", () => reader("GET", "orders", { query: { pageSize: 100, currency, from, to, q: s, publisherId: pub, status: type === "FAILED" ? "FAILED" : status === "PAID" || status === "PENDING" || status === "FAILED" ? status : undefined } })) : null,
    wantSale ? settle("publisher", () => publisher("GET", "sales", { query: { pageSize: 100, currency, from, to, q: s, publisherId: pub, status: status === "PAID" ? "PAID" : undefined } })) : null,
    wantPayout ? settle("publisher", () => publisher("GET", "withdrawals", { query: { pageSize: 100, currency, publisherId: pub, q: s, status: status === "PROCESSING" || status === "PAID" || status === "REJECTED" ? status : undefined } })) : null,
  ]);
  if (orders) { if (!orders.ok) unavailable.push("Reader"); else for (const o of orders.data.orders) {
    if (type === "SALE" || type === "PAYOUT") continue;
    rows.push({ id: o.number, kind: o.status === "FAILED" ? "FAILED_PAYMENT" : "PURCHASE", user: o.user.name, userEmail: o.user.email, book: o.book.title, publisher: o.book.publisher, publisherId: o.book.publisherId, amountMinor: o.amountMinor, currency: o.currency, provider: "Paystack", status: o.status, reference: o.reference, date: o.paidAt ?? o.createdAt });
  } }
  if (sales) { if (!sales.ok) unavailable.push("Publisher"); else for (const x of sales.data.sales) rows.push({ id: x.number, kind: "SALE", user: x.buyer, book: x.book.title, publisher: x.publisher.name, publisherId: x.publisher.id, amountMinor: x.publisherMinor, grossMinor: x.grossMinor, currency: x.currency, provider: "Platform ledger (85%)", status: x.status, date: x.paidAt }); }
  if (payouts) { if (!payouts.ok) { if (!unavailable.includes("Publisher")) unavailable.push("Publisher"); } else for (const w of payouts.data.withdrawals) rows.push({ id: w.number, kind: "PAYOUT", user: w.publisher.name, book: null, publisher: w.publisher.name, publisherId: w.publisher.id, amountMinor: w.amountMinor, currency: w.currency, provider: w.method === "BANK" ? "Bank transfer" : "PayPal", status: w.status, date: w.processedAt ?? w.requestedAt }); }
  let out = rows;
  if (type === "FAILED") out = out.filter((r) => r.kind === "FAILED_PAYMENT");
  if (type === "PURCHASE") out = out.filter((r) => r.kind === "PURCHASE");
  if (type === "REFUND") out = [];
  if (status && !["PAID", "PENDING", "FAILED", "PROCESSING", "REJECTED"].includes(status)) out = [];
  if (status) out = out.filter((r) => r.status === status);
  out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { total: out.length, transactions: out.slice((page - 1) * size, page * size), unavailable };
});

// ------------------------------------------------------------------ admins (Super Admin only)
const adminRow = (a: any) => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, permissions: permsOf(a), status: a.status, jobTitle: a.jobTitle, bio: a.bio, avatarUpdatedAt: a.avatarUpdatedAt, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt, mustChangePassword: a.mustChangePassword });
const roleEnum = z.enum(ROLES.map((r) => r[0]) as [string, ...string[]]);
const permList = z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).max(20);
on("GET", "admins", "super", async () => ({ admins: (await db.adminUser.findMany({ orderBy: { createdAt: "asc" } })).map(adminRow), roles: ROLES, permissions: PERMISSIONS, defaults: ROLE_DEFAULTS }));
on("POST", "admins", "super", async ({ admin, body }) => {
  const d = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, phone: phoneSchema, role: roleEnum, jobTitle: z.string().trim().max(80).default(""), bio: z.string().trim().max(1000).default(""), password: passwordSchema, permissions: permList.optional() }).parse(body);
  if (await db.adminUser.findUnique({ where: { email: d.email } })) throw new ApiError(409, "An administrator with this email already exists.", { email: "Already in use." });
  const perms = d.role === "SUPER_ADMIN" ? ALL_PERMISSIONS : (d.permissions ?? ROLE_DEFAULTS[d.role as keyof typeof ROLE_DEFAULTS]).filter((x) => x !== "admins");
  const a = await db.adminUser.create({ data: { name: d.name, email: d.email, phone: d.phone || null, role: d.role, jobTitle: d.jobTitle, bio: d.bio, permissions: JSON.stringify(perms), passwordHash: await hashPassword(d.password), mustChangePassword: true, createdById: admin.id } });
  await logActivity(admin, "Created admin", "Admin", a.id, `${a.name} (${a.role})`);
  return { admin: adminRow(a) };
});
const guardLastSuper = async (target: { id: string; role: string }, becomingNonSuperOrInactive: boolean) => {
  if (!becomingNonSuperOrInactive || target.role !== "SUPER_ADMIN") return;
  if ((await db.adminUser.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: target.id } } })) === 0) throw new ApiError(409, "This is the last active Super Admin. Create or promote another one first.");
};
on("PATCH", "admins/:id", "super", async ({ admin, p, body }) => {
  const d = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, phone: phoneSchema, role: roleEnum, jobTitle: z.string().trim().max(80), bio: z.string().trim().max(1000), permissions: permList, password: passwordSchema }).partial().parse(body);
  const t = await db.adminUser.findUnique({ where: { id: p[0] } });
  if (!t) throw new ApiError(404, "Administrator not found.");
  if (d.role && d.role !== t.role) { if (t.id === admin.id) throw new ApiError(409, "You can't change your own role."); await guardLastSuper(t, d.role !== "SUPER_ADMIN"); }
  if (d.email && d.email !== t.email && (await db.adminUser.findUnique({ where: { email: d.email } }))) throw new ApiError(409, "Another administrator already uses that email.");
  const { password, permissions, ...rest } = d;
  const role = d.role ?? t.role;
  const upd = await db.adminUser.update({ where: { id: t.id }, data: { ...rest, phone: d.phone === undefined ? undefined : d.phone || null, ...(permissions || d.role ? { permissions: JSON.stringify(role === "SUPER_ADMIN" ? ALL_PERMISSIONS : (permissions ?? (d.role ? ROLE_DEFAULTS[role as keyof typeof ROLE_DEFAULTS] : JSON.parse(t.permissions))).filter((x: string) => x !== "admins")) } : {}), ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {}) } });
  // Permissions are re-read from the database on every request, so changes apply to live sessions at once; a password reset ends the sessions.
  if (password) await db.adminSession.deleteMany({ where: { adminId: t.id } });
  await logActivity(admin, permissions || d.role ? "Changed admin permissions" : "Edited admin", "Admin", t.id, upd.name);
  return { admin: adminRow(upd) };
});
on("POST", "admins/:id/status", "super", async ({ admin, p, body }) => {
  const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).parse(body);
  const t = await db.adminUser.findUnique({ where: { id: p[0] } });
  if (!t) throw new ApiError(404, "Administrator not found.");
  if (t.id === admin.id && status === "SUSPENDED") throw new ApiError(409, "You can't suspend your own account.");
  await guardLastSuper(t, status === "SUSPENDED");
  await db.adminUser.update({ where: { id: t.id }, data: { status } });
  if (status === "SUSPENDED") await db.adminSession.deleteMany({ where: { adminId: t.id } });
  await logActivity(admin, status === "SUSPENDED" ? "Suspended admin" : "Activated admin", "Admin", t.id, t.name);
  return ok;
});
on("DELETE", "admins/:id", "super", async ({ admin, p }) => {
  const t = await db.adminUser.findUnique({ where: { id: p[0] } });
  if (!t) throw new ApiError(404, "Administrator not found.");
  if (t.id === admin.id) throw new ApiError(409, "You can't delete your own account.");
  await guardLastSuper(t, true);
  await db.adminUser.delete({ where: { id: t.id } });
  await logActivity(admin, "Deleted admin", "Admin", t.id, t.name);
  return ok;
});

// ------------------------------------------------------------------ support (Reader + Publisher)
const normStatus = (service: string, s: string) => (service === "publisher" && s === "WAITING_ADMIN" ? "OPEN" : s);
on("GET", "support", "support", async ({ q }) => {
  const svc = q.get("service") ?? "all", status = q.get("status"), s = q.get("q"), page = Math.max(1, Number(q.get("page") ?? 1)), size = 25;
  const [r, p] = await Promise.all([
    svc === "publisher" ? null : settle("reader", () => reader("GET", "tickets", { query: { pageSize: 100, q: s, status: status === "OPEN" || status === "WAITING_USER" || status === "CLOSED" ? status : undefined } })),
    svc === "reader" ? null : settle("publisher", () => publisher("GET", "tickets", { query: { pageSize: 100, q: s, status: status === "WAITING_PUBLISHER" || status === "CLOSED" ? status : undefined } })),
  ]);
  const unavailable: string[] = [];
  const rows: any[] = [];
  if (r) { if (!r.ok) unavailable.push("Reader"); else r.data.tickets.forEach((t: any) => rows.push({ ...t, service: "reader", userType: "Reader", status: normStatus("reader", t.status) })); }
  if (p) { if (!p.ok) unavailable.push("Publisher"); else p.data.tickets.forEach((t: any) => { const ns = normStatus("publisher", t.status); if (status === "OPEN" && !["OPEN", "WAITING_ADMIN"].includes(t.status)) return; rows.push({ ...t, service: "publisher", userType: "Publisher", status: ns }); }); }
  const out = (status ? rows.filter((t) => t.status === status) : rows).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  return { total: out.length, tickets: out.slice((page - 1) * size, page * size), unavailable };
});
const svcOf = (s: string) => { if (s !== "reader" && s !== "publisher") throw new ApiError(404, "Unknown service."); return s === "reader" ? reader : publisher; };
const markRead = (service: string, ticketId: string) => db.ticketRead.upsert({ where: { service_ticketId: { service, ticketId } }, create: { service, ticketId }, update: { readAt: new Date() } });
on("GET", "support/unread", "support", async () => {
  const [r, p] = await Promise.all([settle("reader", () => reader("GET", "tickets", { query: { pageSize: 100 } })), settle("publisher", () => publisher("GET", "tickets", { query: { pageSize: 100 } }))]);
  const reads = await db.ticketRead.findMany();
  let unread = 0;
  for (const [service, res] of [["reader", r], ["publisher", p]] as const) if (res.ok) for (const t of res.data.tickets) {
    if (t.status === "CLOSED" || t.lastFrom === "ADMIN") continue;
    const seen = reads.find((x) => x.service === service && x.ticketId === t.id);
    if (!seen || new Date(t.updatedAt) > seen.readAt) unread++;
  }
  return { unread };
});
// A photo the customer attached (fetched through the signed service API; only admins with the support permission can load it).
on("GET", "support/:service/attachments/:id", "support", async ({ p }) => {
  const res = await (p[0] === "reader" ? reader : publisher)<Response>("GET", `tickets/attachments/${p[1]}`, { raw: true });
  return new Response(res.body, { headers: { "content-type": res.headers.get("content-type") ?? "image/jpeg", "cache-control": "private, max-age=300" } });
});
on("GET", "support/:service/:id", "support", async ({ p }) => {
  const r = await svcOf(p[0])("GET", `tickets/${p[1]}`);
  await markRead(p[0], p[1]);
  const att = (m: any) => (m.attachments ?? []).map((a: any) => ({ id: a.id, name: a.name, url: `/api/support/${p[0]}/attachments/${a.id}` }));
  return { ticket: { ...r.ticket, messages: r.ticket.messages.map((m: any) => ({ ...m, attachments: att(m) })), service: p[0], userType: p[0] === "reader" ? "Reader" : "Publisher", status: normStatus(p[0], r.ticket.status) } };
});
on("POST", "support/:service/:id/reply", "support", async ({ admin, p, body }) => {
  sensitive(admin, "support-reply", 60);
  const d = z.object({ message: z.string().trim().min(1, "Write a message first.").max(5000) }).parse(body);
  const call = svcOf(p[0]);
  const t = (await call("GET", `tickets/${p[1]}`)).ticket;
  if (t.status === "CLOSED") throw new ApiError(409, "This ticket is closed, so you can't reply. Reopen it first if you need to continue the conversation.");
  const r = await call("POST", `tickets/${p[1]}/reply`, { body: { message: d.message, adminName: admin.name } });
  await markRead(p[0], p[1]);
  await logActivity(admin, "Replied to support", "Ticket", p[1], `${t.subject} (${p[0]})`);
  return r;
});
on("POST", "support/:service/:id/status", "support", async ({ admin, p, body }) => {
  const { status } = z.object({ status: z.enum(["OPEN", "WAITING_USER", "WAITING_PUBLISHER", "CLOSED"]) }).parse(body);
  if ((p[0] === "reader" && status === "WAITING_PUBLISHER") || (p[0] === "publisher" && status === "WAITING_USER")) throw new ApiError(400, `That status doesn't apply to ${p[0]} tickets.`);
  const call = svcOf(p[0]);
  const t = (await call("GET", `tickets/${p[1]}`)).ticket;
  const r = await call("POST", `tickets/${p[1]}/status`, { body: { status } });
  await markRead(p[0], p[1]);
  await logActivity(admin, status === "CLOSED" ? "Closed support ticket" : "Changed ticket status", "Ticket", p[1], `${t.subject} → ${status}`);
  return r;
});

// ------------------------------------------------------------------ notifications & activity
on("GET", "notifications", "auth", async ({ admin }) => {
  await pollEvents(true);
  const [items, unread] = await Promise.all([db.adminNotification.findMany({ where: { adminId: admin.id }, orderBy: { createdAt: "desc" }, take: 100 }), db.adminNotification.count({ where: { adminId: admin.id, readAt: null } })]);
  return { notifications: items, unread };
});
on("POST", "notifications/read", "auth", async ({ admin, body }) => {
  const d = z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }).parse(body);
  await db.adminNotification.updateMany({ where: { adminId: admin.id, readAt: null, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) }, data: { readAt: new Date() } });
  return { unread: await db.adminNotification.count({ where: { adminId: admin.id, readAt: null } }) };
});
on("DELETE", "notifications", "auth", async ({ admin }) => {
  await db.adminNotification.deleteMany({ where: { adminId: admin.id } });
  return { unread: 0 };
});
on("GET", "activity", "activity_logs", async ({ q }) => {
  const page = Math.max(1, Number(q.get("page") ?? 1)), size = 30, s = q.get("q")?.trim();
  const where: any = { ...(q.get("actorId") ? { actorId: q.get("actorId") } : {}), ...(s ? { OR: [{ action: { contains: s } }, { targetLabel: { contains: s } }, { actorName: { contains: s } }] } : {}) };
  const [rows, total] = await Promise.all([db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }), db.activityLog.count({ where })]);
  return { total, activities: rows };
});
on("DELETE", "activity", "super", async ({ admin }) => {
  sensitive(admin, "clear-activity", 3);
  const n = await db.activityLog.deleteMany({});
  await logActivity(admin, "Cleared all activity logs", "Activity log", null, null, `${n.count} entries removed`);
  return { cleared: n.count };
});

// ------------------------------------------------------------------ settings
on("GET", "settings", "auth", async () => ({ settings: await getSettings(), version: APP_VERSION, developer: DEVELOPER, copyright: COPYRIGHT }));
on("PUT", "settings/:section", "settings", async ({ admin, p, body }) => {
  sensitive(admin, "settings", 20);
  const warnings: string[] = [];
  const push = async (svc: "reader" | "publisher", key: string, value: unknown) => {
    try { await (svc === "reader" ? reader : publisher)("PUT", "config", { body: { key, value } }); }
    catch (e) { warnings.push(`${serviceLabel(svc)}: ${(e as Error).message} The change is saved here and can be re-applied with Save.`); }
  };
  switch (p[0]) {
    case "company": { const d = z.object({ name: z.string().trim().min(2).max(100), address: z.string().trim().max(300), website: z.string().trim().max(200) }).parse(body); await saveSetting("company", d); break; }
    case "supportEmail": { const d = z.object({ supportEmail: emailSchema }).parse(body); await saveSetting("supportEmail", d.supportEmail); break; }
    case "categories": {
      const d = z.object({ categories: z.array(z.string().trim().min(1).max(60)).min(1).max(100) }).parse(body);
      const uniq = [...new Set(d.categories)];
      await saveSetting("categories", uniq);
      await push("publisher", "categories", uniq);
      break;
    }
    case "currency": {
      const d = z.object({ minWithdrawals: z.object({ NGN: z.number().positive(), USD: z.number().positive(), GBP: z.number().positive(), EUR: z.number().positive() }) }).parse(body);
      const minor = Object.fromEntries(Object.entries(d.minWithdrawals).map(([k, v]) => [k, Math.round(v * 100)]));
      await saveSetting("currency", { minWithdrawals: minor });
      await push("publisher", "minWithdrawals", minor);
      break;
    }
    case "voice": { const d = z.object({ defaultVoice: z.string().trim().min(3).max(100) }).parse(body); await saveSetting("voice", d); await push("reader", "defaultVoice", d.defaultVoice); break; }
    default: throw new ApiError(404, "Unknown settings section.");
  }
  await logActivity(admin, "Updated platform settings", "Settings", p[0], p[0]);
  return { ok: true, warnings, settings: await getSettings() };
});

// ------------------------------------------------------------------ dispatcher
async function dispatch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  for (const r of table) {
    if (r.method !== req.method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    let admin: Admin | null = null;
    if (r.guard !== "public") {
      admin = r.guard === "auth" ? await requireAdmin({ allowMustChange: ["me", "me/password", "me/avatar", "auth/logout", "settings"].some((x) => path === x || path.startsWith("avatar/")) }) : r.guard === "super" ? await requireSuper() : await requirePermission(...(Array.isArray(r.guard) ? r.guard : [r.guard]));
    }
    let body: any = {};
    if (!["GET", "DELETE"].includes(req.method) && !(req.headers.get("content-type") ?? "").includes("multipart")) body = await req.json().catch(() => ({}));
    const out = await r.h({ q: req.nextUrl.searchParams, body, p: m.slice(1).map(decodeURIComponent), admin: admin as Admin, req });
    return out instanceof Response ? out : NextResponse.json(out);
  }
  throw new ApiError(404, "Unknown endpoint.");
}
const wrap = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => route(dispatch as any)(req, ctx as any);
export const GET = wrap, POST = wrap, PUT = wrap, PATCH = wrap, DELETE = wrap;
