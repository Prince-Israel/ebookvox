import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
// The Reader has its own generated Prisma client (root project).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: ReaderPrisma } = require("/Users/mac/Development/ebookvox/node_modules/@prisma/client");

const BASE = process.env.BASE!, READER = process.env.READER!, MOCK = "http://localhost:4010";
const db = new PrismaClient();
const rdb = new ReaderPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/prisma/test-pub.db" } } });

let pass = 0; const failures: string[] = [];
const ok = (c: unknown, n: string, d?: unknown) => { if (c) { pass++; console.log("  ✓", n); } else { failures.push(n); console.log("  ✗", n, d !== undefined ? JSON.stringify(d).slice(0, 400) : ""); } };
const section = (s: string) => console.log(`\n${s}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => Promise<T | false | null | undefined>, ms = 40000): Promise<T | null> { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(500); } return null; }

class Client {
  jar = new Map<string, string>();
  constructor(public base = BASE, public country = "NG") {}
  async req(method: string, path: string, body?: unknown, extra: RequestInit = {}) {
    const headers = new Headers(extra.headers);
    headers.set("cf-ipcountry", this.country); // the visitor's location as a CDN reports it (the Reader prices by it)
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
const signup = (c: Client, tag: string, country: string, phone = "8012345678", first = "Pub") => c.post("/api/auth/signup", { firstName: first, lastName: tag, email: `${tag}.${stamp}@example.com`, password: pw, confirmPassword: pw, country, phoneCountry: country, phone });
const verifyEmail = async (c: Client, tag: string) => {
  const email = `${tag}.${stamp}@example.com`;
  const log = await db.emailLog.findFirst({ where: { toEmail: email, subject: { contains: "Verify" } }, orderBy: { createdAt: "desc" } });
  const token = log?.body.match(/token=([\w-]+)/)?.[1];
  return c.post("/api/auth/verify", { token });
};
const getToken = async (email: string, kind: string) => (await db.emailLog.findFirst({ where: { toEmail: email, subject: { contains: kind } }, orderBy: { createdAt: "desc" } }))?.body.match(/token=([\w-]+)/)?.[1];

const BOOK_TEXT = "# Chapter One\n\n" + Array.from({ length: 12 }, (_, i) => `This is paragraph ${i + 1} of the first chapter. It tells a story about a lighthouse keeper who climbs the stairs every evening.`).join("\n\n") + "\n\n# Chapter Two\n\n" + Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} of chapter two continues the tale beyond the sea and into the harbour town.`).join("\n\n");
async function cover(w = 600, h = 900) { return sharp({ create: { width: w, height: h, channels: 3, background: "#b5703f" } }).jpeg().toBuffer(); }
async function bookForm(over: Record<string, any> = {}, opts: { cover?: boolean | Buffer; file?: "txt" | "docx" | "pdf" | false | { name: string; data: Buffer | string; type?: string } } = {}) {
  const fd = new FormData();
  const f = { title: "The Lighthouse Keeper", author: "Ada Okafor", category: "Classic Fiction", description: "A calm and moving story about a keeper of the light and the town that depends on him.", isFree: false, prices: { NGN: 15000000 }, ...over };
  for (const [k, v] of Object.entries(f)) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  if (opts.cover !== false) fd.append("cover", new Blob([new Uint8Array(Buffer.isBuffer(opts.cover) ? opts.cover : await cover())], { type: "image/jpeg" }), "cover.jpg");
  const kind = opts.file ?? "txt";
  if (kind === "txt") fd.append("file", new Blob([BOOK_TEXT], { type: "text/plain" }), "book.txt");
  else if (kind === "docx") {
    const children = BOOK_TEXT.split("\n\n").map((t) => t.startsWith("# ") ? new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1 }) : new Paragraph(t));
    fd.append("file", new Blob([new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "book.docx");
  } else if (kind === "pdf") {
    const pd = await PDFDocument.create(); const font = await pd.embedFont(StandardFonts.Helvetica); const pg = pd.addPage([595, 842]); let y = 780;
    for (const t of BOOK_TEXT.replace(/# /g, "").split("\n\n").slice(0, 12)) { pg.drawText(t.slice(0, 80), { x: 40, y, size: 10, font }); y -= 40; }
    fd.append("file", new Blob([new Uint8Array(await pd.save())], { type: "application/pdf" }), "book.pdf");
  } else if (kind) fd.append("file", new Blob([typeof kind.data === "string" ? kind.data : new Uint8Array(kind.data)], { type: kind.type ?? "application/octet-stream" }), kind.name);
  return fd;
}

async function readerSignup(tag: string, country: string) {
  const c = new Client(READER, country);
  const r = await c.post("/api/auth/signup", { firstName: "Buyer", lastName: tag, email: `${tag}.${stamp}@example.com`, password: pw, confirmPassword: pw, country, phoneCountry: country, phone: country === "NG" ? "8012345678" : country === "GB" ? "7700900123" : "2025550123" });
  await rdb.user.updateMany({ where: { email: `${tag}.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  return { c, r };
}
async function readerBuy(c: Client, bookId: string) {
  const co = await c.post("/api/checkout", { bookId });
  if (co.status !== 200) return { co, v: null as any };
  await fetch(`${MOCK}/__set/${co.data.reference}/success`);
  const v = await c.get(`/api/checkout/verify?reference=${co.data.reference}`);
  return { co, v };
}

async function main() {
  // ============================================================ AUTH
  section("Authentication & verification");
  const A = new Client();
  ok((await A.get("/api/me")).status === 401, "unauthenticated /api/me rejected");
  ok((await A.get("/api/books")).status === 401, "books API requires login");
  const rd = await A.get("/dashboard");
  ok([307, 308].includes(rd.status), "dashboard redirects when signed out");
  const bp = await signup(A, "badphone", "NG", "80abc12345");
  ok(bp.status === 400 && bp.data.fields?.phone, "phone rejects letters", bp.data);
  ok((await A.post("/api/auth/signup", { firstName: "x", lastName: "y", email: "nope", password: "short", confirmPassword: "z", country: "NG", phoneCountry: "NG", phone: "8012345678" })).status === 400, "invalid email/password rejected");
  const su = await signup(A, "ng-pub", "NG");
  ok(su.status === 200 && su.data.user.currency === "NGN" && su.data.user.phone === "+2348012345678" && !su.data.user.emailVerified && su.data.user.role === "PUBLISHER", "signup (NG → NGN, E.164 phone, unverified)", su.data);
  ok(!JSON.stringify(su.data).includes("passwordHash"), "password hash not exposed");
  ok((await signup(new Client(), "ng-pub", "NG")).status === 409, "duplicate email rejected");
  ok((await A.get("/api/books")).status === 403, "unverified publisher is blocked server-side from publisher APIs");
  ok((await A.post("/api/books", new FormData())).status === 403, "unverified publisher cannot upload");
  ok((await A.post("/api/auth/verify", { token: "invalid-token-value" })).status === 400, "bad verification token rejected");
  ok((await verifyEmail(A, "ng-pub")).status === 200, "email verification works");
  ok((await A.get("/api/books")).status === 200, "verified publisher gains access");
  ok((await A.post("/api/auth/signout")).status === 200 && (await A.get("/api/me")).status === 401, "logout kills session");
  ok((await A.post("/api/auth/signin", { email: `ng-pub.${stamp}@example.com`, password: "Wrong1234" })).status === 401, "wrong password rejected");
  ok((await A.post("/api/auth/signin", { email: `ng-pub.${stamp}@example.com`, password: pw })).status === 200, "login works");
  // reader and publisher sessions are separate
  const crossReader = new Client(READER); crossReader.jar = new Map(A.jar);
  ok((await crossReader.get("/api/me")).status === 401, "publisher session is not valid on the Reader");
  await A.post("/api/auth/forgot", { email: `ng-pub.${stamp}@example.com` });
  const rt = await getToken(`ng-pub.${stamp}@example.com`, "Reset");
  ok(!!rt && (await new Client().post("/api/auth/reset", { token: rt, password: "N3wPassword", confirmPassword: "N3wPassword" })).status === 200, "password reset works");
  ok((await new Client().post("/api/auth/reset", { token: rt, password: "N3wPassword", confirmPassword: "N3wPassword" })).status === 400, "reset token single-use");
  ok((await A.post("/api/auth/signin", { email: `ng-pub.${stamp}@example.com`, password: "N3wPassword" })).status === 200, "login with new password");

  // ============================================================ PROFILE
  section("Profile, avatar, password");
  const me = (await A.get("/api/me")).data.user;
  ok((await A.patch("/api/me", { phone: "a@b.com", phoneCountry: "NG" })).status === 400, "profile phone rejects text");
  const pr = await A.patch("/api/me", { publisherName: "Okafor House", firstName: "Ada", bio: "I write about the sea.", phone: "8031234567", phoneCountry: "NG" });
  ok(pr.status === 200 && pr.data.user.publisherName === "Okafor House" && pr.data.user.bio === "I write about the sea." && pr.data.user.phone === "+2348031234567", "profile saved", pr.data);
  const png = await sharp({ create: { width: 700, height: 500, channels: 3, background: "#aa6633" } }).png().toBuffer();
  const fd = new FormData(); fd.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "me.png");
  ok((await A.req("POST", "/api/me/avatar", fd)).status === 200, "avatar upload");
  const av = await A.req("GET", `/api/avatar/${me.id}`);
  ok(av.status === 200 && av.res.headers.get("content-type") === "image/jpeg", "avatar served");
  const fdb = new FormData(); fdb.append("file", new Blob(["nope"], { type: "image/png" }), "x.png");
  ok((await A.req("POST", "/api/me/avatar", fdb)).status === 415, "fake image rejected");
  ok((await new Client().get(`/api/avatar/${me.id}`)).status === 401, "avatar requires login");
  ok((await A.post("/api/me/password", { currentPassword: "bad", newPassword: "Another1Pass", confirmPassword: "Another1Pass" })).status === 400, "change password needs correct current password");
  ok((await A.post("/api/me/password", { currentPassword: "N3wPassword", newPassword: "Another1Pass", confirmPassword: "Another1Pass" })).status === 200, "change password");

  // ============================================================ BOOKS
  section("Book upload, drafts, review flow");
  const cr = await A.req("POST", "/api/books", await bookForm());
  ok(cr.status === 200, "TXT book + cover saved as draft", cr.data);
  const bookId = cr.data.id;
  const b0 = (await A.get(`/api/books/${bookId}`)).data.book;
  ok(b0.status === "DRAFT" && b0.hasCover && b0.hasFile && b0.fileKind === "TXT" && b0.prices.NGN === 15000000, "draft stored with cover, file and prices", b0);
  ok((await A.req("GET", b0.coverUrl)).status === 200, "owner can load draft cover");
  ok((await new Client().req("GET", b0.coverUrl)).status === 404, "draft cover is private");
  const dx = await A.req("POST", "/api/books", await bookForm({ title: "DOCX Book" }, { file: "docx" }));
  ok(dx.status === 200 && (await A.get(`/api/books/${dx.data.id}`)).data.book.fileKind === "DOCX", "DOCX upload accepted");
  const pd = await A.req("POST", "/api/books", await bookForm({ title: "PDF Book" }, { file: "pdf" }));
  ok(pd.status === 200 && (await A.get(`/api/books/${pd.data.id}`)).data.book.fileKind === "PDF", "PDF upload accepted");
  const bad = async (label: string, form: FormData, status: number) => { const r = await A.req("POST", "/api/books", form); ok(r.status === status, label, r.data); };
  await bad("EXE file rejected", await bookForm({}, { file: { name: "x.exe", data: "MZ" } }), 415);
  await bad("fake PDF rejected (integrity)", await bookForm({}, { file: { name: "x.pdf", data: "not a pdf", type: "application/pdf" } }), 422);
  await bad("mismatched MIME rejected", await bookForm({}, { file: { name: "x.txt", data: "hello world", type: "application/pdf" } }), 415);
  await bad("non-image cover rejected", await bookForm({}, { cover: Buffer.from("text") }), 415);
  await bad("tiny cover rejected", await bookForm({}, { cover: await cover(100, 100) }), 422);
  await bad("missing title rejected", await bookForm({ title: "" }), 400);
  await bad("unknown category rejected", await bookForm({ category: "Nonsense" }), 400);
  const inc = await A.req("POST", "/api/books", await bookForm({ title: "Incomplete" }, { cover: false, file: false }));
  ok(inc.status === 200, "incomplete draft can be saved");
  const sInc = await A.post(`/api/books/${inc.data.id}/submit`);
  ok(sInc.status === 422 && sInc.data.fields.cover && sInc.data.fields.file, "submitting an incomplete book lists what's missing", sInc.data);
  const up = await A.req("PATCH", `/api/books/${inc.data.id}`, await bookForm({ title: "Incomplete (fixed)" }));
  ok(up.status === 200 && (await A.get(`/api/books/${inc.data.id}`)).data.book.hasCover, "draft edit adds cover + file");
  ok((await A.del(`/api/books/${inc.data.id}`)).status === 200, "draft can be deleted");
  const unpriced = await A.req("POST", "/api/books", await bookForm({ title: "No price", prices: { USD: 100 } }));
  ok((await A.post(`/api/books/${unpriced.data.id}/submit`)).status === 422, "paid book needs a price in the publisher's own currency to submit (a USD price from an NGN publisher is ignored)");

  ok((await A.post(`/api/books/${bookId}/submit`)).status === 200, "Submit for Review");
  ok((await A.get(`/api/books/${bookId}`)).data.book.status === "REVIEWING", "status → Reviewing");
  ok((await A.req("PATCH", `/api/books/${bookId}`, await bookForm())).status === 409, "can't edit while reviewing");
  ok((await A.del(`/api/books/${bookId}`)).status === 409, "can't delete while reviewing");
  ok((await A.post(`/api/books/${bookId}/submit`)).status === 409, "can't double-submit");
  const rdr = new Client(READER);
  const { c: rNG } = await readerSignup("reader-ng", "NG");
  ok(!(await rNG.get("/api/books")).data.books.some((b: any) => b.title === "The Lighthouse Keeper"), "book NOT visible in Reader before approval");

  section("Admin review → Reader synchronisation");
  const ADM = new Client();
  ok((await ADM.post("/api/auth/signin", { email: "admin@publisher.ebookvox.app", password: "ChangeMe!2026" })).status === 200, "admin signs in");
  ok((await A.get("/api/admin/review")).status === 403, "publisher cannot use admin APIs");
  ok((await A.post(`/api/admin/review/${bookId}`, { action: "approve" })).status === 403, "publisher cannot approve own book (bypass blocked)");
  const q = (await ADM.get("/api/admin/review")).data.books;
  ok(q.some((b: any) => b.id === bookId), "book appears in admin review queue");
  ok((await ADM.post(`/api/admin/review/${bookId}`, { action: "reject" })).status === 400, "rejection requires a reason");
  ok((await ADM.post(`/api/admin/review/${bookId}`, { action: "reject", reason: "The cover text is unreadable. Please upload a clearer cover." })).status === 200, "admin rejects with reason");
  const rej = (await A.get(`/api/books/${bookId}`)).data.book;
  ok(rej.status === "REJECTED" && /cover text is unreadable/.test(rej.rejectionReason), "publisher sees the rejection reason", rej);
  ok((await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "BOOK_REJECTED"), "rejection notification");
  ok(!(await rNG.get("/api/books")).data.books.some((b: any) => b.title === "The Lighthouse Keeper"), "rejected book not in Reader");
  ok((await A.req("PATCH", `/api/books/${bookId}`, await bookForm({ title: "The Lighthouse Keeper" }))).status === 200, "rejected book can be edited");
  ok((await A.post(`/api/books/${bookId}/submit`)).status === 200 && (await A.get(`/api/books/${bookId}`)).data.book.status === "REVIEWING", "resubmitted → Reviewing again");
  const ap = await ADM.post(`/api/admin/review/${bookId}`, { action: "approve" });
  ok(ap.status === 200 && ap.data.status === "PUBLISHED", "admin approves → Published", ap.data);
  const live = (await rNG.get("/api/books")).data.books.find((b: any) => b.title === "The Lighthouse Keeper");
  ok(live && live.author === "Ada Okafor" && live.category === "Classic Fiction" && live.price.currency === "NGN" && live.price.amountMinor === 15000000 && live.coverUrl === `/api/books/${live.id}/cover`, "book is live in Reader with price, author, category and cover", live);
  const det = (await rNG.get(`/api/books/${live.id}`)).data;
  ok(det.book.publisher === "Okafor House" && det.book.description.includes("keeper of the light") && det.book.chapterCount >= 2, "Reader details: publisher, description, chapters", det.book);
  const rcover = await new Client(READER).req("GET", live.coverUrl);
  ok(rcover.status === 200 && (rcover.res.headers.get("content-type") ?? "").startsWith("image/"), "the Reader serves the approved cover itself (proxied from the Publisher), so phones can load it");
  ok((await new Client().req("GET", `/api/covers/${bookId}`)).status === 200, "the Publisher's own cover endpoint serves the approved cover publicly");
  ok((await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "BOOK_APPROVED") && (await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "BOOK_PUBLISHED"), "approved + published notifications");
  const bk = (await A.get("/api/books?status=APPROVED,PUBLISHED")).data;
  ok(bk.books.length === 1 && bk.counts.PUBLISHED === 1, "My Books → Approved lists it");

  // ============================================================ SALES
  section("Sales, 85/15 split, wallet");
  const sale1 = await readerBuy(rNG, live.id);
  ok(sale1.v?.data.status === "PAID", "Reader buyer pays (Paystack verified server-side)", sale1.v?.data);
  const sales = await until(async () => { const s = (await A.get("/api/sales")).data; return s.sales.length ? s : false; });
  ok(sales && sales.sales.length === 1, "sale arrives at Publisher via signed webhook");
  const s = sales!.sales[0];
  ok(s.earnedMinor === 12750000 && s.currency === "NGN" && s.status === "PAID" && /Buyer/.test(s.buyer), "₦150,000 sale → publisher sees ₦127,500 (85%)", s);
  ok(!("grossMinor" in s) && !("platformMinor" in s) && !("grossMinor" in sales!.totals[0]) && !("platformMinor" in sales!.totals[0]), "publisher is never shown the gross price or the platform's 15%");
  const dbSale = (await db.sale.findMany({ where: { number: s.number } }))[0];
  ok(dbSale.grossMinor === 15000000 && dbSale.publisherMinor === 12750000 && dbSale.platformMinor === 2250000 && dbSale.publisherMinor + dbSale.platformMinor === dbSale.grossMinor, "stored split is exactly 85/15 and adds back to the gross", dbSale);
  const w1 = (await A.get("/api/wallet")).data;
  const ngn = w1.wallets.find((w: any) => w.currency === "NGN");
  ok(ngn.available === 12750000 && ngn.earned === 12750000 && ngn.withdrawn === 0 && ngn.pending === 0, "wallet credited with the 85% share", ngn);
  ok(w1.transactions.filter((t: any) => t.type === "SALE_CREDIT").length === 1 && w1.transactions[0].amountMinor === 12750000, "sale has a matching wallet transaction");
  const nn = (await A.get("/api/notifications")).data.notifications.map((n: any) => n.type);
  ok(nn.includes("SALE_COMPLETED") && nn.includes("EARNINGS_CREDITED"), "sale + earnings notifications");
  // webhook integrity
  const evt = JSON.stringify({ type: "sale.completed", data: { orderId: "fake-1", orderNumber: "ORD-FAKE", bookExternalId: bookId, buyer: "Evil E.", amountMinor: 99999999, currency: "NGN", paidAt: new Date().toISOString() } });
  ok((await fetch(`${BASE}/api/webhooks/reader`, { method: "POST", body: evt, headers: { "x-ebookvox-signature": "deadbeef" } })).status === 401, "unsigned/forged webhook rejected — sales can't be faked");
  const sig = createHmac("sha256", "test-webhook-secret").update(evt).digest("hex");
  ok((await fetch(`${BASE}/api/webhooks/reader`, { method: "POST", body: evt, headers: { "x-ebookvox-signature": sig } })).status === 200, "(properly signed event is accepted)");
  ok((await fetch(`${BASE}/api/webhooks/reader`, { method: "POST", body: evt, headers: { "x-ebookvox-signature": sig } })).status === 200 && (await db.sale.count({ where: { readerOrderId: "fake-1" } })) === 1, "duplicate delivery is idempotent");
  await db.walletTx.deleteMany({ where: { sale: { readerOrderId: "fake-1" } } }); await db.sale.deleteMany({ where: { readerOrderId: "fake-1" } }); // remove the synthetic sale used for the idempotency check
  const badAmt = JSON.stringify({ type: "sale.completed", data: { orderId: "x2", bookExternalId: bookId, amountMinor: -5, currency: "NGN" } });
  ok((await fetch(`${BASE}/api/webhooks/reader`, { method: "POST", body: badAmt, headers: { "x-ebookvox-signature": createHmac("sha256", "test-webhook-secret").update(badAmt).digest("hex") } })).status === 400, "invalid amounts rejected");

  // multi-currency: UK buyer pays GBP → GBP wallet
  const { c: rGB } = await readerSignup("reader-gb", "GB");
  const sale2 = await readerBuy(rGB, live.id);
  ok(sale2.v?.data.status === "PAID", "UK buyer pays in GBP");
  const w2 = await until(async () => { const w = (await A.get("/api/wallet")).data; return w.wallets.find((x: any) => x.currency === "NGN")?.available >= 25500000 ? w : false; });
  const ngn2 = w2?.wallets.find((x: any) => x.currency === "NGN");
  ok(ngn2?.available === 25500000 && !w2.wallets.some((x: any) => x.currency === "GBP" && x.earned > 0), "a GBP purchase still credits the publisher in NGN (their own currency) — never in the buyer's currency", ngn2);
  const gbSale = (await db.sale.findMany({ where: { paidCurrency: "GBP" } }))[0];
  ok(gbSale?.currency === "NGN" && gbSale.grossMinor === 15000000 && gbSale.publisherMinor === 12750000 && gbSale.paidMinor! > 0 && gbSale.paidMinor! < 15000000, "sale keeps the buyer's GBP payment on record but the split is on the NGN list price", gbSale);
  const dash = (await A.get("/api/dashboard?range=30d")).data;
  ok(dash.books.total === 4 && dash.books.approved === 1 && dash.books.drafts === 3 && dash.lifetime.length === 1 && dash.top[0]?.title === "The Lighthouse Keeper" && dash.series.length >= 30, "dashboard aggregates come from the database", { books: dash.books, top: dash.top });
  for (const r of ["7d", "30d", "3m", "6m", "1y"]) if ((await A.get(`/api/dashboard?range=${r}`)).status !== 200) ok(false, `range ${r}`);
  ok(true, "all dashboard ranges respond");

  // ============================================================ PAYOUTS
  section("Payment method & withdrawals (Nigeria)");
  ok((await A.get("/api/payment-method")).data.required === "BANK", "Nigerian publisher → bank transfer");
  const wdBad = async (amount: number, cur = "NGN") => A.post("/api/withdrawals", { currency: cur, amount });
  const noPm = await wdBad(100000);
  ok(noPm.status === 422 && /payment method/i.test(noPm.data.error), "withdrawal needs a payment method", noPm.data);
  ok((await A.put("/api/payment-method", { bankCode: "058", accountName: "Ada Okafor", accountNumber: "12345" })).status === 400, "bank account number must be 10 digits");
  ok((await A.put("/api/payment-method", { bankCode: "999", accountName: "Ada Okafor", accountNumber: "0123456789" })).status === 400, "unknown bank rejected");
  ok((await A.put("/api/payment-method", { paypalEmail: "x@y.com" })).status === 400, "PayPal not accepted for Nigerian publisher");
  ok((await A.put("/api/payment-method", { bankCode: "058", accountName: "Ada Okafor", accountNumber: "0123456789" })).status === 200, "bank details saved");
  const pm = (await A.get("/api/payment-method")).data.method;
  ok(pm.bankName === "Guaranty Trust Bank (GTBank)" && pm.accountNumberMasked.endsWith("6789"), "bank details stored", pm);
  const below = await wdBad(99999);
  ok(below.status === 422 && /minimum/i.test(below.data.error) && /100,000/.test(below.data.error), "below ₦100,000 minimum rejected", below.data);
  const over = await wdBad(300000);
  ok(over.status === 422 && /available balance is insufficient/.test(over.data.error), "above available balance rejected with a clear message", over.data);
  ok((await wdBad(100000, "GBP")).status === 422, "GBP minimum enforced separately");
  const [r1, r2] = await Promise.all([A.post("/api/withdrawals", { currency: "NGN", amount: 100000 }), A.post("/api/withdrawals", { currency: "NGN", amount: 100000 })]);
  ok([r1.status, r2.status].sort().join() === "200,409", "two simultaneous requests → exactly one succeeds (no duplicates)", [r1.status, r2.status]);
  const wd = (await A.get("/api/withdrawals")).data.withdrawals;
  ok(wd.length === 1 && wd[0].status === "PROCESSING" && wd[0].amountMinor === 10000000 && wd[0].method === "BANK", "withdrawal Processing", wd);
  const w3 = (await A.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN");
  ok(w3.available === 15500000 && w3.pending === 10000000 && w3.withdrawn === 0, "balance held: available ₦155,000, pending ₦100,000", w3);
  const dup = await wdBad(100000);
  ok(dup.status === 409 || dup.status === 422, "another request while processing is blocked", dup.data);
  ok((await A.get("/api/notifications")).data.notifications.filter((n: any) => /WITHDRAWAL_(REQUESTED|PROCESSING)/.test(n.type)).length === 2, "withdrawal requested + processing notifications");
  // admin processing
  const wid = wd[0].id;
  ok((await A.post(`/api/admin/withdrawals/${wid}`, { action: "paid", reference: "TRX-0001-OK" })).status === 403, "publisher cannot process payouts");
  ok((await ADM.post(`/api/admin/withdrawals/${wid}`, { action: "reject" })).status === 400, "rejection needs a reason");
  ok((await ADM.post(`/api/admin/withdrawals/${wid}`, { action: "reject", reason: "Account name doesn't match your profile." })).status === 200, "admin rejects withdrawal");
  const wRej = (await A.get("/api/withdrawals")).data.withdrawals[0];
  const w4 = (await A.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN");
  ok(wRej.status === "REJECTED" && wRej.reason && w4.available === 25500000 && w4.pending === 0, "rejected → funds returned to wallet", { wRej, w4 });
  ok((await ADM.post(`/api/admin/withdrawals/${wid}`, { action: "paid", reference: "TRX-0001-OK" })).status === 409, "processed withdrawal can't be processed twice");
  const again = await A.post("/api/withdrawals", { currency: "NGN", amount: 100000 });
  ok(again.status === 200, "can request again after rejection");
  ok((await ADM.post(`/api/admin/withdrawals/${again.data.withdrawal.id}`, { action: "paid", reference: "TRX-0001-OK" })).status === 200, "admin marks paid");
  const w5 = (await A.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN");
  ok(w5.withdrawn === 10000000 && w5.available === 15500000 && w5.pending === 0 && w5.earned === 25500000, "wallet: withdrawn ₦100,000, available ₦155,000", w5);
  const hist = (await A.get("/api/withdrawals")).data.withdrawals;
  ok(hist.map((h: any) => h.status).sort().join() === "PAID,REJECTED" && hist.every((h: any) => h.number && h.method && h.requestedAt), "payout history shows ID, method, dates, status");
  ok((await A.get("/api/wallet")).data.transactions.some((t: any) => t.type === "WITHDRAWAL_REFUND") && (await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "WITHDRAWAL_PAID") && (await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "WITHDRAWAL_REJECTED"), "ledger + paid/rejected notifications");

  section("International publisher (PayPal, USD)");
  const I = new Client();
  ok((await signup(I, "us-pub", "US", "2025550123")).data.user.currency === "USD", "US publisher → USD");
  await verifyEmail(I, "us-pub");
  ok((await I.get("/api/payment-method")).data.required === "PAYPAL", "international → PayPal");
  ok((await I.put("/api/payment-method", { paypalEmail: "not-an-email" })).status === 400, "PayPal email validated");
  ok((await I.put("/api/payment-method", { bankCode: "058", accountName: "A B", accountNumber: "0123456789" })).status === 400, "bank not accepted for international publisher");
  ok((await I.put("/api/payment-method", { paypalEmail: "payments@example.com" })).status === 200, "PayPal saved");
  const ib = await I.req("POST", "/api/books", await bookForm({ title: "Ocean Notes", prices: { USD: 20000 } }, { file: "docx" }));
  ok((await I.post(`/api/books/${ib.data.id}/submit`)).status === 200 && (await ADM.post(`/api/admin/review/${ib.data.id}`, { action: "approve" })).data.status === "PUBLISHED", "international book submitted and published");
  const { c: rUS } = await readerSignup("reader-us", "US");
  const liveUS = (await rUS.get("/api/books")).data.books.find((b: any) => b.title === "Ocean Notes");
  ok(liveUS?.price.currency === "USD" && liveUS.price.amountMinor === 20000, "US reader sees $200");
  const ngView = (await rNG.get("/api/books")).data.books.find((b: any) => b.title === "Ocean Notes");
  ok(ngView?.price.currency === "NGN" && ngView.price.amountMinor > 20000 * 500, "a Nigerian reader sees the same $200 book converted to naira at the international rate", ngView?.price);
  ok((await readerBuy(rUS, liveUS.id)).v?.data.status === "PAID", "US reader pays");
  const iw = await until(async () => { const w = (await I.get("/api/wallet")).data; return w.wallets.find((x: any) => x.currency === "USD")?.available ? w : false; });
  ok(iw?.wallets.find((x: any) => x.currency === "USD").available === 17000, "USD wallet credited $170 (85% of $200)");
  const lowUSD = await I.post("/api/withdrawals", { currency: "USD", amount: 99 });
  ok(lowUSD.status === 422 && /\$100/.test(lowUSD.data.error), "international minimum is $100", lowUSD.data);
  ok((await I.post("/api/withdrawals", { currency: "USD", amount: 170.01 })).status === 422, "cannot exceed available $170");
  ok((await I.post("/api/withdrawals", { currency: "USD", amount: 100, idempotencyKey: "same-key-12345" })).status === 200, "$100 withdrawal accepted");
  const idem = await I.post("/api/withdrawals", { currency: "USD", amount: 100, idempotencyKey: "same-key-12345" });
  ok(idem.status === 200 && (await I.get("/api/withdrawals")).data.withdrawals.length === 1, "retrying the same request (idempotency key) doesn't duplicate");

  // ============================================================ SECURITY
  section("Cross-publisher access");
  ok((await I.get(`/api/books/${bookId}`)).status === 404, "publisher B can't read publisher A's book by ID");
  ok((await I.req("PATCH", `/api/books/${bookId}`, await bookForm())).status === 404, "can't edit another publisher's book");
  ok((await I.del(`/api/books/${bookId}`)).status === 404, "can't delete another publisher's book");
  const draftA = (await A.req("POST", "/api/books", await bookForm({ title: "Private draft" }))).data.id;
  ok((await I.post(`/api/books/${draftA}/submit`)).status === 404, "can't submit another publisher's book");
  ok((await I.req("GET", `/api/covers/${draftA}`)).status === 404, "can't load another publisher's draft cover");
  ok((await I.get("/api/sales")).data.sales.every((x: any) => x.book.title === "Ocean Notes"), "sales are scoped to the publisher");
  ok((await I.get("/api/withdrawals")).data.withdrawals.every((x: any) => x.currency === "USD"), "payouts are scoped to the publisher");
  ok((await I.get(`/api/avatar/${me.id}`)).status === 404, "can't read another publisher's avatar");
  ok((await I.get("/api/wallet")).data.wallets.find((w: any) => w.currency === "NGN").available === 0, "wallet is scoped to the publisher");
  const tk = await A.post("/api/tickets", { subject: "Payout question", message: "When will my payout arrive?" });
  ok((await I.get(`/api/tickets/${tk.data.ticket.id}`)).status === 404 && (await I.post(`/api/tickets/${tk.data.ticket.id}/reply`, { message: "hi" })).status === 404, "can't read or reply to another publisher's ticket");
  ok((await I.get("/api/admin/withdrawals")).status === 403 && (await I.get("/api/admin/tickets")).status === 403, "admin endpoints forbidden to publishers");
  const xo = await fetch(`${BASE}/api/me`, { method: "PATCH", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: [...A.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify({ bio: "pwn" }) });
  ok(xo.status === 403, "cross-site write blocked");
  const hdr = (await fetch(`${BASE}/sign-in`)).headers;
  ok(hdr.get("x-frame-options") === "DENY", "security headers present");

  // ============================================================ SUPPORT
  section("Support");
  ok((await A.get("/api/tickets")).data.tickets[0].status === "WAITING_ADMIN", "new ticket → Waiting for Admin");
  ok((await A.get("/api/tickets/unread")).data.unread === 0, "support unread starts at 0");
  ok((await ADM.post(`/api/admin/tickets/${tk.data.ticket.id}`, { message: "Payouts are processed within 2 business days." })).status === 200, "admin replies");
  ok((await A.get("/api/tickets/unread")).data.unread === 1, "admin reply raises the support unread count");
  const conv = (await A.get(`/api/tickets/${tk.data.ticket.id}`)).data.ticket;
  ok((await A.get("/api/tickets/unread")).data.unread === 0, "opening the ticket clears the unread count");
  ok(conv.status === "WAITING_PUBLISHER" && conv.messages.length === 2 && conv.messages[1].from === "ADMIN" && /2 business days/.test(conv.messages[1].body), "admin reply appears in publisher conversation; status → Waiting for Publisher", conv);
  ok((await A.get("/api/notifications")).data.notifications.some((n: any) => n.type === "SUPPORT_REPLY"), "support-reply notification");
  ok((await A.post(`/api/tickets/${tk.data.ticket.id}/reply`, { message: "Thanks!" })).status === 200 && (await A.get(`/api/tickets/${tk.data.ticket.id}`)).data.ticket.status === "WAITING_ADMIN", "publisher reply → Waiting for Admin");
  ok((await ADM.post(`/api/admin/tickets/${tk.data.ticket.id}`, { status: "CLOSED" })).status === 200, "admin closes ticket");
  const cl = await A.post(`/api/tickets/${tk.data.ticket.id}/reply`, { message: "one more" });
  ok(cl.status === 409, "closed ticket rejects publisher messages", cl.data);
  ok((await ADM.post(`/api/admin/tickets/${tk.data.ticket.id}`, { message: "late reply" })).status === 409, "closed ticket rejects admin messages too");

  // ============================================================ NOTIFICATIONS
  section("Notifications");
  const ns = (await A.get("/api/notifications")).data;
  ok(ns.unread > 0 && ns.unread === ns.notifications.filter((n: any) => !n.readAt).length, "unread count is accurate", ns.unread);
  const first = ns.notifications.find((n: any) => !n.readAt);
  ok((await A.post("/api/notifications/read", { ids: [first.id] })).data.unread === ns.unread - 1, "opening a notification marks it read");
  ok((await I.post("/api/notifications/read", { ids: [first.id] })).status === 200 && (await A.get("/api/notifications")).data.notifications.find((n: any) => n.id === first.id).readAt, "other users can't alter my notifications");
  ok((await A.post("/api/notifications/read", { all: true })).data.unread === 0, "mark all read");

  // ============================================================ DELETE / MISC
  section("Delete & misc");
  ok((await A.del(`/api/books/${draftA}`)).status === 200 && (await A.get(`/api/books/${draftA}`)).status === 404, "draft deleted");
  ok((await A.del(`/api/books/${bookId}`)).status === 409, "published book can't be deleted");
  ok(((await A.get("/api/books")).data.books as any[]).every((b) => b.coverUrl === null || b.coverUrl.startsWith("/api/covers/")), "list payload sane");

  section("Support chat photos");
  const spng = await sharp({ create: { width: 500, height: 400, channels: 3, background: "#264653" } }).png().toBuffer();
  const sform = (fields: Record<string, string>, files: Array<{ name: string; type: string; data: Buffer }>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); for (const x of files) f.append("files", new Blob([new Uint8Array(x.data)], { type: x.type }), x.name); return f; };
  const st = await A.req("POST", "/api/tickets", sform({ subject: "Cover question", message: "Here is the cover I mean." }, [{ name: "cover.png", type: "image/png", data: spng }]));
  ok(st.status === 200, "publisher opens a ticket with a photo", st.data);
  const std = (await A.get(`/api/tickets/${st.data.ticket.id}`)).data.ticket;
  ok(std.messages[0].attachments.length === 1, "the message lists its photo");
  const sget = await A.get(std.messages[0].attachments[0].url);
  ok(sget.status === 200 && sget.res.headers.get("content-type") === "image/jpeg", "the photo is served back as JPEG");
  ok((await I.get(std.messages[0].attachments[0].url)).status === 404, "another publisher can't open it");
  ok((await new Client().get(std.messages[0].attachments[0].url)).status === 401, "photos need sign-in");
  ok((await A.req("POST", `/api/tickets/${st.data.ticket.id}/reply`, sform({ message: "" }, [{ name: "b.png", type: "image/png", data: spng }]))).status === 200, "a reply can be photo-only");
  ok((await A.req("POST", `/api/tickets/${st.data.ticket.id}/reply`, sform({ message: "x" }, [{ name: "evil.png", type: "image/png", data: Buffer.from("not an image at all") }]))).status === 415, "a fake image is refused (checked by its bytes)");
  ok((await A.req("POST", `/api/tickets/${st.data.ticket.id}/reply`, sform({ message: "x" }, Array.from({ length: 5 }, (_, i) => ({ name: `p${i}.png`, type: "image/png", data: spng })))) ).status === 400, "more than four photos is refused");

  const pn = (await A.get("/api/notifications")).data.notifications.length;
  const pi = (await I.get("/api/notifications")).data.notifications.length;
  ok((await new Client().req("DELETE", "/api/notifications")).status === 401, "clearing notifications requires login");
  const pc = await A.req("DELETE", "/api/notifications");
  const pAfter = (await A.get("/api/notifications")).data;
  ok(pn > 0 && pc.status === 200 && pAfter.notifications.length === 0 && pAfter.unread === 0, "Clear all removes every notification for the publisher", { pn, pAfter });
  ok((await I.get("/api/notifications")).data.notifications.length === pi, "other publishers' notifications untouched");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await db.$disconnect(); await rdb.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
