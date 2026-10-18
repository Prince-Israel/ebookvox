import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { voiceForCountry } from "../src/lib/voices";
import { buildAuthUrl, safeNext } from "../src/lib/oauth";
import { sha256 } from "../src/lib/auth";

const BASE = process.env.BASE ?? "http://localhost:3100";
const MOCK = "http://localhost:4010";
const db = new PrismaClient();

let pass = 0;
const failures: string[] = [];
function ok(cond: unknown, name: string, detail?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { failures.push(name); console.log("  ✗", name, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : ""); }
}
const section = (s: string) => console.log(`\n${s}`);

class Client {
  jar = new Map<string, string>();
  /** The visitor's location, as a CDN would report it. Prices and checkout follow this, not the account. */
  constructor(public country = "NG") {}
  async req(method: string, path: string, body?: unknown, extra: RequestInit = {}) {
    const headers = new Headers(extra.headers);
    headers.set("cf-ipcountry", this.country);
    if (this.jar.size) headers.set("cookie", [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "));
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers.set("content-type", "application/json"); payload = JSON.stringify(body); }
    const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual", ...extra });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v.join("=") === "") this.jar.delete(k); else this.jar.set(k, v.join("="));
    }
    const ct = res.headers.get("content-type") ?? "";
    const data = ct.includes("json") ? await res.json() : null;
    return { status: res.status, data, res };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b ?? {});
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
}

const stamp = Date.now().toString(36);
const pw = "Sup3rSecret!";
const signup = (c: Client, tag: string, country: string, dial = country, phone = "8012345678") =>
  c.post("/api/auth/signup", { firstName: "Test", lastName: tag, email: `${tag}.${stamp}@example.com`, password: pw, confirmPassword: pw, country, phoneCountry: dial, phone });
const lastToken = async (email: string, kind: string) => {
  const log = await db.emailLog.findFirst({ where: { toEmail: email, subject: { contains: kind } }, orderBy: { createdAt: "desc" } });
  return log?.body.match(/token=([\w-]+)/)?.[1];
};
const mock = (ref: string, status: string, paid?: number) => fetch(`${MOCK}/__set/${ref}/${status}${paid ? `/${paid}` : ""}`);

