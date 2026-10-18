import { createHmac, createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import sharp from "sharp";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: ReaderPrisma } = require("/Users/mac/Development/ebookvox/node_modules/@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: PubPrisma } = require("/Users/mac/Development/ebookvox/publisher/node_modules/@prisma/client");

const BASE = process.env.BASE!, READER = process.env.READER!, PUB = process.env.PUB!, RS = process.env.RS!, MOCK = "http://localhost:4010";
const adb = new PrismaClient();
const rdb = new ReaderPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/prisma/test-adm.db" } } });
const pdb = new PubPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/publisher/prisma/test-adm.db" } } });

let pass = 0; const failures: string[] = [];
const ok = (c: unknown, n: string, d?: unknown) => { if (c) { pass++; console.log("  ✓", n); } else { failures.push(n); console.log("  ✗", n, d !== undefined ? JSON.stringify(d).slice(0, 500) : ""); } };
const section = (s: string) => console.log(`\n${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => Promise<T | false | null | undefined>, ms = 30000): Promise<T | null> { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(400); } return null; }

class Client {
  jar = new Map<string, string>();
  constructor(public base: string, public country = "NG") {}
  async req(method: string, path: string, body?: unknown, extra: RequestInit = {}) {
    const headers = new Headers(extra.headers);
    headers.set("cf-ipcountry", this.country); // visitor location as a CDN reports it; the Reader prices and charges by it
    if (this.jar.size) headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body; else if (body !== undefined) { headers.set("content-type", "application/json"); payload = JSON.stringify(body); }
    const res = await fetch(this.base + path, { method, headers, body: payload, redirect: "manual", ...extra });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v.join("=") === "") this.jar.delete(k); else this.jar.set(k, v.join("=")); }
    const ct = res.headers.get("content-type") ?? "";
    return { status: res.status, data: ct.includes("json") ? await res.json() : null, res };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b ?? {});
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  put = (p: string, b: unknown) => this.req("PUT", p, b);
  del = (p: string) => this.req("DELETE", p);
}

const stamp = Date.now().toString(36);
const pw = "Sup3rSecret!";
const SUPER = { email: "superadmin@ebookvox.app", password: "ChangeMe!2026" };

async function readerUser(tag: string, country: string) {
  const c = new Client(READER, country);
  const phone = country === "NG" ? "8012345678" : country === "GB" ? "7700900123" : "2025550123";
  const r = await c.post("/api/auth/signup", { firstName: "Rita", lastName: tag, email: `${tag}.${stamp}@example.com`, password: pw, confirmPassword: pw, country, phoneCountry: country, phone });
  await rdb.user.updateMany({ where: { email: `${tag}.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  return { c, r, email: `${tag}.${stamp}@example.com`, id: r.data?.user?.id as string };
}
async function publisherUser(tag: string, country = "NG") {
  const c = new Client(PUB);
  const r = await c.post("/api/auth/signup", { firstName: "Pat", lastName: tag, email: `${tag}.${stamp}@example.com`, password: pw, confirmPassword: pw, country, phoneCountry: country, phone: country === "NG" ? "8012345678" : "2025550123" });
  await pdb.user.updateMany({ where: { email: `${tag}.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  return { c, r, email: `${tag}.${stamp}@example.com`, id: r.data?.user?.id as string };
}
const BOOK_TEXT = "# Chapter One\n\n" + Array.from({ length: 14 }, (_, i) => `Paragraph ${i + 1}: the keeper climbed the lighthouse stairs while the sea rolled against the rocks below.`).join("\n\n") + "\n\n# Chapter Two\n\n" + Array.from({ length: 10 }, (_, i) => `Second chapter paragraph ${i + 1} about the harbour town and its quiet mornings.`).join("\n\n");
async function bookForm(over: Record<string, any> = {}) {
  const fd = new FormData();
  const f = { title: "Tower of Tides", author: "Pat Writer", category: "Classic Fiction", description: "A calm and moving story about a keeper of the light and the town that depends on him.", isFree: false, prices: { NGN: 15000000, USD: 10000, GBP: 8000, EUR: 9500 }, ...over };
  for (const [k, v] of Object.entries(f)) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  fd.append("cover", new Blob([new Uint8Array(await sharp({ create: { width: 600, height: 900, channels: 3, background: "#b5703f" } }).jpeg().toBuffer())], { type: "image/jpeg" }), "cover.jpg");
  fd.append("file", new Blob([BOOK_TEXT], { type: "text/plain" }), "book.txt");
  return fd;
}
async function submitBook(p: { c: Client }, over: Record<string, any> = {}) {
  const r = await p.c.req("POST", "/api/books", await bookForm(over));
  const id = r.data.id as string;
  const s = await p.c.post(`/api/books/${id}/submit`);
  return { id, status: s.status };
}
async function buy(c: Client, bookId: string, outcome: "success" | "failed" = "success") {
  const co = await c.post("/api/checkout", { bookId });
  if (co.status !== 200) return { co, v: null as any };
  await fetch(`${MOCK}/__set/${co.data.reference}/${outcome}`);
  return { co, v: await c.get(`/api/checkout/verify?reference=${co.data.reference}`) };
}
const mockPaid = (ref: string) => fetch(`${MOCK}/__set/${ref}/success`);

function svcSign(secret: string, method: string, pathQuery: string, body = "", ts = String(Date.now())) {
  return { "x-svc-timestamp": ts, "x-svc-signature": createHmac("sha256", secret).update(`${ts}\n${method}\n${pathQuery}\n${createHash("sha256").update(body).digest("hex")}`).digest("hex") };
}

async function main() {
  // ============================================================== AUTHENTICATION
  section("Admin authentication");
  const S = new Client(BASE);
  ok((await S.get("/api/me")).status === 401, "unauthenticated /api/me rejected");
  ok((await S.get("/api/dashboard")).status === 401, "dashboard API requires login");
  ok((await S.get("/api/users")).status === 401, "users API requires login");
  ok([307, 308].includes((await S.get("/dashboard")).status), "dashboard page redirects to login");
  ok((await S.post("/api/auth/login", { email: SUPER.email, password: "WrongPass123" })).status === 401, "wrong password rejected");
  ok((await S.post("/api/auth/login", { email: "nobody@example.com", password: "WrongPass123" })).status === 401, "unknown admin rejected (same message)");
  ok(!(await S.get("/login")).res.headers.get("set-cookie")?.includes("eva_session"), "login page sets no session");
  const li = await S.post("/api/auth/login", SUPER);
  ok(li.status === 200 && li.data.admin.role === "SUPER_ADMIN" && !JSON.stringify(li.data).includes("passwordHash"), "super admin signs in", li.data);
  const cookieHdr = li.res.headers.getSetCookie().join(";");
  ok(/HttpOnly/i.test(cookieHdr) && /SameSite=strict/i.test(cookieHdr), "session cookie is HttpOnly + SameSite=Strict");
  const me = (await S.get("/api/me")).data;
  ok(me.admin.email === SUPER.email && me.admin.permissions.length === 14, "session works; super admin holds all 14 permissions");
  // signup routes must not exist
  ok((await S.post("/api/auth/signup", {})).status === 404 && (await S.get("/sign-up")).status === 404, "no signup routes exist in Admin");
  const xo = await fetch(`${BASE}/api/me`, { method: "PATCH", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: [...S.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify({ name: "Hacked" }) });
  ok(xo.status === 403, "cross-site write blocked");
  // Reader/Publisher sessions don't work on Admin
  const ru0 = await readerUser("sesscheck", "NG");
  const crossC = new Client(BASE); crossC.jar = new Map(ru0.c.jar);
  ok((await crossC.get("/api/me")).status === 401, "Reader session cookie is useless on Admin");
  // brute-force limiter
  const bf = new Client(BASE); let last = 0;
  for (let i = 0; i < 8; i++) last = (await bf.post("/api/auth/login", { email: `brute.${stamp}@example.com`, password: "WrongPass123" })).status;
  ok(last === 429, "login is rate limited after repeated failures");

  // ============================================================== SERVICE AUTH
  section("Service-to-service security");
  ok((await fetch(`${READER}/api/internal/stats`)).status === 401, "Reader internal API rejects unsigned requests");
  ok((await fetch(`${PUB}/api/internal/stats`)).status === 401, "Publisher internal API rejects unsigned requests");
  ok((await fetch(`${READER}/api/internal/stats`, { headers: svcSign("wrong-secret-wrong-secret-wrong", "GET", "/api/internal/stats") })).status === 401, "wrong secret rejected");
  ok((await fetch(`${READER}/api/internal/stats`, { headers: svcSign(RS, "GET", "/api/internal/stats", "", String(Date.now() - 5 * 60_000)) })).status === 401, "stale timestamp rejected");
  ok((await fetch(`${READER}/api/internal/health`, { headers: svcSign(RS, "GET", "/api/internal/stats") })).status === 401, "signature is bound to the exact path");
  ok((await fetch(`${READER}/api/internal/health`, { headers: svcSign(RS, "GET", "/api/internal/health") })).status === 200, "correctly signed request accepted");
  const cookieOnly = await fetch(`${READER}/api/internal/users`, { headers: { cookie: "ev_session=anything" } });
  ok(cookieOnly.status === 401, "a browser session can't reach internal endpoints");
  const body = JSON.stringify({ key: "defaultVoice", value: "en-GB-RyanNeural" });
  const h = svcSign(RS, "PUT", "/api/internal/config", body);
  ok((await fetch(`${READER}/api/internal/config`, { method: "PUT", headers: { ...h, "content-type": "application/json" }, body })).status === 200, "signed mutation accepted");
  ok((await fetch(`${READER}/api/internal/config`, { method: "PUT", headers: { ...h, "content-type": "application/json" }, body })).status === 409, "replayed mutation rejected");
  const h2 = svcSign(RS, "PUT", "/api/internal/config", body);
  ok((await fetch(`${READER}/api/internal/config`, { method: "PUT", headers: { ...h2, "content-type": "application/json" }, body: JSON.stringify({ key: "defaultVoice", value: "tampered-voice" }) })).status === 401, "body tampering invalidates the signature");
  await fetch(`${READER}/api/internal/config`, { method: "PUT", headers: { ...svcSign(RS, "PUT", "/api/internal/config", JSON.stringify({ key: "defaultVoice", value: "en-NG-EzinneNeural" })), "content-type": "application/json" }, body: JSON.stringify({ key: "defaultVoice", value: "en-NG-EzinneNeural" }) });
  const stX = (await S.get("/api/status")).data;
  ok(stX.services.every((x: any) => x.ok), "service status reports both services online", stX);

  // ============================================================== SEED ECOSYSTEM DATA
  section("Ecosystem data (created through the real Reader and Publisher APIs)");
  const rNG = await readerUser("reader-ng", "NG"), rGB = await readerUser("reader-gb", "GB"), rUS = await readerUser("reader-us", "US");
  const pubA = await publisherUser("pub-a"), pubB = await publisherUser("pub-b"), pubC = await publisherUser("pub-c");
  ok(rNG.id && rGB.id && rUS.id && pubA.id && pubB.id && pubC.id, "3 readers and 3 publishers registered");
  await pdb.user.update({ where: { email: pubA.email }, data: { publisherName: "Aurora House", bio: "Pat Writer is a novelist." } });
  await pubA.c.patch("/api/me", { publisherName: "Aurora House" });
  const bookA = await submitBook(pubA, { title: "Tower of Tides" });
  const bookB = await submitBook(pubB, { title: "Harbour Notes", author: "Hannah Marsh", category: "Poetry" });
  const bookC = await submitBook(pubC, { title: "Reject Me", author: "Cara Dent", category: "Mystery" });
  ok(bookA.status === 200 && bookB.status === 200 && bookC.status === 200, "3 publisher books submitted for review");
  await sleep(1500);

  // ============================================================== NOTIFICATIONS (events)
  section("Admin notifications from live events");
  const n0 = (await S.get("/api/notifications")).data;
  const types = n0.notifications.map((n: any) => n.type);
  ok(types.includes("NEW_BOOK_SUBMISSION"), "new book submission notification");
  ok(types.includes("NEW_PUBLISHER") || types.includes("NEW_USER"), "new publisher / user notifications arrive", types.slice(0, 6));
  ok(n0.unread === n0.notifications.filter((n: any) => !n.readAt).length && n0.unread > 0, "unread count is accurate", n0.unread);
  const first = n0.notifications.find((n: any) => !n.readAt);
  ok((await S.post("/api/notifications/read", { ids: [first.id] })).data.unread === n0.unread - 1, "opening a notification marks it read");
  ok((await S.post("/api/notifications/read", { all: true })).data.unread === 0, "mark all read → 0");

  // ============================================================== BOOK REVIEW + READER SYNC
  section("Book review → approve / reject → Reader synchronisation");
  const q = (await S.get("/api/book-review")).data;
  ok(q.books.length === 3 && q.books.every((b: any) => b.status === "REVIEWING") && q.books[0].publisher.name && q.books[0].description && q.books[0].hasFile && q.books[0].hasCover, "queue lists submitted books with publisher, description, cover and file", q.books.map((b: any) => b.title));
  const nobody = (await rNG.c.get("/api/books")).data.books;
  ok(!nobody.some((b: any) => ["Tower of Tides", "Harbour Notes", "Reject Me"].includes(b.title)), "unapproved books are NOT in the Reader catalogue");
  const file = await S.req("GET", `/api/book-review/${bookA.id}/file`);
  ok(file.status === 200 && /attachment/.test(file.res.headers.get("content-disposition") ?? ""), "book file can be downloaded for review");
  const cov = await S.req("GET", `/api/book-review/${bookA.id}/cover`);
  ok(cov.status === 200 && /image/.test(cov.res.headers.get("content-type") ?? ""), "cover is shown in the review queue");
  const detail = (await S.get(`/api/book-review/${bookA.id}`)).data.book;
  ok(detail.preview.includes("keeper climbed") && detail.prices.NGN === 15000000, "review detail has text preview and prices");
  ok((await S.post(`/api/book-review/${bookC.id}/decision`, { action: "reject" })).status === 400, "rejection requires a reason");
  ok((await S.post(`/api/book-review/${bookC.id}/decision`, { action: "reject", reason: "ok" })).status === 400, "rejection reason must be meaningful");
  ok((await S.post(`/api/book-review/${bookC.id}/decision`, { action: "reject", reason: "The synopsis is missing key details and the cover is blurry." })).status === 200, "book rejected with reason");
  const rejSeen = (await pubC.c.get(`/api/books/${bookC.id}`)).data.book;
  ok(rejSeen.status === "REJECTED" && /synopsis is missing/.test(rejSeen.rejectionReason), "publisher receives the rejection reason", rejSeen);
  ok((await pubC.c.get("/api/notifications")).data.notifications.some((n: any) => n.type === "BOOK_REJECTED"), "publisher notified of rejection");
  ok(!(await rNG.c.get("/api/books")).data.books.some((b: any) => b.title === "Reject Me"), "rejected book is not in the Reader catalogue");
  ok((await S.post(`/api/book-review/${bookC.id}/decision`, { action: "approve" })).status === 409, "a rejected book can't be approved without resubmission");
  const apA = await S.post(`/api/book-review/${bookA.id}/decision`, { action: "approve" });
  ok(apA.status === 200 && apA.data.status === "PUBLISHED", "book approved and published", apA.data);
  ok((await S.post(`/api/book-review/${bookA.id}/decision`, { action: "approve" })).status === 409, "double approval refused");
  ok((await S.post(`/api/book-review/${bookB.id}/decision`, { action: "approve" })).data.status === "PUBLISHED", "second book approved");
  const live = (await rNG.c.get("/api/books")).data.books.find((b: any) => b.title === "Tower of Tides");
  ok(live && live.author === "Pat Writer" && live.category === "Classic Fiction" && live.price.currency === "NGN" && live.price.amountMinor === 15000000 && !!live.coverUrl, "Reader receives title, author, category, cover and NGN price", live);
  const liveGB = (await rGB.c.get("/api/books")).data.books.find((b: any) => b.title === "Tower of Tides");
  ok(liveGB?.price.currency === "GBP" && liveGB.price.amountMinor > 0 && liveGB.price.amountMinor < 100000, "Reader shows a UK reader the NGN list price converted to GBP", liveGB?.price);
  const det = (await rNG.c.get(`/api/books/${live.id}`)).data.book;
  ok(det.publisher === "Aurora House" && det.description.includes("keeper of the light") && det.chapterCount >= 2, "Reader has description, publisher reference and chapters");
  ok((await pubA.c.get(`/api/books/${bookA.id}`)).data.book.status === "PUBLISHED", "publisher sees status Published");
  const pbl = (await S.get("/api/publisher-books")).data;
  ok(pbl.books.length === 2 && pbl.books.every((b: any) => ["APPROVED", "PUBLISHED"].includes(b.status)), "Publisher Books lists only approved books", pbl.books.map((b: any) => b.title));
  const t1 = (await S.get("/api/notifications")).data.notifications.map((n: any) => n.type);
  ok(t1.includes("BOOK_APPROVAL") && t1.includes("BOOK_REJECTION"), "admins are notified of approvals and rejections");

  // ============================================================== ALL BOOKS
  section("All books (Reader catalogue + publisher books)");
  const all = (await S.get("/api/books?pageSize=100")).data;
  ok(all.total >= 13 && all.books.some((b: any) => b.source === "READER") && all.books.some((b: any) => b.source === "PUBLISHER"), `catalogue combines both sources (${all.total} books)`);
  ok((await S.get("/api/books?source=PUBLISHER")).data.books.every((b: any) => b.source === "PUBLISHER"), "source filter");
  ok((await S.get("/api/books?q=Tower")).data.books.length === 1, "search filter");
  const hl = all.books.find((b: any) => b.title === "Tower of Tides");
  const upd = await S.patch(`/api/books/${hl.id}`, { title: "Tower of Tides (Revised)", prices: { NGN: 16000000 }, description: "A revised description for the lighthouse story that is long enough." });
  ok(upd.status === 200, "publisher book edited from Admin", upd.data);
  const afterEdit = (await rNG.c.get("/api/books")).data.books.find((b: any) => b.id === hl.id);
  ok(afterEdit.title === "Tower of Tides (Revised)" && afterEdit.price.amountMinor === 16000000, "edit reached the Reader catalogue (with new price)", afterEdit);
  ok((await pdb.book.findUnique({ where: { id: bookA.id } })).title === "Tower of Tides (Revised)", "edit is stored on the Publisher side too");
  const readerBook = all.books.find((b: any) => b.source === "READER" && b.isFree);
  ok((await S.patch(`/api/books/${readerBook.id}`, { description: "Edited by an administrator during testing." })).status === 200, "Reader catalogue book edited");
  ok((await S.patch(`/api/books/${readerBook.id}`, { title: "" })).status === 400, "invalid edits are rejected");

  // ============================================================== PURCHASES, SALES, TRANSACTIONS
  section("Reader → payment → library, publisher sales and transactions");
  const bought = await buy(rNG.c, hl.id);
  ok(bought.v?.data.status === "PAID", "reader pays (Paystack verified server-side)");
  ok((await rNG.c.get(`/api/books/${hl.id}/chapters/0`)).status === 200, "purchased book is in the reader's library and readable");
  const comm = await until(async () => { const c = (await S.get("/api/commissions")).data; return c.recent.length ? c : false; });
  ok(!!comm && comm.recent[0].feeMinor === Math.floor((comm.recent[0].grossMinor * 15) / 100) && comm.recent[0].currency === "NGN" && comm.totals[0].feeMinor === comm.recent[0].feeMinor, "the 15% commission reaches the Admin ledger as soon as the payment is confirmed", comm);
  const failed = await buy(rGB.c, hl.id, "failed");
  ok(failed.v?.data.status === "FAILED", "a failed payment is recorded");
  ok(!!(await until(async () => (await S.get("/api/sales")).data.sales.length > 0)), "sale reaches the Publisher platform");
  const sales = (await S.get("/api/sales")).data;
  const sale = sales.sales[0];
  ok(sale.grossMinor === 16000000 && sale.publisherMinor === 13600000 && sale.platformMinor === 2400000 && sale.currency === "NGN" && sale.status === "PAID" && sale.publisher.name === "Aurora House" && sale.book.title.startsWith("Tower"), "sale: ₦160,000 → publisher ₦136,000 (85%) / platform ₦24,000 (15%)", sale);
  ok(sales.totals[0].publisherMinor + sales.totals[0].platformMinor === sales.totals[0].grossMinor, "shares add up to the gross");
  await sleep(500);
  const txAll = (await S.get("/api/transactions")).data;
  const kinds = new Set(txAll.transactions.map((t: any) => t.kind));
  ok(kinds.has("PURCHASE") && kinds.has("SALE") && kinds.has("FAILED_PAYMENT"), "transactions show purchase, sale and failed payment", [...kinds]);
  ok((await S.get("/api/transactions?type=FAILED")).data.transactions.every((t: any) => t.kind === "FAILED_PAYMENT" && t.status === "FAILED") && (await S.get("/api/transactions?type=FAILED")).data.transactions.length === 1, "type filter: failed payment");
  ok((await S.get("/api/transactions?type=SALE")).data.transactions.every((t: any) => t.kind === "SALE"), "type filter: sale");
  ok((await S.get("/api/transactions?type=REFUND")).data.total === 0, "refund type is empty (no refund flow exists)");
  ok((await S.get("/api/transactions?currency=GBP")).data.transactions.every((t: any) => t.currency === "GBP"), "currency filter");
  ok((await S.get(`/api/transactions?publisherId=${pubA.id}`)).data.transactions.every((t: any) => t.publisherId === pubA.id) , "publisher filter");
  ok((await S.get(`/api/transactions?from=${encodeURIComponent(new Date(Date.now() + 86400_000).toISOString())}`)).data.total === 0, "date filter (future → none)");
  ok((await S.get("/api/transactions?status=PAID")).data.transactions.every((t: any) => t.status === "PAID"), "status filter");
  const orders = (await S.get("/api/orders")).data;
  ok(orders.orders.some((o: any) => o.status === "PAID") && orders.orders.some((o: any) => o.status === "FAILED"), "orders page data (paid + failed)");
  const n2 = (await S.get("/api/notifications")).data.notifications.map((n: any) => n.type);
  ok(n2.includes("NEW_SALE") && n2.includes("NEW_TRANSACTION"), "new sale + new transaction notifications");

  // ============================================================== DASHBOARD
  section("Dashboard figures come from live data");
  const dash = (await S.get("/api/dashboard?range=30d")).data;
  const dbUsers = await rdb.user.count({ where: { role: "USER", status: { not: "DELETED" } } });
  ok(dash.reader.ok && dash.reader.data.users.total === dbUsers && dash.reader.data.users.active === dbUsers && dash.reader.data.users.suspended === 0, `user totals match the Reader database (${dbUsers})`, dash.reader.data?.users);
  const dbBooks = await rdb.book.count();
  ok(dash.reader.data.books.total === dbBooks && dash.reader.data.books.approved === (await rdb.book.count({ where: { status: "APPROVED" } })), "book totals match", dash.reader.data.books);
  const dbOrders = { total: await rdb.order.count(), paid: await rdb.order.count({ where: { status: "PAID" } }), failed: await rdb.order.count({ where: { status: "FAILED" } }), pending: await rdb.order.count({ where: { status: "PENDING" } }) };
  const od = dash.reader.data.orders;
  ok(od.total === dbOrders.total && od.paid === dbOrders.paid && od.failed === dbOrders.failed && od.pending === dbOrders.pending, "order totals match (paid / pending / failed)", [od, dbOrders]);
  ok(dash.publisher.ok && dash.publisher.data.publishers.total === 3 && dash.publisher.data.publishers.active === 3, "publisher totals match", dash.publisher.data?.publishers);
  const revNGN = dash.reader.data.revenue.find((r: any) => r.currency === "NGN");
  ok(revNGN?.grossMinor === 16000000 && revNGN.sales === 1, "gross revenue and sales volume match paid orders", dash.reader.data.revenue);
  ok(dash.reader.data.series.reduce((a: number, s: any) => a + s.registrations, 0) === dbUsers, "user-growth series sums to the registrations");
  ok(dash.reader.data.categories.length > 0 && dash.reader.data.categories.reduce((a: number, c: any) => a + c.count, 0) === dash.reader.data.books.approved, "category breakdown sums to approved books");
  for (const r of ["7d", "30d", "3m", "6m", "1y"]) if ((await S.get(`/api/dashboard?range=${r}`)).status !== 200) ok(false, `range ${r}`);
  ok(true, "all five analytics ranges respond");
  ok(dash.recentReader.ok && dash.recentPublisher.ok, "recent book activity loads");

  // ============================================================== USERS
  section("Users");
  const ul = (await S.get("/api/users")).data;
  ok(ul.total === dbUsers && ul.users.every((u: any) => u.email && "orders" in u && "purchasedBooks" in u), "user table with orders and purchased books");
  const rngRow = ul.users.find((u: any) => u.id === rNG.id);
  ok(rngRow.orders === 1 && rngRow.purchasedBooks === 1, "reader-ng shows 1 order / 1 purchased book", rngRow);
  ok((await S.get(`/api/users?q=${encodeURIComponent("reader-gb")}`)).data.total === 1, "user search");
  const prof = (await S.get(`/api/users/${rNG.id}`)).data;
  ok(prof.user.email === rNG.email && prof.orders.length === 1 && prof.library.length >= 1 && Array.isArray(prof.tickets) && prof.activity.length > 0, "user profile: info, orders, library, tickets, activity");
  const ed = await S.patch(`/api/users/${rGB.id}`, { firstName: "Gwen", phone: "+447700900999" });
  ok(ed.status === 200 && ed.data.user.firstName === "Gwen" && ed.data.user.phone === "+447700900999", "user edited", ed.data);
  const susp = await S.post(`/api/users/${rGB.id}/status`, { status: "SUSPENDED" });
  ok(susp.status === 200, "user suspended");
  ok((await rGB.c.get("/api/me")).status === 401, "suspended user's session is revoked immediately");
  const relog = await new Client(READER).post("/api/auth/signin", { email: rGB.email, password: pw });
  ok(relog.status === 403 && /suspended/i.test(relog.data.error), "suspended user cannot sign in", relog.data);
  ok((await rdb.user.findUnique({ where: { id: rGB.id } })).suspendedAt, "suspension time recorded");
  const reGB = new Client(READER);
  ok((await S.post(`/api/users/${rGB.id}/status`, { status: "ACTIVE" })).status === 200 && (await reGB.post("/api/auth/signin", { email: rGB.email, password: pw })).status === 200, "user activated and can sign in again");
  rGB.c = reGB;
  const dash2 = (await S.get("/api/dashboard")).data;
  ok(dash2.reader.data.users.suspended === 0, "suspended count updates");
  // delete
  const doomed = await readerUser("doomed", "NG");
  await buy(doomed.c, readerBook.id).catch(() => null);
  await doomed.c.post(`/api/books/${readerBook.id}/claim`).catch(() => null);
  const del = await S.del(`/api/users/${doomed.id}`);
  ok(del.status === 200, "user deleted");
  const gone = await rdb.user.findUnique({ where: { id: doomed.id } });
  ok(gone.status === "DELETED" && gone.email.startsWith("deleted-") && gone.firstName === "Deleted" && !gone.passwordHash, "personal data erased");
  ok((await rdb.userBook.count({ where: { userId: doomed.id } })) === 0, "library entries removed (no orphans)");
  ok((await doomed.c.get("/api/me")).status === 401 && (await new Client(READER).post("/api/auth/signin", { email: doomed.email, password: pw })).status === 401, "deleted user can't sign in");
  ok(!(await S.get("/api/users")).data.users.some((u: any) => u.id === doomed.id), "deleted user disappears from the list");

  // ============================================================== PUBLISHERS
  section("Publishers");
  const pl = (await S.get("/api/publishers")).data;
  ok(pl.total === 3 && pl.publishers.every((p: any) => "verified" in p && Array.isArray(p.wallet)), "publisher table with verification and wallet");
  const aRow = pl.publishers.find((p: any) => p.id === pubA.id);
  ok(aRow.wallet.find((w: any) => w.currency === "NGN")?.availableMinor === 13600000 && aRow.wallet[0].earnedMinor === 13600000, "wallet balance and total earnings shown (₦136,000)", aRow.wallet);
  const pp = (await S.get(`/api/publishers/${pubA.id}`)).data;
  ok(pp.publisher.name === "Aurora House" && pp.books.length === 1 && pp.sales.length === 1 && pp.wallets.length === 4 && pp.transactions.length === 1 && Array.isArray(pp.withdrawals) && Array.isArray(pp.tickets), "publisher profile: books, sales, earnings, wallet, payouts, tickets");
  const pe = await S.patch(`/api/publishers/${pubB.id}`, { publisherName: "Bay Press", bio: "Edited by admin." });
  ok(pe.status === 200 && pe.data.publisher.name === "Bay Press", "publisher edited");
  ok((await S.patch(`/api/publishers/${pubA.id}`, { country: "GB" })).status === 409, "country can't change once money has moved");
  ok((await S.post(`/api/publishers/${pubC.id}/status`, { status: "SUSPENDED" })).status === 200, "publisher suspended");
  ok((await pubC.c.get("/api/books")).status === 401, "suspended publisher's session is revoked");
  const pls = await new Client(PUB).post("/api/auth/signin", { email: pubC.email, password: pw });
  ok(pls.status === 403, "suspended publisher cannot sign in", pls.data);
  ok((await S.get("/api/dashboard")).data.publisher.data.publishers.suspended === 1, "suspended publisher count updates");
  const rePC = new Client(PUB);
  ok((await S.post(`/api/publishers/${pubC.id}/status`, { status: "ACTIVE" })).status === 200 && (await rePC.post("/api/auth/signin", { email: pubC.email, password: pw })).status === 200, "publisher activated");
  pubC.c = rePC;
  const pdel = await S.del(`/api/publishers/${pubA.id}`);
  ok(pdel.status === 409 && /live|balance/i.test(pdel.data.error), "publisher with live books / balance can't be deleted", pdel.data);
  const freshPub = await publisherUser("pub-fresh");
  ok((await S.del(`/api/publishers/${freshPub.id}`)).status === 200 && (await pdb.user.findUnique({ where: { id: freshPub.id } })).status === "DELETED", "publisher with nothing outstanding is deleted (anonymised)");
  ok((await new Client(PUB).post("/api/auth/signin", { email: freshPub.email, password: pw })).status === 401, "deleted publisher can't sign in");

  // ============================================================== AUTHORS
  section("Authors");
  const au = (await S.get("/api/authors")).data;
  ok(au.authors.some((a: any) => a.author === "Pat Writer" && a.publisher === "Aurora House" && a.books === 1 && a.published === 1 && a.sales === 1), "publisher author with books, sales and publisher", au.authors.slice(0, 3));
  ok(au.authors.some((a: any) => a.source === "Reader" && a.books >= 1), "Reader catalogue authors included");
  ok((await S.get("/api/authors?q=hannah")).data.authors.length === 1, "author search");

  // ============================================================== PAYOUTS
  section("Publisher payouts");
  const rNG2 = await readerUser("reader-ng2", "NG");
  ok((await buy(rNG2.c, hl.id)).v?.data.status === "PAID", "a second NG reader buys the book (balance grows to ₦272,000)");
  await until(async () => (await pdb.sale.count({ where: { publisherId: pubA.id } })) === 2);
  await pubA.c.put("/api/payment-method", { bankCode: "058", accountName: "Pat Writer", accountNumber: "0123456789" });
  const wr = await pubA.c.post("/api/withdrawals", { currency: "NGN", amount: 100000 });
  ok(wr.status === 200, "publisher requests a payout (₦100,000)", wr.data);
  const pays = (await S.get("/api/payouts")).data;
  const wd = pays.withdrawals[0];
  ok(wd.status === "PROCESSING" && wd.amountMinor === 10000000 && wd.method === "BANK" && wd.destination.accountNumber === "0123456789" && wd.publisher.name === "Aurora House" && wd.requestedAt, "payout visible as Processing with method and destination", wd);
  ok((await S.get("/api/payouts?status=PENDING")).data.total === 0 && (await S.get("/api/payouts?status=PROCESSING")).data.total === 1, "status filters (Pending / Processing)");
  const noRef = await S.post(`/api/payouts/${wd.id}/process`, { action: "paid" });
  ok(noRef.status === 422 && /reference/i.test(noRef.data.error), "cannot mark Paid without a payout reference", noRef.data);
  const snap = (await pdb.withdrawal.findUnique({ where: { id: wd.id } })).methodSnapshot;
  await pdb.withdrawal.update({ where: { id: wd.id }, data: { methodSnapshot: JSON.stringify({ ...JSON.parse(snap), accountNumber: "123" }) } });
  const badDest = await S.post(`/api/payouts/${wd.id}/process`, { action: "paid", reference: "BANK-REF-1" });
  ok(badDest.status === 422 && /destination/i.test(badDest.data.error), "cannot mark Paid when the payment destination is invalid", badDest.data);
  await pdb.withdrawal.update({ where: { id: wd.id }, data: { methodSnapshot: snap } });
  ok((await S.post(`/api/payouts/${wd.id}/process`, { action: "reject" })).status === 400, "rejection requires a reason");
  const paid = await S.post(`/api/payouts/${wd.id}/process`, { action: "paid", reference: "GTB-TRX-883421" });
  ok(paid.status === 200, "payout marked Paid with a reference", paid.data);
  const wp = (await pubA.c.get("/api/withdrawals")).data.withdrawals[0];
  ok(wp.status === "PAID" && wp.processedAt, "publisher sees status Paid");
  ok((await pdb.withdrawal.findUnique({ where: { id: wd.id } })).payoutReference === "GTB-TRX-883421", "payout reference stored");
  ok((await S.post(`/api/payouts/${wd.id}/process`, { action: "paid", reference: "GTB-TRX-883421" })).status === 409, "already-processed payout can't be processed again");
  ok((await pubA.c.get("/api/notifications")).data.notifications.some((n: any) => n.type === "WITHDRAWAL_PAID"), "publisher notified of payment");
  const wr2 = await pubA.c.post("/api/withdrawals", { currency: "NGN", amount: 100000 });
  const wd2 = (await S.get("/api/payouts?status=PROCESSING")).data.withdrawals[0];
  ok(wr2.status === 200 && (await S.post(`/api/payouts/${wd2.id}/process`, { action: "reject", reason: "Account name does not match your registered name." })).status === 200, "second payout rejected with reason");
  const wallet = (await pubA.c.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN");
  ok(wallet.available === 17200000 && wallet.withdrawn === 10000000 && wallet.pending === 0, "wallet reflects paid + refunded-on-reject (₦172,000 available, ₦100,000 withdrawn)", wallet);
  ok((await S.get("/api/payouts?status=PAID")).data.total === 1 && (await S.get("/api/payouts?status=REJECTED")).data.total === 1, "paid / rejected filters");
  const tx2 = (await S.get("/api/transactions?type=PAYOUT")).data.transactions;
  ok(tx2.length === 2 && tx2.every((t: any) => t.kind === "PAYOUT"), "payouts appear in Transactions");
  ok((await S.get("/api/notifications")).data.notifications.some((n: any) => n.type === "NEW_PAYOUT_REQUEST"), "payout-request notification");

  // ============================================================== SUBSCRIBERS
  section("Subscribers (ad-free plan)");
  const topRef = (await rNG.c.post("/api/wallet/topup", { amountMinor: 20_000_000 })).data.reference;
  await fetch(`${MOCK}/__set/${topRef}/success`); await rNG.c.get(`/api/checkout/verify?reference=${topRef}`);
  const subr = await rNG.c.post("/api/subscription/subscribe", { plan: "YEARLY", method: "wallet" });
  ok(subr.status === 200 && subr.data.status === "PAID", "a reader tops up their wallet and subscribes (yearly)", subr.data);
  const subs = await until(async () => { const r = (await S.get("/api/subscribers")).data; return r.subscribers.length ? r : false; });
  const sr = subs?.subscribers.find((x: any) => x.email === rNG.email);
  ok(!!sr && sr.name.includes("Rita") && sr.plan === "YEARLY" && sr.status === "ACTIVE" && sr.country === "NG" && sr.lastPayment?.method === "WALLET" && Object.values(sr.paid)[0] as number > 0 && sr.payments === 1, "Admin lists the subscriber: name, email, plan, status, last payment method and total paid", sr);
  ok(subs.totals.activeCount >= 1 && subs.totals.activeYearly >= 1 && subs.totals.monthlyRecurringUsdMinor >= 180 && subs.totals.revenue.some((r: any) => r.currency === "NGN" && r.usdMinor === 2160), "subscriber totals: active count, monthly recurring revenue ($1.80 per yearly subscriber), money collected", subs.totals);
  const sd = (await S.get(`/api/subscribers/${sr.id}`)).data;
  ok(sd.subscriber.email === rNG.email && sd.payments.length === 1 && sd.payments[0].usdMinor === 2160 && sd.payments[0].method === "WALLET" && sd.payments[0].reference.startsWith("SUBW-") && sd.wallet.balances[0].currency === "NGN" && sd.wallet.recent.some((t: any) => t.type === "SUBSCRIPTION"), "subscriber detail shows every payment (amount, dollar price, method, reference, period) and the wallet", sd);
  ok((await S.get("/api/subscribers?status=EXPIRED")).data.subscribers.every((x: any) => x.email !== rNG.email) && (await S.get("/api/subscribers?plan=MONTHLY")).data.subscribers.every((x: any) => x.email !== rNG.email) && (await S.get(`/api/subscribers?q=${encodeURIComponent(rNG.email)}`)).data.total === 1, "status / plan / search filters work");
  ok(!!(await until(async () => (await S.get("/api/notifications")).data.notifications.some((n: any) => n.type === "NEW_SUBSCRIBER" && n.body.includes(rNG.email)))), "admins get a “New subscriber” notification");

  // ============================================================== SUPPORT
  section("Support (Reader + Publisher)");
  const tR = await rNG.c.post("/api/tickets", { subject: "Book won't open", message: "My purchased book shows a blank page." });
  const tP = await pubB.c.post("/api/tickets", { subject: "Cover rejected?", message: "Why was my cover flagged?" });
  const sup = (await S.get("/api/support")).data;
  ok(sup.tickets.some((t: any) => t.service === "reader" && t.userType === "Reader") && sup.tickets.some((t: any) => t.service === "publisher" && t.userType === "Publisher") && sup.tickets.every((t: any) => t.name && t.email && t.subject && t.lastMessage && t.updatedAt), "combined inbox shows both user types with name, email, subject, last message");
  ok((await S.get("/api/support?service=reader")).data.tickets.every((t: any) => t.service === "reader"), "service filter");
  ok((await S.get("/api/support?status=OPEN")).data.tickets.length >= 2, "status filter: Open");
  const rId = tR.data.ticket.id, pId = tP.data.ticket.id;
  // photos sent by customers are visible to support staff (through the signed service API) — and only to them
  const shotPng = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#e76f51" } }).png().toBuffer();
  const photoForm = (subject: string) => { const f = new FormData(); f.append("subject", subject); f.append("message", "Screenshot attached for you."); f.append("files", new Blob([new Uint8Array(shotPng)], { type: "image/png" }), "screen.png"); return f; };
  const tPhotoR = await rNG.c.req("POST", "/api/tickets", photoForm("Reader photo ticket"));
  const tPhotoP = await pubB.c.req("POST", "/api/tickets", photoForm("Publisher photo ticket"));
  ok(tPhotoR.status === 200 && tPhotoP.status === 200, "a Reader and a Publisher can each open a ticket with a photo", [tPhotoR.status, tPhotoP.status, tPhotoP.data]);
  for (const [svc, id] of [["reader", tPhotoR.data.ticket.id], ["publisher", tPhotoP.data.ticket.id]] as const) {
    const d = (await S.get(`/api/support/${svc}/${id}`)).data.ticket;
    const att = d.messages[0].attachments?.[0];
    ok(att?.url === `/api/support/${svc}/attachments/${att?.id}`, `admin sees the ${svc}'s photo in the conversation`, d.messages[0]);
    const img = await S.get(att.url);
    ok(img.status === 200 && (img.res.headers.get("content-type") ?? "").startsWith("image/"), `admin can open the ${svc}'s photo`);
    ok((await new Client(BASE).get(att.url)).status === 401, `the ${svc} photo is not public`);
  }
  const un0 = (await S.get("/api/support/unread")).data.unread;
  ok(un0 >= 2, "admin Support badge counts conversations awaiting a reply", un0);
  await S.get(`/api/support/reader/${rId}`);
  ok((await S.get("/api/support/unread")).data.unread === un0 - 1, "opening a conversation marks it read");
  const rep = await S.post(`/api/support/reader/${rId}/reply`, { message: "Thanks — we're checking your library entry." });
  ok(rep.status === 200, "admin replies to a reader");
  const rSees = (await rNG.c.get(`/api/tickets/${rId}`)).data.ticket;
  ok(rSees.messages.at(-1).from === "ADMIN" && /checking your library/.test(rSees.messages.at(-1).body) && rSees.status === "WAITING_USER", "reply is immediately visible to the reader; status Waiting for User", rSees);
  ok((await rNG.c.get("/api/notifications")).data.notifications.some((n: any) => n.type === "SUPPORT_REPLY"), "reader notified");
  const rep2 = await S.post(`/api/support/publisher/${pId}/reply`, { message: "Your cover was fine — it was the missing synopsis." });
  ok(rep2.status === 200, "admin replies to a publisher");
  const pSees = (await pubB.c.get(`/api/tickets/${pId}`)).data.ticket;
  ok(pSees.messages.at(-1).from === "ADMIN" && /missing synopsis/.test(pSees.messages.at(-1).body) && pSees.status === "WAITING_PUBLISHER", "reply is immediately visible to the publisher; status Waiting for Publisher", pSees);
  ok((await S.get(`/api/support/reader/${rId}`)).data.ticket.messages.length === 2, "full conversation history (sender, timestamp)");
  ok((await rNG.c.post(`/api/tickets/${rId}/reply`, { message: "Still blank, here is a screenshot description." })).status === 200 && (await pubB.c.post(`/api/tickets/${pId}/reply`, { message: "Thanks, resubmitting now." })).status === 200, "reader and publisher can answer");
  await sleep(300);
  const n3 = (await S.get("/api/notifications")).data.notifications.map((n: any) => n.type);
  ok(n3.includes("SUPPORT_MESSAGE") && n3.includes("USER_RESPONSE") && n3.includes("PUBLISHER_RESPONSE"), "support-message + user/publisher response notifications", [...new Set(n3)]);
  ok((await S.post(`/api/support/reader/${rId}/status`, { status: "WAITING_PUBLISHER" })).status === 400, "invalid status for the ticket type rejected");
  ok((await S.post(`/api/support/reader/${rId}/status`, { status: "CLOSED" })).status === 200, "ticket closed");
  const closedReply = await S.post(`/api/support/reader/${rId}/reply`, { message: "one more thing" });
  ok(closedReply.status === 409 && /closed/i.test(closedReply.data.error), "admin cannot reply to a closed ticket", closedReply.data);
  ok((await rNG.c.post(`/api/tickets/${rId}/reply`, { message: "hello?" })).status === 409, "closed ticket also blocks the reader (service enforces it too)");
  ok((await S.post(`/api/support/publisher/${pId}/status`, { status: "CLOSED" })).status === 200 && (await S.post(`/api/support/publisher/${pId}/reply`, { message: "late" })).status === 409, "closed publisher ticket blocks admin replies");
  ok((await S.post(`/api/support/reader/${rId}/status`, { status: "OPEN" })).status === 200 && (await S.post(`/api/support/reader/${rId}/reply`, { message: "Reopened — thanks for your patience." })).status === 200, "reopening allows replies again");
  ok((await S.post(`/api/support/nowhere/${rId}/reply`, { message: "x" })).status === 404, "unknown service rejected");

  // ============================================================== BOOK DELETION
  section("Deleting books without orphans");
  const rFree = all.books.filter((b: any) => b.source === "READER" && b.isFree)[1];
  const lib = await readerUser("lib", "NG");
  await lib.c.post(`/api/books/${rFree.id}/claim`);
  const ordFail = await buy(lib.c, all.books.find((b: any) => b.source === "READER" && !b.isFree).id, "failed");
  ok((await rdb.userBook.count({ where: { bookId: rFree.id } })) === 1, "reader has the free book in their library");
  ok((await S.del(`/api/books/${rFree.id}`)).status === 200, "Reader catalogue book deleted");
  ok((await rdb.userBook.count({ where: { bookId: rFree.id } })) === 0 && (await rdb.chapter.count({ where: { bookId: rFree.id } })) === 0 && !(await rdb.book.findUnique({ where: { id: rFree.id } })), "library entries and chapters removed — nothing orphaned");
  const paidReader = all.books.find((b: any) => b.source === "READER" && !b.isFree);
  const buyRead = await buy(rUS.c, paidReader.id);
  ok(buyRead.v?.data.status === "PAID", "a Reader catalogue paid book is bought");
  const blocked = await S.del(`/api/books/${paidReader.id}`);
  ok(blocked.status === 409 && blocked.data.fields?.code === "HAS_SALES" && /Archive/.test(blocked.data.error), "deleting a bought book is refused with an archive option", blocked.data);
  ok((await rdb.order.count({ where: { bookId: paidReader.id, status: "PAID" } })) === 1, "paid order untouched");
  const arch = await S.del(`/api/books/${paidReader.id}?archive=1`);
  ok(arch.status === 200, "book archived");
  ok(!(await rNG.c.get("/api/books")).data.books.some((b: any) => b.id === paidReader.id) && (await rUS.c.get(`/api/books/${paidReader.id}/chapters/0`)).status === 200, "archived book leaves the catalogue but the buyer keeps access");
  // publisher book with a sale
  const blockedPub = await S.del(`/api/books/${hl.id}`);
  ok(blockedPub.status === 409, "publisher book with paid sales can't be hard-deleted");
  ok((await S.del(`/api/books/${hl.id}?archive=1`)).status === 200, "publisher book archived");
  ok((await pdb.book.findUnique({ where: { id: bookA.id } })).status === "REMOVED", "Publisher record marked Removed (sales history kept)");
  ok(!(await rGB.c.get("/api/books")).data.books.some((b: any) => b.id === hl.id), "archived publisher book is gone from the catalogue");
  const hb = all.books.find((b: any) => b.title === "Harbour Notes");
  ok((await S.del(`/api/books/${hb.id}`)).status === 200, "unsold publisher book deleted");
  ok(!(await pdb.book.findUnique({ where: { id: bookB.id } })) && !(await rdb.book.findUnique({ where: { id: hb.id } })), "deleted from BOTH platforms — no orphan on either side");
  ok(!(await rdb.publisher.findFirst({ where: { externalId: pubB.id } })), "Reader's publisher reference cleaned up");
  ok((await pubB.c.get("/api/notifications")).data.notifications.some((n: any) => /deleted/i.test(n.title)), "publisher is told their book was deleted");

  // ============================================================== ADMIN MANAGEMENT & RBAC
  section("Admin management and permissions (server-enforced)");
  const mk = (over: Record<string, unknown>) => S.post("/api/admins", { name: "Test Admin", email: `a.${stamp}.${Math.random().toString(36).slice(2, 6)}@example.com`, role: "FINANCE", jobTitle: "Tester", password: "TempPassw0rd!", ...over });
  const fin = await mk({ role: "FINANCE", email: `fin.${stamp}@example.com` });
  ok(fin.status === 200 && fin.data.admin.permissions.includes("payouts") && !fin.data.admin.permissions.includes("users"), "Finance Admin created with role defaults", fin.data);
  ok((await mk({ email: `fin.${stamp}@example.com` })).status === 409, "duplicate admin email rejected");
  ok((await mk({ password: "short" })).status === 400, "weak admin password rejected");
  const FIN = new Client(BASE);
  ok((await FIN.post("/api/auth/login", { email: `fin.${stamp}@example.com`, password: "TempPassw0rd!" })).status === 200, "new admin signs in with the temporary password");
  ok((await FIN.get("/api/payouts")).status === 403 && /change your temporary password/i.test((await FIN.get("/api/payouts")).data.error), "temporary password must be changed before anything else works");
  ok((await FIN.post("/api/me/password", { currentPassword: "TempPassw0rd!", newPassword: "TempPassw0rd!", confirmPassword: "TempPassw0rd!" })).status === 400, "new password must differ");
  ok((await FIN.post("/api/me/password", { currentPassword: "TempPassw0rd!", newPassword: "FinanceNew#2026", confirmPassword: "FinanceNew#2026" })).status === 200, "password changed");
  ok((await FIN.get("/api/payouts")).status === 200 && (await FIN.get("/api/sales")).status === 200 && (await FIN.get("/api/transactions")).status === 200, "finance can use payouts, sales and transactions");
  const denied = async (c: Client, paths: string[], label: string) => { const bad: string[] = []; for (const p of paths) { const r = await c.get(p); if (r.status !== 403) bad.push(`${p}:${r.status}`); } ok(bad.length === 0, label, bad); };
  const someAtt = (await S.get(`/api/support/reader/${tPhotoR.data.ticket.id}`)).data.ticket.messages[0].attachments[0];
  ok((await FIN.get(someAtt.url)).status === 403, "an admin without the support permission can't open customer photos");
  await denied(FIN, ["/api/subscribers", "/api/support/unread", "/api/users", "/api/publishers", "/api/authors", "/api/books", "/api/book-review", "/api/support", "/api/activity", "/api/admins", `/api/users/${rNG.id}`, "/api/publisher-books"], "finance is blocked server-side from users, publishers, books, review, support, activity and admins");
  ok((await FIN.post(`/api/book-review/${bookC.id}/decision`, { action: "approve" })).status === 403 && (await FIN.del("/api/activity")).status === 403 && (await FIN.put("/api/settings/categories", { categories: ["X"] })).status === 403, "finance can't approve books, clear logs or change settings");
  const finDash = (await FIN.get("/api/dashboard")).data;
  ok(finDash.allowed.revenue && finDash.allowed.orders && finDash.reader.ok, "finance dashboard exposes revenue and orders");
  const fsearch = (await FIN.get("/api/search?q=reader")).data;
  ok(!fsearch.results.some((r: any) => r.type === "User" || r.type === "Book"), "global search respects permissions");
  const content = await mk({ role: "CONTENT", email: `content.${stamp}@example.com` });
  const CON = new Client(BASE); await CON.post("/api/auth/login", { email: `content.${stamp}@example.com`, password: "TempPassw0rd!" });
  await CON.post("/api/me/password", { currentPassword: "TempPassw0rd!", newPassword: "ContentNew#2026", confirmPassword: "ContentNew#2026" });
  ok((await CON.get("/api/book-review")).status === 200 && (await CON.get("/api/books")).status === 200 && (await CON.get("/api/payouts")).status === 403 && (await CON.get("/api/users")).status === 403, "content manager: books + review only");
  const sup2 = await mk({ role: "SUPPORT", email: `support.${stamp}@example.com` });
  const SUP = new Client(BASE); await SUP.post("/api/auth/login", { email: `support.${stamp}@example.com`, password: "TempPassw0rd!" });
  await SUP.post("/api/me/password", { currentPassword: "TempPassw0rd!", newPassword: "SupportNew#2026", confirmPassword: "SupportNew#2026" });
  ok((await SUP.get("/api/support")).status === 200 && (await SUP.get("/api/users")).status === 200 && (await SUP.get("/api/payouts")).status === 403 && (await SUP.get("/api/orders")).status === 403, "support admin: support + users");
  const supDash = (await SUP.get("/api/dashboard")).data;
  ok(supDash.allowed.users && supDash.allowed.publishers && !supDash.allowed.orders && !supDash.allowed.revenue && !supDash.allowed.books && supDash.recentReader === null, "dashboard only exposes cards (and data calls) the admin may see", supDash.allowed);
  ok((await FIN.get("/api/admins")).status === 403 && (await FIN.post("/api/admins", { name: "x", email: "x@example.com", role: "SUPER_ADMIN", password: "TempPassw0rd!" })).status === 403, "only a Super Admin can manage admins");
  // client-supplied role can't escalate
  ok((await FIN.patch("/api/me", { role: "SUPER_ADMIN", permissions: ["admins"] })).status === 200 && (await FIN.get("/api/admins")).status === 403 && (await FIN.get("/api/me")).data.admin.role === "FINANCE", "client-provided role / permissions are ignored");
  // permission change is immediate
  ok((await S.patch(`/api/admins/${fin.data.admin.id}`, { permissions: ["users", "payouts"] })).status === 200, "permissions changed by Super Admin");
  ok((await FIN.get("/api/users")).status === 200 && (await FIN.get("/api/sales")).status === 403, "new permissions apply to the existing session immediately");
  ok((await S.post(`/api/admins/${sup2.data.admin.id}/status`, { status: "SUSPENDED" })).status === 200 && (await SUP.get("/api/me")).status === 401, "suspended admin's session ends immediately");
  ok((await new Client(BASE).post("/api/auth/login", { email: `support.${stamp}@example.com`, password: "SupportNew#2026" })).status === 403, "suspended admin can't sign in");
  ok((await S.post(`/api/admins/${sup2.data.admin.id}/status`, { status: "ACTIVE" })).status === 200, "admin re-activated");
  ok((await S.del(`/api/admins/${me.admin.id}`)).status === 409 && (await S.post(`/api/admins/${me.admin.id}/status`, { status: "SUSPENDED" })).status === 409, "can't delete or suspend yourself");
  ok((await S.patch(`/api/admins/${me.admin.id}`, { role: "FINANCE" })).status === 409, "can't demote yourself (last Super Admin protected)");
  ok((await S.del(`/api/admins/${content.data.admin.id}`)).status === 200 && (await CON.get("/api/me")).status === 401, "admin deleted; session gone");
  ok((await S.get("/api/admins")).data.admins.length === 3, "admin list is accurate");

  // ============================================================== ACTIVITY LOG
  section("Activity log");
  const act = (await S.get("/api/activity")).data;
  const allActs: any[] = [...act.activities];
  for (let pg = 2; allActs.length < act.total && pg < 20; pg++) allActs.push(...(await S.get(`/api/activity?page=${pg}`)).data.activities);
  ok(allActs.length === act.total, "activity log pages through completely");
  const actions = new Set(allActs.map((a: any) => a.action));
  for (const a of ["Approved book", "Rejected book", "Suspended user", "Activated user", "Deleted user", "Suspended publisher", "Marked payout Paid", "Replied to support", "Deleted book", "Created admin", "Edited user"]) if (!actions.has(a)) ok(false, `logged: ${a}`, [...actions]);
  ok(allActs.every((a: any) => a.actorName && a.actorRole && a.action && a.createdAt), "entries carry actor, role, action, target, date and time");
  ok(allActs.some((a: any) => a.action === "Marked payout Paid" && /GTB-TRX/.test(a.details ?? "")) , "payout reference is audited");
  ok((await FIN.get("/api/activity")).status === 403, "only permitted admins read the log");
  ok((await S.get("/api/activity?q=payout")).data.activities.length >= 1, "activity search");
  ok((await FIN.del("/api/activity")).status === 403, "only a Super Admin can clear the log");
  const cl = await S.del("/api/activity");
  ok(cl.status === 200 && cl.data.cleared > 10, "Clear All Activities", cl.data);
  const after = (await S.get("/api/activity")).data;
  ok(after.total === 1 && after.activities[0].action === "Cleared all activity logs", "clearing is itself recorded", after);

  // ============================================================== SETTINGS
  section("Settings: profile, photo, password, platform configuration");
  const prof2 = await S.patch("/api/me", { name: "Chief Admin", phone: "+2348011112222", jobTitle: "Platform Owner", bio: "Runs the shelf." });
  ok(prof2.status === 200 && prof2.data.admin.name === "Chief Admin" && prof2.data.admin.jobTitle === "Platform Owner", "profile saved");
  const png = await sharp({ create: { width: 700, height: 500, channels: 3, background: "#aa6633" } }).png().toBuffer();
  const fd = new FormData(); fd.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "me.png");
  const av = await S.req("POST", "/api/me/avatar", fd);
  ok(av.status === 200 && av.data.avatarUpdatedAt, "profile photo uploaded");
  ok((await S.req("GET", `/api/avatar/${me.admin.id}`)).res.headers.get("content-type") === "image/jpeg", "photo served");
  const bad = new FormData(); bad.append("file", new Blob(["nope"], { type: "image/png" }), "x.png");
  ok((await S.req("POST", "/api/me/avatar", bad)).status === 415, "fake image rejected");
  ok((await new Client(BASE).get(`/api/avatar/${me.admin.id}`)).status === 401, "photos require an admin session");
  ok((await S.post("/api/me/password", { currentPassword: "nope", newPassword: "AnotherPass#1", confirmPassword: "AnotherPass#1" })).status === 400, "wrong current password rejected");
  ok((await S.post("/api/me/password", { currentPassword: SUPER.password, newPassword: "NewSuper#Pass2026", confirmPassword: "NewSuper#Pass2026" })).status === 200, "password changed");
  ok((await new Client(BASE).post("/api/auth/login", SUPER)).status === 401 && (await new Client(BASE).post("/api/auth/login", { email: SUPER.email, password: "NewSuper#Pass2026" })).status === 200, "old password no longer works");
  const sv = (await S.get("/api/settings")).data;
  ok(sv.version === "v1.0.0" && sv.developer === "Trinity Media Global" && sv.copyright === "© 2026 Ebookvox", "app version, developer and copyright");
  const cat = await S.put("/api/settings/categories", { categories: ["Classic Fiction", "Poetry", "Mystery", "Afrofuturism"] });
  ok(cat.status === 200 && cat.data.warnings.length === 0, "categories saved and pushed to the Publisher platform", cat.data);
  const pcfg = (await pubC.c.get("/api/config")).data;
  ok(pcfg.categories.includes("Afrofuturism") && !pcfg.categories.includes("Horror"), "Publisher upload form now uses the new categories");
  const fdNew = await pubC.c.req("POST", "/api/books", await bookForm({ title: "New Category Book", category: "Afrofuturism" }));
  ok(fdNew.status === 200, "a book in the new category is accepted");
  const fdOld = await pubC.c.req("POST", "/api/books", await bookForm({ title: "Old Category Book", category: "Horror" }));
  ok(fdOld.status === 400, "a removed category is rejected", fdOld.data);
  const cur = await S.put("/api/settings/currency", { minWithdrawals: { NGN: 50000, USD: 100, GBP: 80, EUR: 95 } });
  ok(cur.status === 200 && (await pubA.c.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN").minWithdrawal === 5000000, "minimum withdrawal configuration reaches the Publisher platform");
  const lowWd = await pubA.c.post("/api/withdrawals", { currency: "NGN", amount: 30000 });
  ok(lowWd.status === 422 && /₦50,000/.test(lowWd.data.error), "new minimum is enforced", lowWd.data);
  await S.put("/api/settings/currency", { minWithdrawals: { NGN: 100000, USD: 100, GBP: 80, EUR: 95 } });
  ok((await S.put("/api/settings/voice", { defaultVoice: "en-GB-RyanNeural" })).status === 200, "default voice saved and pushed to the Reader");
  const nv = await readerUser("voicecheck", "NG");
  ok(nv.r.data.user.defaultVoice === "en-NG-EzinneNeural", "new readers start with a voice matching their country; the Admin default only applies to countries we can't place", nv.r.data.user.defaultVoice);
  ok((await S.put("/api/settings/company", { name: "Ebookvox", address: "Lagos", website: "https://ebookvox.example" })).status === 200 && (await S.put("/api/settings/supportEmail", { supportEmail: "help@ebookvox.example" })).status === 200, "company information and support email saved");
  ok((await S.put("/api/settings/supportEmail", { supportEmail: "not-an-email" })).status === 400, "settings are validated");
  ok((await S.get("/api/settings")).data.settings.supportEmail === "help@ebookvox.example", "settings persist");
  ok((await S.put("/api/settings/nonsense", {})).status === 404, "unknown section rejected");

  // ============================================================== GLOBAL SEARCH
  section("Global search");
  const g1 = (await S.get("/api/search?q=Aurora")).data;
  ok(g1.results.some((r: any) => r.type === "Publisher" && /publishers\//.test(r.link)), "finds publishers");
  const g2 = (await S.get("/api/search?q=reader-ng")).data;
  ok(g2.results.some((r: any) => r.type === "User" && r.link === `/users/${rNG.id}`), "finds users with a link to the record");
  const g3 = (await S.get("/api/search?q=Pat%20Writer")).data;
  ok(g3.results.some((r: any) => r.type === "Author"), "finds authors", g3.results.map((r: any) => r.type));
  const g4 = (await S.get("/api/search?q=Dracula")).data;
  ok(g4.results.some((r: any) => r.type === "Book" && r.meta.includes("Reader")), "finds books with source metadata");
  const ordNo = (await rdb.order.findFirst({ where: { status: "PAID" } })).number;
  ok((await S.get(`/api/search?q=${ordNo}`)).data.results.some((r: any) => r.type === "Order"), "finds orders by number");
  ok((await S.get("/api/search?q=SALE-")).data.results.some((r: any) => r.type === "Transaction"), "finds transactions");

  // ============================================================== SERVICE FAILURE
  section("Service failure handling (Publisher stopped)");
  execSync('pkill -f "next start -p 3340" || true');
  await sleep(1500);
  const dDown = (await S.get("/api/dashboard")).data;
  ok(dDown.reader.ok === true && dDown.publisher.ok === false && /Publisher service is temporarily unavailable/.test(dDown.publisher.error), "dashboard keeps Reader data and flags Publisher as unavailable (not zero)", dDown.publisher);
  const pDown = await S.get("/api/publishers");
  ok(pDown.status === 502 && /Publisher service is temporarily unavailable/.test(pDown.data.error) && pDown.data.service === "publisher" && pDown.data.unavailable === true, "publisher list returns a clear 502 naming the service", pDown.data);
  ok((await S.get("/api/users")).status === 200, "Reader-backed pages still work");
  const stDown = (await S.get("/api/status")).data.services;
  ok(stDown.find((x: any) => x.service === "publisher").ok === false && stDown.find((x: any) => x.service === "reader").ok === true, "status endpoint distinguishes which service is down");
  const tDown = (await S.get("/api/transactions")).data;
  ok(tDown.unavailable.includes("Publisher") && tDown.transactions.some((t: any) => t.kind === "PURCHASE"), "transactions keeps Reader rows and reports Publisher as unavailable");
  const supDown = (await S.get("/api/support")).data;
  ok(supDown.unavailable.includes("Publisher") && supDown.tickets.every((t: any) => t.service === "reader") && supDown.tickets.length > 0, "support inbox keeps Reader tickets and reports Publisher unavailable");
  ok((await adb.serviceErrorLog.count({ where: { service: "publisher" } })) > 0, "technical errors are logged");
  ok((await S.get("/api/search?q=Aurora")).data.unavailable.includes("Publisher"), "search reports the unavailable service");

  const an = (await S.get("/api/notifications")).data.notifications.length;
  ok((await new Client(BASE).req("DELETE", "/api/notifications")).status === 401, "clearing notifications requires an admin session");
  const ac = await S.req("DELETE", "/api/notifications");
  const aAfter = (await S.get("/api/notifications")).data;
  ok(an > 0 && ac.status === 200 && aAfter.notifications.length === 0 && aAfter.unread === 0, "Clear all removes the admin's notifications", { an, aAfter });

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await adb.$disconnect(); await rdb.$disconnect(); await pdb.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
