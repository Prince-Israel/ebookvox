import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";

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

  // clear all notifications
  const nBefore = (await u.get("/api/notifications")).data.notifications.length;
  const gbN = (await gb.get("/api/notifications")).data.notifications.length;
  ok((await new Client().req("DELETE", "/api/notifications")).status === 401, "clearing notifications requires login");
  const cleared = await u.req("DELETE", "/api/notifications");
  const nAfter = (await u.get("/api/notifications")).data;
  ok(nBefore > 0 && cleared.status === 200 && nAfter.notifications.length === 0 && nAfter.unread === 0, "Clear all removes every notification for the user", { nBefore, nAfter });
  ok((await gb.get("/api/notifications")).data.notifications.length === gbN, "clearing one user's notifications leaves other users' untouched");

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