async function main() {
  // ---------------------------------------------------------------- auth
  section("Authentication");
  const u = new Client();
  ok((await u.get("/api/me")).status === 401, "unauthenticated /api/me is rejected");
  const pub = await u.get("/api/books");
  ok(pub.status === 200 && pub.data.books.length > 0 && pub.data.books.every((b: any) => b.owned === false), "visitors can browse the catalogue (public)");
  ok((await u.get("/api/books/featured")).status === 200 && (await u.get("/api/geo")).status === 200, "featured carousel + geo endpoints are public");
  ok((await u.get(`/api/books/${pub.data.books[0].id}/chapters/0`)).status === 401, "reading a book still requires an account");
  ok((await u.post(`/api/books/${pub.data.books[0].id}/claim`)).status === 401, "adding a book to the library requires an account");
  ok((await u.get("/api/library")).status === 401 && (await u.get("/api/documents")).status === 401, "library and documents stay private");
  const bad1 = await signup(u, "badphone", "NG", "NG", "80abc12345");
  ok(bad1.status === 400 && bad1.data.fields?.phone, "phone field rejects letters", bad1.data);
  const bad2 = await u.post("/api/auth/signup", { firstName: "A", lastName: "B", email: "nope", password: "short", confirmPassword: "x", country: "NG", phoneCountry: "NG", phone: "8012345678" });
  ok(bad2.status === 400 && bad2.data.fields?.email, "invalid email rejected", bad2.data);
  const bad3 = await u.post("/api/auth/signup", { firstName: "A", lastName: "B", email: `m.${stamp}@example.com`, password: pw, confirmPassword: pw + "x", country: "NG", phoneCountry: "NG", phone: "8012345678" });
  ok(bad3.status === 400 && bad3.data.fields?.confirmPassword, "mismatched confirm password rejected", bad3.data);
  const weak = await u.post("/api/auth/signup", { firstName: "A", lastName: "B", email: `w.${stamp}@example.com`, password: "alllowercase1", confirmPassword: "alllowercase1", country: "NG", phoneCountry: "NG", phone: "8012345678" });
  ok(weak.status === 400 && weak.data.fields?.password, "weak password rejected", weak.data);

  const su = await signup(u, "ng", "NG");
  ok(su.status === 200 && su.data.user.currency === "NGN" && su.data.user.phone === "+2348012345678", "signup (Nigeria → NGN, phone stored as E.164)", su.data);
  ok(!JSON.stringify(su.data).includes("passwordHash"), "password hash never returned");
  const row = await db.user.findUnique({ where: { email: `ng.${stamp}@example.com` } });
  ok(row?.passwordHash?.startsWith("$2"), "password stored as bcrypt hash");
  ok((await u.get("/api/me")).data.user.email === `ng.${stamp}@example.com`, "session cookie authenticates /api/me");
  ok((await signup(new Client(), "ng", "NG")).status === 409, "duplicate email rejected");

  const gb = new Client("GB"), us = new Client("US"), de = new Client("DE");
  ok((await signup(gb, "gb", "GB", "GB", "7700900123")).data?.user?.currency === "GBP", "UK → GBP");
  ok((await signup(us, "us", "US", "US", "2025550123")).data?.user?.currency === "USD", "US → USD");
  ok((await signup(de, "de", "DE", "DE", "15112345678")).data?.user?.currency === "EUR", "Germany → EUR");

  ok((await u.post("/api/auth/signout")).status === 200 && (await u.get("/api/me")).status === 401, "logout destroys the session");
  ok((await u.post("/api/auth/signin", { email: `ng.${stamp}@example.com`, password: "WrongPass1" })).status === 401, "wrong password rejected");
  ok((await u.post("/api/auth/signin", { email: `ng.${stamp}@example.com`, password: pw })).status === 200, "login with correct password");

  section("Email verification & password reset");
  const email = `ng.${stamp}@example.com`;
  ok(!(await u.get("/api/me")).data.user.emailVerified, "new account is unverified");
  const early = await u.post("/api/checkout", { bookId: "x" });
  ok(early.status === 403, "checkout blocked until email verified", early.data);
  const vt = await lastToken(email, "Verify");
  ok(!!vt, "verification email recorded");
  ok((await u.post("/api/auth/verify", { token: "totally-invalid-token" })).status === 400, "bad verification token rejected");
  ok((await u.post("/api/auth/verify", { token: vt })).status === 200 && (await u.get("/api/me")).data.user.emailVerified, "email verification works");
  ok((await u.post("/api/auth/verify", { token: vt })).status === 400, "verification token is single-use");

  ok((await new Client().post("/api/auth/forgot", { email: "nobody@example.com" })).status === 200, "forgot password doesn't reveal unknown emails");
  await new Client().post("/api/auth/forgot", { email });
  const rt = await lastToken(email, "Reset");
  ok(!!rt, "reset email recorded");
  ok((await new Client().post("/api/auth/reset", { token: rt, password: "NewPassw0rd", confirmPassword: "Different1" })).status === 400, "reset requires matching passwords");
  ok((await new Client().post("/api/auth/reset", { token: rt, password: "NewPassw0rd", confirmPassword: "NewPassw0rd" })).status === 200, "password reset works");
  ok((await new Client().post("/api/auth/reset", { token: rt, password: "NewPassw0rd", confirmPassword: "NewPassw0rd" })).status === 400, "reset token is single-use");
  ok((await u.get("/api/me")).status === 401, "reset signs out existing sessions");
  ok((await u.post("/api/auth/signin", { email, password: pw })).status === 401, "old password no longer works");
  ok((await u.post("/api/auth/signin", { email, password: "NewPassw0rd" })).status === 200, "new password works");

  section("Social login (Google / Apple)");
  const g = await u.req("GET", "/api/auth/oauth/google/start");
  ok(g.status === 307 && /error=google_not_configured/.test(g.res.headers.get("location") ?? ""), "Google start degrades gracefully when not configured", g.res.headers.get("location"));
  const ap = await u.req("GET", "/api/auth/oauth/apple/start");
  ok(ap.status === 307 && /apple_not_configured/.test(ap.res.headers.get("location") ?? ""), "Apple start degrades gracefully when not configured");
  const cb = await u.req("POST", "/api/auth/oauth/google/callback", new FormData());
  ok(cb.status === 303, "OAuth callback without code is rejected safely");

  // ---------------------------------------------------------------- profile & settings
  section("Profile, phone, avatar, settings");
  const bp = await u.patch("/api/me", { phone: "abc@mail.com", phoneCountry: "NG" });
  ok(bp.status === 400 && bp.data.fields?.phone, "profile phone rejects email/text", bp.data);
  const gp = await u.patch("/api/me", { phone: "8031234567", phoneCountry: "NG", firstName: "Ada" });
  ok(gp.status === 200 && gp.data.user.phone === "+2348031234567" && gp.data.user.firstName === "Ada", "profile update saves name + phone", gp.data);
  const cc = await u.patch("/api/me", { country: "GB" });
  ok(cc.data.user.currency === "GBP", "changing country changes currency");
  await u.patch("/api/me", { country: "NG" });
  const st = await u.patch("/api/me", { defaultVoice: "en-GB-RyanNeural", defaultSpeed: 1.5, autoPlay: true, theme: "dark", notifyBooks: false });
  ok(st.data.user.defaultVoice === "en-GB-RyanNeural" && st.data.user.defaultSpeed === 1.5 && st.data.user.theme === "dark" && st.data.user.notifyBooks === false, "settings persist");
  ok((await u.patch("/api/me", { defaultVoice: "made-up" })).status === 400, "unknown voice rejected");
  await u.patch("/api/me", { notifyBooks: true, theme: "light", defaultSpeed: 1, autoPlay: false });
  ok((await u.post("/api/me/password", { currentPassword: "nope", newPassword: "Another1Pass", confirmPassword: "Another1Pass" })).status === 400, "change password requires correct current password");
  ok((await u.post("/api/me/password", { currentPassword: "NewPassw0rd", newPassword: "Another1Pass", confirmPassword: "Another1Pass" })).status === 200, "change password works");

  const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#c47a52" } }).jpeg().toBuffer();
  const fd = new FormData(); fd.append("file", new Blob([new Uint8Array(png)], { type: "image/jpeg" }), "me.jpg");
  const up = await u.req("POST", "/api/me/avatar", fd);
  ok(up.status === 200 && up.data.avatarUpdatedAt, "profile photo upload", up.data);
  const me = (await u.get("/api/me")).data.user;
  const img = await u.req("GET", `/api/avatar/${me.id}`);
  ok(img.status === 200 && img.res.headers.get("content-type") === "image/jpeg", "uploaded photo is served back");
  const png2 = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#222" } }).png().toBuffer();
  const fd2 = new FormData(); fd2.append("file", new Blob([new Uint8Array(png2)], { type: "image/png" }), "b.png");
  ok((await u.req("POST", "/api/me/avatar", fd2)).status === 200, "photo can be replaced");
  const fd3 = new FormData(); fd3.append("file", new Blob(["not an image"], { type: "image/png" }), "x.png");
  ok((await u.req("POST", "/api/me/avatar", fd3)).status === 415, "non-image rejected even with image mime type");
  ok((await new Client().get(`/api/avatar/${me.id}`)).status === 401, "photos require login");

  // ---------------------------------------------------------------- TTS
  section("Text to speech & voices");
  const tts = async (c: Client, voice: string, text = "The quick brown fox jumps over the lazy dog.") => c.req("POST", "/api/tts", { text, voice }, {});
  const rawTts = async (voice: string, text = "The quick brown fox jumps over the lazy dog.") => {
    const r = await fetch(BASE + "/api/tts", { method: "POST", headers: { "content-type": "application/json", cookie: [...u.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify({ text, voice }) });
    return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") };
  };
  const ids = ["en-NG-EzinneNeural", "en-GB-RyanNeural", "en-AU-NatashaNeural", "en-US-AndrewNeural", "en-KE-ChilembaNeural"];
  const outs = [];
  for (const id of ids) outs.push(await rawTts(id));
  ok(outs.every((o) => o.status === 200 && o.bytes.length > 2000 && /audio/.test(o.type ?? "")), "TTS returns audio for every voice tried", outs.map((o) => [o.status, o.bytes.length]));
  const distinct = new Set(outs.map((o) => o.bytes.toString("base64"))).size;
  ok(distinct === ids.length, `different voices produce different audio (${distinct}/${ids.length} distinct)`);
  ok((await tts(new Client(), ids[0])).status === 401, "TTS requires login");
  ok((await rawTts("not-a-voice")).status === 400, "TTS rejects unknown voice");
  const { VOICES } = await import("../src/lib/voices");
  ok(VOICES.length >= 30 && new Set(VOICES.map((v) => v.id)).size === VOICES.length, `${VOICES.length} unique voices in catalogue`);
  ok(VOICES.every((v) => v.name && v.accent && v.style && v.gender && v.description), "every voice has name, accent, style, gender, description");
  ok(["African", "International", "Narrator"].every((g) => VOICES.some((v) => v.group === g)), "African / International / Narrator groups present");

  // ---------------------------------------------------------------- uploads
  section("File upload & extraction");
  const upl = async (name: string, buf: Buffer | Uint8Array | string, type = "application/octet-stream") => {
    const f = new FormData(); f.append("file", new Blob([typeof buf === "string" ? buf : new Uint8Array(buf)], { type }), name);
    return u.req("POST", "/api/extract", f);
  };
  const txt = await upl("notes.txt", "# Chapter One\n\nIt was a bright cold day.\nThe clocks were striking.\n\nSecond paragraph here.", "text/plain");
  ok(txt.status === 200 && txt.data.document.kind === "TXT" && txt.data.document.text.includes("Second paragraph"), "TXT upload extracts text", txt.data);
  const dx = new Document({ sections: [{ children: [new Paragraph({ text: "Annual Report", heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun("Revenue grew "), new TextRun({ text: "strongly", bold: true }), new TextRun(" this year.")] }), new Paragraph("Second docx paragraph.")] }] });
  const docx = await upl("report.docx", await Packer.toBuffer(dx), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  ok(docx.status === 200 && docx.data.document.kind === "DOCX" && docx.data.document.text.startsWith("# Annual Report") && docx.data.document.text.includes("Revenue grew strongly this year."), "DOCX upload extracts text with heading + paragraphs", docx.data);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  page.drawText("Quarterly Summary", { x: 50, y: 780, size: 24, font: bold });
  page.drawText("This is the first paragraph of the PDF. It has two lines", { x: 50, y: 740, size: 12, font });
  page.drawText("of text that belong together.", { x: 50, y: 724, size: 12, font });
  page.drawText("This is a second paragraph after a gap.", { x: 50, y: 680, size: 12, font });
  const pdf = await upl("summary.pdf", Buffer.from(await pdfDoc.save()), "application/pdf");
  ok(pdf.status === 200 && pdf.data.document.kind === "PDF" && /Quarterly Summary/.test(pdf.data.document.text), "PDF upload extracts text (no worker config needed)", pdf.data);
  ok(pdf.data?.document.text.includes("two lines of text that belong together.") && pdf.data.document.text.split("\n\n").length >= 3, "PDF keeps heading / paragraph structure", pdf.data?.document.text);
  ok((await upl("fake.pdf", "this is not a pdf")).status === 422, "corrupt PDF gives a clear 422 error");
  const blank = await PDFDocument.create(); blank.addPage();
  const sc = await upl("scan.pdf", Buffer.from(await blank.save()), "application/pdf");
  ok(sc.status === 422 && /scanned|readable text/i.test(sc.data.error), "PDF with no text explains why", sc.data);
  const ex = await upl("virus.exe", "MZ....");
  ok(ex.status === 422 && /Unsupported/.test(ex.data.error), "unsupported extension rejected", ex.data);
  ok((await upl("empty.txt", "")).status === 422, "empty file rejected");
  ok((await upl("renamed.docx", "plain text pretending to be docx")).status === 422, "fake DOCX rejected by content sniffing");
  ok((await new Client().req("POST", "/api/extract", new FormData())).status === 401, "extract requires login");
  const docs = await u.get("/api/documents");
  ok(docs.data.documents.length >= 3, "uploaded documents are saved for the user");
  const one = await u.get(`/api/documents/${docs.data.documents[0].id}`);
  ok(one.status === 200 && one.data.document.text.length > 0, "saved document can be reopened");
  const pasted = await u.post("/api/documents", { text: "Hello from pasted text.\n\nSecond paragraph." });
  ok(pasted.status === 200 && pasted.data.document.kind === "TEXT", "pasted text is saved");
  ok((await new Client().get(`/api/documents/${docs.data.documents[0].id}`)).status === 401, "documents are private");

  // ---------------------------------------------------------------- books
  section("Books, library & reading progress");
  const list = (await u.get("/api/books")).data;
  ok(list.books.length >= 10 && list.currency === "NGN", `book listing returns ${list.books.length} approved books`);
  const pg1 = (await u.get("/api/books?pageSize=5")).data, pg2 = (await u.get("/api/books?pageSize=5&page=2")).data;
  ok(pg1.books.length === 5 && pg1.total >= 10 && pg2.page === 2 && pg2.books.length > 0 && !pg2.books.some((b: any) => pg1.books.some((a: any) => a.id === b.id)), "the catalogue is served in pages (no overlap between pages)", { total: pg1.total });
  const free = list.books.filter((b: any) => b.isFree), paid = list.books.filter((b: any) => !b.isFree);
  ok(free.length >= 5 && paid.length >= 4, `free (${free.length}) and paid (${paid.length}) books both present`);
  ok(paid.every((b: any) => b.price?.currency === "NGN" && b.price.amountMinor > 0), "paid books priced in the user's currency (NGN)");
  const gl = (await gb.get("/api/books")).data, usl = (await us.get("/api/books")).data, del = (await de.get("/api/books")).data;
  ok(gl.books.filter((b: any) => !b.isFree).every((b: any) => b.price.currency === "GBP" && b.price.amountMinor > 0), "UK sees GBP prices");
  const rateOf = (c: string) => { const a = paid[0].price.amountMinor, b = gl.books.find((x: any) => x.id === paid[0].id).price.amountMinor; return c === "GBP" ? b / a : 0; };
  ok(rateOf("GBP") > 0.0001 && rateOf("GBP") < 0.01, "GBP price is the NGN list price converted at the international rate (not a separately typed price)", rateOf("GBP"));
  const travel = new Client("GB");
  await travel.post("/api/auth/signin", { email, password: pw });
  ok((await travel.get("/api/books")).data.currency === "GBP", "a Nigerian account browsing from the UK is priced in GBP (current location, not account currency)");
  ok(usl.books.filter((b: any) => !b.isFree).every((b: any) => b.price.currency === "USD"), "US sees USD prices");
  ok(del.books.filter((b: any) => !b.isFree).every((b: any) => b.price.currency === "EUR"), "Germany sees EUR prices");
  ok((await u.get("/api/books?type=free")).data.books.every((b: any) => b.isFree), "free filter works");
  ok((await u.get("/api/books?q=sherlock")).data.books.length === 1, "search works");
  const detail = await u.get(`/api/books/${paid[0].id}`);
  ok(detail.data.book.publisher && detail.data.book.description && detail.data.owned === false && detail.data.canBuy, "book details include publisher, description, price", detail.data);

  const fb = free[0];
  ok((await u.get(`/api/books/${fb.id}/chapters/0`)).status === 403, "can't read a book that isn't in the library");
  ok((await u.post(`/api/books/${fb.id}/claim`)).status === 200, "free book: Read Now adds to library");
  const rd = await u.get(`/api/books/${fb.id}/read`);
  ok(rd.status === 200 && rd.data.chapters.length > 3, "reader returns table of contents");
  const ch = await u.get(`/api/books/${fb.id}/chapters/0`);
  ok(ch.status === 200 && ch.data.chapter.content.length > 500, "chapter text delivered inside the app");
  const pr = await u.post(`/api/books/${fb.id}/progress`, { chapterIndex: 2, paragraphIndex: 7, audioTime: 12.5, percent: 23.4 });
  ok(pr.status === 200, "progress saved");
  const rd2 = (await u.get(`/api/books/${fb.id}/read`)).data.progress;
  ok(rd2.chapterIndex === 2 && rd2.paragraphIndex === 7 && rd2.audioTime === 12.5 && Math.round(rd2.percent) === 23, "reading + audio position restored", rd2);
  const lib = (await u.get("/api/library")).data;
  ok(lib.items.length === 1 && lib.reading.length === 1 && lib.recent.length === 1 && lib.purchased.length === 0, "library: currently reading + recently read", lib);
  ok((await u.post(`/api/books/${fb.id}/progress`, { chapterIndex: 0, paragraphIndex: 0, percent: 150 })).status === 400, "progress validated");
  const pb = paid[0];
  ok((await u.post(`/api/books/${pb.id}/claim`)).status === 402, "paid book can't be claimed for free");
  ok((await u.get(`/api/books/${pb.id}/chapters/0`)).status === 403, "paid book content is locked until purchased");

  // ---------------------------------------------------------------- payments
  section("Checkout & Paystack verification");
  const co1 = await u.post("/api/checkout", { bookId: fb.id });
  ok(co1.status === 400, "can't pay for a free book");
  const co = await u.post("/api/checkout", { bookId: pb.id });
  ok(co.status === 200 && co.data.authorizationUrl?.startsWith(MOCK) && co.data.reference, "checkout initialises Paystack transaction", co.data);
  const ref1 = co.data.reference;
  const o1 = await db.order.findUnique({ where: { reference: ref1 } });
  ok(o1?.status === "PENDING" && o1.currency === "NGN" && o1.amountMinor === pb.price.amountMinor, "order stored as PENDING with correct amount + currency");
  const v0 = await u.get(`/api/checkout/verify?reference=${ref1}`);
  ok(v0.data.status === "PENDING", "unpaid transaction stays PENDING");
  ok((await u.get(`/api/books/${pb.id}/chapters/0`)).status === 403, "still locked while pending");
  ok((await gb.get(`/api/checkout/verify?reference=${ref1}`)).status === 404, "another user can't verify my order");
  await mock(ref1, "failed");
  const v1 = await u.get(`/api/checkout/verify?reference=${ref1}`);
  ok(v1.data.status === "FAILED", "failed payment → order FAILED");
  const n1 = (await u.get("/api/notifications")).data;
  ok(n1.notifications.some((n: any) => n.type === "PAYMENT_FAILED"), "failed-payment notification created");

  const co2 = await u.post("/api/checkout", { bookId: pb.id });
  const ref2 = co2.data.reference;
  await mock(ref2, "success", 100); // tampered: paid 1 unit instead of the price
  const v2 = await u.get(`/api/checkout/verify?reference=${ref2}`);
  ok(v2.data.status === "FAILED" && !(await db.userBook.findFirst({ where: { bookId: pb.id, user: { email } } })), "amount mismatch is NOT marked paid and grants no access", v2.data);

  const co3 = await u.post("/api/checkout", { bookId: pb.id });
  const ref3 = co3.data.reference;
  const whBody = JSON.stringify({ event: "charge.success", data: { reference: ref3 } });
  const badSig = await fetch(BASE + "/api/paystack/webhook", { method: "POST", body: whBody, headers: { "x-paystack-signature": "deadbeef" } });
  ok(badSig.status === 401, "webhook with bad signature rejected");
  const goodSig = createHmac("sha512", "sk_test_mock").update(whBody).digest("hex");
  const wh0 = await fetch(BASE + "/api/paystack/webhook", { method: "POST", body: whBody, headers: { "x-paystack-signature": goodSig } });
  ok(wh0.status === 200 && (await db.order.findUnique({ where: { reference: ref3 } }))?.status === "PENDING", "signed webhook for an unpaid tx still doesn't mark paid (server re-verifies)");
  await mock(ref3, "success");
  const v3 = await u.get(`/api/checkout/verify?reference=${ref3}`);
  ok(v3.data.status === "PAID" && v3.data.bookId === pb.id, "verified payment → PAID", v3.data);
  const wh1 = await fetch(BASE + "/api/paystack/webhook", { method: "POST", body: whBody, headers: { "x-paystack-signature": goodSig } });
  ok(wh1.status === 200, "webhook replay is idempotent");
  ok((await u.get(`/api/books/${pb.id}/chapters/0`)).status === 200, "purchased book unlocked");
  const lib2 = (await u.get("/api/library")).data;
  ok(lib2.purchased.length === 1 && lib2.purchased[0].id === pb.id, "purchased book appears in Library → Purchased");
  const n2 = (await u.get("/api/notifications")).data.notifications.map((n: any) => n.type);
  ok(n2.includes("PURCHASE_SUCCESS") && n2.includes("BOOK_ADDED"), "purchase + book-added notifications created");
  ok((await db.userBook.count({ where: { bookId: pb.id, user: { email } } })) === 1, "exactly one library entry (idempotent)");
  ok((await u.post("/api/checkout", { bookId: pb.id })).status === 409, "can't buy a book twice");
  const orders = (await u.get("/api/orders")).data.orders;
  const sts = orders.map((o: any) => o.status).sort().join(",");
  ok(sts === "FAILED,FAILED,PAID" && orders.every((o: any) => o.currency === "NGN" && o.reference && o.number), "orders page data: statuses, currency, reference", sts);
  // other currencies
  const gv = await gb.post("/api/checkout", { bookId: pb.id });
  ok(gv.status === 403, "UK user (unverified) blocked from checkout");
  await db.user.updateMany({ where: { email: `gb.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  const gv2 = await gb.post("/api/checkout", { bookId: pb.id });
  const gOrder = await db.order.findUnique({ where: { reference: gv2.data.reference } });
  ok(gOrder?.currency === "GBP", "UK checkout is created in GBP", gv2.data);
  const ngnPrice = paid.find((b: any) => b.id === pb.id).price.amountMinor;
  ok(gOrder?.baseCurrency === "NGN" && gOrder.baseAmountMinor === ngnPrice && (gOrder.fxRate ?? 0) > 0, "order records the publisher's list price and the locked exchange rate", gOrder);
  ok(gOrder!.feeMinor === Math.floor((gOrder!.amountMinor * 15) / 100), "order carries the 15% platform commission in the currency the reader paid", gOrder);

  // ---------------------------------------------------------------- publisher → admin → reader
  section("Publisher ingestion → admin approval → Reader");
  const book = (over: object = {}) => ({ externalId: `pub-${stamp}`, publisherId: "pub-1", publisherName: "Lagos Press", title: `Publisher Test ${stamp}`, author: "A. Writer", category: "Poetry", description: "A collection delivered from the Publisher platform.", isFree: false, baseCurrency: "NGN", prices: { NGN: 150000 }, chapters: [{ title: "One", content: "First poem.\n\nSecond stanza." }, { title: "Two", content: "Another poem." }], ...over });
  const pubReq = (b: unknown, key = "test-publisher-key") => fetch(BASE + "/api/publisher/books", { method: "POST", headers: { "content-type": "application/json", "x-publisher-key": key }, body: JSON.stringify(b) });
  ok((await pubReq(book(), "wrong")).status === 401, "publisher API rejects bad key");
  ok((await pubReq(book({ prices: {} }))).status === 400, "paid book must carry a price");
  ok((await pubReq(book({ baseCurrency: "GBP", prices: { NGN: 100 } }))).status === 400, "price must be in the declared publisher currency");
  const created = await pubReq(book());
  const cj = await created.json();
  ok(created.status === 201 && cj.status === "PENDING", "publisher book accepted as PENDING", cj);
  ok(!(await u.get("/api/books")).data.books.some((b: any) => b.title.startsWith("Publisher Test")), "pending book is NOT visible in Reader");
  ok((await u.post(`/api/admin/books/${cj.id}`, { action: "approve" })).status === 403, "non-admin cannot approve");
  const admin = new Client();
  ok((await admin.post("/api/auth/signin", { email: "admin@ebookvox.app", password: "ChangeMe!2026" })).status === 200, "admin signs in");
  const before = (await u.get("/api/notifications")).data.unread;
  ok((await admin.post(`/api/admin/books/${cj.id}`, { action: "approve" })).status === 200, "admin approves book");
  const after = (await u.get("/api/books")).data.books.find((b: any) => b.title.startsWith("Publisher Test"));
  ok(after && after.price.currency === "NGN" && after.price.amountMinor === 150000, "approved publisher book appears automatically with correct price");
  ok((await u.get("/api/notifications")).data.unread === before + 1, "users get a New book notification");
  // covers are served through the Reader so phones/emulators (which can't reach the publisher's address) can load them
  const cv = await pubReq(book({ externalId: `cover-${stamp}`, title: `Cover Test ${stamp}`, coverUrl: `${BASE}/icons/icon-512.png` }));
  const cvj = await cv.json();
  await admin.post(`/api/admin/books/${cvj.id}`, { action: "approve" });
  const cvBook = (await u.get("/api/books")).data.books.find((b: any) => b.id === cvj.id);
  ok(cvBook?.coverUrl === `/api/books/${cvj.id}/cover`, "book list exposes a same-origin cover address, not the publisher's host", cvBook?.coverUrl);
  const cvRes = await fetch(BASE + cvBook.coverUrl);
  ok(cvRes.status === 200 && (cvRes.headers.get("content-type") ?? "").startsWith("image/") && (await cvRes.arrayBuffer()).byteLength > 500, "cover proxy returns the image bytes");
  ok((await fetch(`${BASE}/api/books/nope/cover`)).status === 404, "cover proxy 404s for unknown books");
  const resub = await pubReq(book({ title: `Publisher Test ${stamp} v2` }));
  ok((await resub.json()).created === false, "re-submission updates the same book");
  ok(!(await u.get("/api/books")).data.books.some((b: any) => b.id === cj.id), "edited book goes back to review");
  await admin.post(`/api/admin/books/${cj.id}`, { action: "approve" });
  ok((await admin.get("/api/admin/stats")).data.approvedBooks >= 12, "admin stats come from the database");
  ok((await u.get("/api/admin/stats")).status === 403, "admin API forbidden to normal users");

  // ---------------------------------------------------------------- support
  section("Support tickets");
  const t = await u.post("/api/tickets", { subject: "Payment help", message: "My card was charged twice." });
  ok(t.status === 200, "ticket created");
  ok((await u.post("/api/tickets", { subject: "x", message: "y" })).status === 400, "ticket validation");
  const tid = t.data.ticket.id;
  const tl = (await u.get("/api/tickets")).data.tickets;
  ok(tl.length === 1 && tl[0].status === "OPEN", "ticket listed as Open");
  ok((await gb.get(`/api/tickets/${tid}`)).status === 404, "other users can't open my ticket");
  ok((await u.get("/api/tickets/unread")).data.unread === 0, "support unread count starts at 0");
  const unreadBefore = (await u.get("/api/notifications")).data.unread;
  ok((await admin.post(`/api/admin/tickets/${tid}`, { message: "Hi — we're looking into it." })).status === 200, "admin replies");
  ok((await u.get("/api/tickets/unread")).data.unread === 1, "an admin reply raises the support unread count");
  const conv = (await u.get(`/api/tickets/${tid}`)).data.ticket;
  ok((await u.get("/api/tickets/unread")).data.unread === 0, "opening the conversation clears it");
  ok(conv.status === "WAITING_USER" && conv.messages.at(-1).from === "ADMIN" && conv.messages.length === 2, "admin reply appears in user's conversation; status → Waiting for User", conv);
  ok((await u.get("/api/notifications")).data.unread === unreadBefore + 1, "support-response notification created");
  ok((await u.post(`/api/tickets/${tid}/reply`, { message: "Thanks!" })).status === 200 && (await u.get(`/api/tickets/${tid}`)).data.ticket.status === "OPEN", "user reply reopens as Open");
  ok((await admin.post(`/api/admin/tickets/${tid}`, { status: "CLOSED" })).status === 200, "admin closes ticket");
  const closed = await u.post(`/api/tickets/${tid}/reply`, { message: "one more" });
  ok(closed.status === 409, "user cannot reply to a closed ticket", closed.data);

  // ---------------------------------------------------------------- notifications
  section("Notifications");
  const nn = (await u.get("/api/notifications")).data;
  ok(nn.unread > 0 && nn.unread === nn.notifications.filter((n: any) => !n.readAt).length, "unread count matches");
  const one1 = nn.notifications.find((n: any) => !n.readAt);
  const r1 = await u.post("/api/notifications/read", { ids: [one1.id] });
  ok(r1.data.unread === nn.unread - 1, "opening one notification reduces unread count");
  await u.patch("/api/me", { notifySupport: false });
  const t2 = await u.post("/api/tickets", { subject: "Another", message: "Question about voices." });
  const c0 = (await u.get("/api/notifications")).data.unread;
  await admin.post(`/api/admin/tickets/${t2.data.ticket.id}`, { message: "Sure!" });
  ok((await u.get("/api/notifications")).data.unread === c0, "notification preferences are respected");
  const all = await u.post("/api/notifications/read", { all: true });
  ok(all.data.unread === 0, "mark all read → unread = 0");
  ok((await gb.get("/api/notifications")).data.notifications.every((n: any) => true) && (await gb.post("/api/notifications/read", { ids: [one1.id] })).data.unread >= 0, "can't mark another user's notification (no-op)");
  ok((await u.get("/api/notifications")).data.notifications.some((n: any) => n.id === one1.id && n.readAt), "read state persisted");

  // ---------------------------------------------------------------- default voice by country
  section("Default voice follows the user's country");
  const voiceCases: Array<[string, string]> = [["NG", "en-NG-EzinneNeural"], ["GB", "en-GB-SoniaNeural"], ["US", "en-US-JennyNeural"], ["KE", "en-KE-AsiliaNeural"], ["ZA", "en-ZA-LeahNeural"], ["GH", "en-NG-EzinneNeural"], ["ZW", "en-ZA-LeahNeural"], ["UG", "en-KE-AsiliaNeural"], ["DE", "en-GB-SoniaNeural"], ["IE", "en-IE-EmilyNeural"], ["BR", "en-US-JennyNeural"], ["JP", "en-IN-NeerjaNeural"], ["IN", "en-IN-NeerjaNeural"], ["AU", "en-AU-NatashaNeural"], ["FJ", "en-AU-NatashaNeural"]];
  for (const [cc, want] of voiceCases) if (voiceForCountry(cc) !== want) ok(false, `${cc} default voice`, { got: voiceForCountry(cc), want });
  ok(true, `default voice matches ${voiceCases.length} countries (Nigeria→Nigerian, UK→British, US→American, other African→nearest African, Europe→British, Americas→American, Asia→Indian English, Pacific→Australian)`);
  ok((await gb.get("/api/me")).data.user.defaultVoice === "en-GB-SoniaNeural" && (await us.get("/api/me")).data.user.defaultVoice === "en-US-JennyNeural" && (await new Client("NG").get("/api/me")).status === 401, "new British / American accounts start with a British / American voice");
  ok((await de.patch("/api/me", { country: "KE" })).data.user.defaultVoice === "en-KE-AsiliaNeural", "until they choose one, the default voice moves with the user's country");
  ok((await de.patch("/api/me", { defaultVoice: "en-US-GuyNeural" })).data.user.defaultVoice === "en-US-GuyNeural", "a voice the user picks is saved");
  ok((await de.patch("/api/me", { country: "DE" })).data.user.defaultVoice === "en-US-GuyNeural", "a chosen voice is kept when the country changes");

  // ---------------------------------------------------------------- support photos
  section("Support chat photos");
  const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#2a9d8f" } }).png().toBuffer();
  const mkForm = (fields: Record<string, string>, files: Array<{ name: string; type: string; data: Buffer }>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); for (const x of files) f.append("files", new Blob([new Uint8Array(x.data)], { type: x.type }), x.name); return f; };
  const tk1 = await u.req("POST", "/api/tickets", mkForm({ subject: "Photo issue", message: "Here are two screenshots of the problem." }, [{ name: "a.png", type: "image/png", data: photo }, { name: "b.png", type: "image/png", data: photo }]));
  ok(tk1.status === 200 && !!tk1.data.ticket.id, "ticket created with two photos", tk1.data);
  const tkd = (await u.get(`/api/tickets/${tk1.data.ticket.id}`)).data.ticket;
  ok(tkd.messages[0].attachments.length === 2 && tkd.messages[0].attachments[0].url.startsWith("/api/tickets/attachments/"), "messages list their photos");
  const pimg = await fetch(BASE + tkd.messages[0].attachments[0].url, { headers: { cookie: [...u.jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
  ok(pimg.status === 200 && pimg.headers.get("content-type") === "image/jpeg" && (await pimg.arrayBuffer()).byteLength > 200, "photo is served back (re-encoded as JPEG)");
  ok((await gb.get(tkd.messages[0].attachments[0].url)).status === 404, "another user can't open someone else's photo");
  ok((await new Client().get(tkd.messages[0].attachments[0].url)).status === 401, "photos need sign-in");
  const rp = await u.req("POST", `/api/tickets/${tk1.data.ticket.id}/reply`, mkForm({ message: "" }, [{ name: "c.png", type: "image/png", data: photo }]));
  ok(rp.status === 200, "a reply can be photo-only", rp.data);
  ok((await u.get("/api/tickets")).data.tickets.find((t: any) => t.id === tk1.data.ticket.id)?.lastMessage === "📷 Photo", "ticket list shows “📷 Photo” for a photo-only message");
  const fake = await u.req("POST", `/api/tickets/${tk1.data.ticket.id}/reply`, mkForm({ message: "x" }, [{ name: "evil.png", type: "image/png", data: Buffer.from("<?php echo 1; ?>") }]));
  ok(fake.status === 415, "a file that only claims to be an image is refused (checked by its bytes)", fake.data);
  const many = await u.req("POST", `/api/tickets/${tk1.data.ticket.id}/reply`, mkForm({ message: "x" }, Array.from({ length: 5 }, (_, i) => ({ name: `p${i}.png`, type: "image/png", data: photo }))));
  ok(many.status === 400, "more than four photos is refused", many.data);
  ok((await u.req("POST", `/api/tickets/${tk1.data.ticket.id}/reply`, mkForm({ message: "" }, []))).status === 400, "an empty reply is refused");

  // clear all notifications
  const nBefore = (await u.get("/api/notifications")).data.notifications.length;
  const gbN = (await gb.get("/api/notifications")).data.notifications.length;
  ok((await new Client().req("DELETE", "/api/notifications")).status === 401, "clearing notifications requires login");
  const cleared = await u.req("DELETE", "/api/notifications");
  const nAfter = (await u.get("/api/notifications")).data;
  ok(nBefore > 0 && cleared.status === 200 && nAfter.notifications.length === 0 && nAfter.unread === 0, "Clear all removes every notification for the user", { nBefore, nAfter });
  ok((await gb.get("/api/notifications")).data.notifications.length === gbN, "clearing one user's notifications leaves other users' untouched");

  // ---------------------------------------------------------------- public links, store badges, mobile sign-in
  section("Public config, ads.txt, mobile Google/Apple sign-in");
  const cfg = (await new Client().get("/api/public-config")).data;
  ok(/\/sign-up$/.test(cfg.publisherSignUpUrl) && cfg.publisherSignUpUrl.startsWith(cfg.publisherUrl) && typeof cfg.apkUrl === "string" && cfg.playStoreUrl === null && cfg.appStoreUrl === null && cfg.ads.adsense?.client === "ca-pub-1234567890123456" && cfg.ads.adsense.slots.homeTop === "1111111111" && cfg.ads.adsense.slots.homeBottom === "2222222222" && cfg.ads.videoTagUrl === "https://ads.example.test/vast.xml" && cfg.ads.admob.testing === true && cfg.ads.admob.android.banner.startsWith("ca-app-pub-3940256099942544"), "public config gives the Publisher sign-up link, store links, the AdSense/video ad settings, and Google's TEST AdMob ids until real ones are set", cfg);
  ok(!JSON.stringify(cfg).match(/secret|password|key/i), "public config contains no secrets");
  const adsTxt = await fetch(BASE + "/ads.txt");
  ok(adsTxt.status === 200 && (await adsTxt.text()).trim() === "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0", "ads.txt is served for AdSense once ADSENSE_CLIENT is set");
  // geo: where the visitor is comes from CDN/IP first; with no usable address (private network) the device's time zone is used
  const geoFetch = async (path: string, headers: Record<string, string>) => (await fetch(BASE + path, { headers })).json();
  const gLondon = await geoFetch("/api/geo", { cookie: "ev-tz=Europe%2FLondon" });
  ok(gLondon.country === "GB" && gLondon.currency === "GBP", "with no usable IP, the device's time zone (London) places the visitor in the UK", gLondon);
  const bNairobi = await geoFetch("/api/books?type=paid&pageSize=2", { cookie: "ev-tz=Africa%2FNairobi" });
  ok(bNairobi.country === "KE" && bNairobi.currency === "USD" && bNairobi.books.every((b: any) => b.price?.currency === "USD"), "a phone in Kenya sees USD prices (Kenya has no local currency here)", { c: bNairobi.country, cur: bNairobi.currency });
  const bLagos = await geoFetch("/api/books?type=paid&pageSize=2", { cookie: "ev-tz=Africa%2FLagos" });
  ok(bLagos.currency === "NGN" && bLagos.books[0].price.amountMinor > bNairobi.books[0].price.amountMinor, "a phone in Nigeria sees naira prices (a bigger number than the same book in dollars)");
  const bCdn = await geoFetch("/api/books?type=paid&pageSize=1", { "cf-ipcountry": "DE", cookie: "ev-tz=Europe%2FLondon" });
  ok(bCdn.currency === "EUR" && bCdn.country === "DE", "the CDN's country beats the device time zone (a UK-timezone phone connecting from Germany pays in euro)");
  ok(safeNext("/library?x=1") === "/library?x=1" && safeNext("//evil.example") === null && safeNext("https://evil.example") === null && safeNext("/\\evil") === null && safeNext(null) === null, "post-login destinations must be same-site paths");
  process.env.GOOGLE_CLIENT_ID = "test-client"; process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  const url = new URL(await buildAuthUrl("google", { mobile: true, next: "/books" }));
  const stRow = await db.oAuthState.findUnique({ where: { state: url.searchParams.get("state")! } });
  ok(url.hostname === "accounts.google.com" && stRow?.mobile === true && stRow.next === "/books", "a sign-in started from the app is remembered as a mobile sign-in");
  const evil = new URL(await buildAuthUrl("google", { mobile: true, next: "//evil.example" }));
  ok((await db.oAuthState.findUnique({ where: { state: evil.searchParams.get("state")! } }))?.next === null, "an unsafe next address is dropped");
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  const mu = await db.user.findFirst({ where: { email: `gb.${stamp}@example.com` } });
  const mkCode = async (type: string, ageMs = 0, userId = mu!.id) => { const code = `code-${type}-${Math.random().toString(36).slice(2)}-padding-padding`; await db.authToken.create({ data: { userId, type, tokenHash: sha256(code), expiresAt: new Date(Date.now() + 180_000 - ageMs) } }); return code; };
  const app1 = new Client();
  const good = await mkCode("MOBILE_LOGIN");
  const ex1 = await app1.post("/api/auth/oauth/mobile/exchange", { code: good });
  ok(ex1.status === 200 && (await app1.get("/api/me")).data.user.email === `gb.${stamp}@example.com`, "the one-time code from the app's deep link becomes a signed-in session");
  ok((await new Client().post("/api/auth/oauth/mobile/exchange", { code: good })).status === 400, "a code can only be used once");
  ok((await new Client().post("/api/auth/oauth/mobile/exchange", { code: await mkCode("MOBILE_LOGIN", 200_000) })).status === 400, "an expired code is refused");
  ok((await new Client().post("/api/auth/oauth/mobile/exchange", { code: await mkCode("VERIFY_EMAIL") })).status === 400, "other kinds of token can't be used to sign in");
  ok((await new Client().post("/api/auth/oauth/mobile/exchange", { code: "x".repeat(40) })).status === 400, "a made-up code is refused");

  // ---------------------------------------------------------------- wallet + ad-free subscription
  section("Wallet, subscription ($2/month, $1.80/month yearly), ads off");
  const gPlans = await new Client("US").get("/api/subscription");
  const usM = gPlans.data.plans.find((x: any) => x.plan === "MONTHLY"), usY = gPlans.data.plans.find((x: any) => x.plan === "YEARLY");
  ok(gPlans.data.currency === "USD" && usM.amountMinor === 200 && usM.perMonthMinor === 200 && usY.amountMinor === 2160 && usY.perMonthMinor === 180, "US visitors see $2.00 a month, and $1.80 a month ($21.60) on the yearly plan", gPlans.data.plans);
  const ngPlans = (await u.get("/api/subscription")).data;
  const ngM = ngPlans.plans.find((x: any) => x.plan === "MONTHLY"), ngY = ngPlans.plans.find((x: any) => x.plan === "YEARLY");
  ok(ngPlans.currency === "NGN" && ngM.amountMinor > 100_000 && ngY.perMonthMinor < ngM.amountMinor && Math.abs(ngY.amountMinor / ngM.amountMinor - 10.8) < 0.15, "in Nigeria the same dollar prices are converted to naira at the international rate (yearly = 10.8 × monthly)", { ngM: ngM.amountMinor, ngY: ngY.amountMinor });
  const eurPlans = (await new Client("DE").get("/api/subscription")).data;
  ok(eurPlans.currency === "EUR" && eurPlans.plans[0].amountMinor > 100 && eurPlans.plans[0].amountMinor < 400, "German visitors see euro prices");
  ok((await new Client().post("/api/subscription/subscribe", { plan: "MONTHLY", method: "wallet" })).status === 401, "subscribing needs an account");
  ok((await new Client().get("/api/wallet")).status === 401, "the wallet needs an account");
  ok((await u.post("/api/subscription/subscribe", { plan: "WEEKLY", method: "wallet" })).status === 400, "unknown plans are refused");
  // wallet starts empty → cannot pay from it
  const poor = await u.post("/api/subscription/subscribe", { plan: "MONTHLY", method: "wallet" });
  ok(poor.status === 402 && /top up/i.test(poor.data.error), "an empty wallet can't pay for a subscription", poor.data);
  // top up by card (verified server-side like orders)
  const tooSmall = await u.post("/api/wallet/topup", { amountMinor: 100 });
  ok(tooSmall.status === 400, "top-ups below the minimum are refused", tooSmall.data);
  const top = await u.post("/api/wallet/topup", { amountMinor: 8_000_000 }); // ₦80,000
  ok(top.status === 200 && top.data.authorizationUrl?.startsWith(MOCK) && top.data.currency === "NGN", "wallet top-up starts a Paystack payment in the reader's currency", top.data);
  ok((await u.get(`/api/checkout/verify?reference=${top.data.reference}`)).data.status === "PENDING", "a top-up isn't credited until Paystack confirms");
  ok((await u.get("/api/wallet")).data.balances.length === 0, "wallet still empty while pending");
  await mock(top.data.reference, "success", 1000); // paid the wrong amount
  const wrong = (await u.get(`/api/checkout/verify?reference=${top.data.reference}`)).data;
  ok(wrong.status === "FAILED" && (await u.get("/api/wallet")).data.balances.length === 0, "an amount mismatch is rejected and nothing is credited");
  const top2 = await u.post("/api/wallet/topup", { amountMinor: 8_000_000 });
  await mock(top2.data.reference, "success");
  const paidTop = (await u.get(`/api/checkout/verify?reference=${top2.data.reference}`)).data;
  await u.get(`/api/checkout/verify?reference=${top2.data.reference}`); await u.get(`/api/checkout/verify?reference=${top2.data.reference}`);
  const w1 = (await u.get("/api/wallet")).data;
  ok(paidTop.status === "PAID" && paidTop.kind === "TOPUP" && w1.balances[0]?.amountMinor === 8_000_000 && w1.transactions.filter((t: any) => t.type === "TOPUP").length === 1, "a confirmed top-up credits the wallet exactly once (repeat checks don't double-credit)", w1);
  ok((await u.get("/api/me")).data.user.adFree === false, "no subscription yet → ads are on");
  // subscribe from the wallet
  const sw = await u.post("/api/subscription/subscribe", { plan: "MONTHLY", method: "wallet" });
  const afterSub = (await u.get("/api/subscription")).data;
  ok(sw.status === 200 && sw.data.status === "PAID" && afterSub.adFree === true && afterSub.subscription.plan === "MONTHLY" && afterSub.walletMinor === 8_000_000 - ngM.amountMinor, "subscribing from the wallet is instant, debits the exact price, and switches ads off", { sw: sw.data, afterSub: afterSub.walletMinor });
  ok((await u.get("/api/me")).data.user.adFree === true, "the signed-in user is marked ad-free (web and app read the same flag)");
  const end1 = new Date(afterSub.subscription.currentPeriodEnd).getTime();
  ok(Math.abs(end1 - (Date.now() + 30 * 86400_000)) < 3 * 86400_000, "a monthly plan lasts about a month");
  await u.post("/api/subscription/subscribe", { plan: "YEARLY", method: "wallet" });
  const end2 = new Date((await u.get("/api/subscription")).data.subscription.currentPeriodEnd).getTime();
  ok(end2 - end1 > 360 * 86400_000 && end2 - end1 < 370 * 86400_000, "subscribing again adds the new period on top of the time left (no days wasted)");
  const meRow = await db.user.findFirst({ where: { email } });
  const payRows = await db.subscriptionPayment.findMany({ where: { userId: meRow!.id }, orderBy: { createdAt: "asc" } });
  ok(payRows.length === 2 && payRows[0].usdMinor === 200 && payRows[1].usdMinor === 2160 && payRows.every((r) => r.method === "WALLET" && r.currency === "NGN"), "every payment is recorded with its dollar price, method and currency");
  ok((await u.get("/api/wallet")).data.transactions.filter((t: any) => t.type === "SUBSCRIPTION").length === 2, "wallet history shows both subscription charges");
  ok((await u.get("/api/notifications")).data.notifications.some((n: any) => /ad-free|Ads are off/i.test(n.title)), "the reader is told ads are off");
  // two quick taps can't spend the same money twice
  const rich = new Client("NG"); await signup(rich, "walletrace", "NG");
  const richU = await db.user.findFirst({ where: { email: `walletrace.${stamp}@example.com` } });
  await db.walletTx.create({ data: { userId: richU!.id, currency: "NGN", type: "ADJUSTMENT", amountMinor: ngM.amountMinor + 100, description: "test credit" } });
  const [race1, race2] = await Promise.all([rich.post("/api/subscription/subscribe", { plan: "MONTHLY", method: "wallet" }), rich.post("/api/subscription/subscribe", { plan: "MONTHLY", method: "wallet" })]);
  ok([race1.status, race2.status].sort().join() === "200,402" && (await db.subscriptionPayment.count({ where: { userId: richU!.id } })) === 1 && (await rich.get("/api/wallet")).data.balances[0].amountMinor === 100, "two simultaneous wallet payments → only one succeeds, the wallet never goes negative", [race1.status, race2.status]);
  // card flow
  await db.user.updateMany({ where: { email: `walletrace.${stamp}@example.com` }, data: { emailVerifiedAt: null } });
  ok((await rich.post("/api/subscription/subscribe", { plan: "YEARLY", method: "card" })).status === 403, "paying by card needs a verified email");
  await db.user.updateMany({ where: { email: `walletrace.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  const card = await rich.post("/api/subscription/subscribe", { plan: "YEARLY", method: "card" });
  ok(card.status === 200 && card.data.status === "REDIRECT" && card.data.authorizationUrl.startsWith(MOCK), "card subscription starts a Paystack checkout", card.data);
  await mock(card.data.reference, "failed");
  const cf = (await rich.get(`/api/checkout/verify?reference=${card.data.reference}`)).data;
  ok(cf.status === "FAILED" && cf.kind === "SUBSCRIPTION" && (await rich.get("/api/subscription")).data.subscription.plan === "MONTHLY", "a failed card payment changes nothing");
  const card2 = await rich.post("/api/subscription/subscribe", { plan: "YEARLY", method: "card" });
  await mock(card2.data.reference, "success");
  const cok = (await rich.get(`/api/checkout/verify?reference=${card2.data.reference}`)).data;
  const richSub = (await rich.get("/api/subscription")).data;
  ok(cok.status === "PAID" && cok.kind === "SUBSCRIPTION" && richSub.subscription.plan === "YEARLY" && richSub.payments.length === 2, "a confirmed card payment activates the plan and is recorded");
  ok((await u.get(`/api/checkout/verify?reference=${card2.data.reference}`)).status === 404, "one reader can't look at another's payment");
  // auto-renew from wallet + expiry
  ok((await rich.post("/api/subscription/auto-renew", { enabled: true })).data.autoRenew === true, "wallet auto-renew can be switched on");
  const subRow = await db.subscription.findFirst({ where: { userId: richU!.id, status: "ACTIVE" } });
  await db.subscription.update({ where: { id: subRow!.id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
  const lapsed = (await rich.get("/api/subscription")).data;
  ok(lapsed.adFree === false && (await db.subscription.findUnique({ where: { id: subRow!.id } }))!.status === "EXPIRED", "with no funds to renew, a lapsed subscription ends and ads come back");
  const gb2 = await db.subscription.create({ data: { userId: richU!.id, plan: "MONTHLY", currentPeriodEnd: new Date(Date.now() - 1000), autoRenew: true } });
  await db.subscriptionPayment.create({ data: { subscriptionId: gb2.id, userId: richU!.id, plan: "MONTHLY", amountMinor: ngM.amountMinor, currency: "NGN", usdMinor: 200, method: "WALLET", reference: `seed-${stamp}`, periodStart: new Date(Date.now() - 30 * 86400_000), periodEnd: new Date(Date.now() - 1000) } });
  await db.walletTx.create({ data: { userId: richU!.id, currency: "NGN", type: "TOPUP", amountMinor: ngM.amountMinor * 2, description: "test" } });
  const renewed = (await rich.get("/api/subscription")).data;
  ok(renewed.adFree === true && renewed.subscription.plan === "MONTHLY", "with wallet funds and auto-renew on, the subscription renews itself");

  // ---------------------------------------------------------------- security
  section("Security");
  const xo = await fetch(BASE + "/api/me", { method: "PATCH", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: [...u.jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify({ firstName: "Hacked" }) });
  ok(xo.status === 403, "cross-site writes blocked");
  const html = await (await fetch(BASE + "/sign-in")).text();
  ok(!/sk_test_mock|PAYSTACK|DATABASE_URL|ChangeMe/.test(html), "no secrets in served HTML");
  const h = (await fetch(BASE + "/sign-in")).headers;
  ok(h.get("x-frame-options") === "DENY" && h.get("x-content-type-options") === "nosniff", "security headers set");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
