import { chromium, devices, type Page } from "playwright";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: ReaderPrisma } = require("/Users/mac/Development/ebookvox/node_modules/@prisma/client");

const BASE = process.env.BASE!, READER = process.env.READER!, MOCK = "http://localhost:4010";
const SHOTS = process.env.SHOTS ?? "/tmp/evp-shots";
mkdirSync(path.join(SHOTS, "fx"), { recursive: true });
const db = new PrismaClient();
const rdb = new ReaderPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/prisma/test-pub.db" } } });
let pass = 0; const failures: string[] = [];
const ok = (c: unknown, n: string, d?: unknown) => { if (c) { pass++; console.log("  ✓", n); } else { failures.push(n); console.log("  ✗", n, d ?? ""); } };
const section = (s: string) => console.log(`\n${s}`);
const stamp = Date.now().toString(36), email = `ui-pub.${stamp}@example.com`, pw = "Sup3rSecret!";
const INIT = "window.__name = (f) => f;";
const sign = (body: string) => createHmac("sha256", "test-webhook-secret").update(body).digest("hex");

async function overflow(p: Page, label: string) {
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(o.sw <= o.iw + 1, `no horizontal overflow: ${label} (${o.sw}/${o.iw})`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("   [pageerror]", e.message));
  const shot = (n: string) => p.screenshot({ path: `${SHOTS}/${n}.png` });
  const fx = (n: string) => path.join(SHOTS, "fx", n);

  section("Landing & signup (iPhone 13)");
  await p.goto(BASE + "/");
  ok(await p.getByRole("heading", { name: /Publish\. Be heard\. Get paid\./ }).isVisible(), "landing page");
  ok(!(await p.content()).toLowerCase().includes("guest"), "no guest access");
  await shot("01-landing");
  await p.goto(BASE + "/dashboard");
  ok(p.url().includes("/sign-in"), "dashboard requires sign-in");
  await p.goto(BASE + "/sign-up");
  await p.locator("#su-first").fill("Ngozi");
  await p.locator("#su-last").fill("Eze Press");
  await p.locator("#su-email").fill(email);
  await p.locator("#su-phone").pressSequentially("abc80-12 34x5678@y");
  ok((await p.locator("#su-phone").inputValue()) === "8012345678", "phone accepts numbers only");
  await p.locator("#su-country").selectOption("NG");
  ok((await p.locator("#su-dial").inputValue()) === "NG", "dialing code follows country");
  await p.locator("#su-password").fill(pw);
  await p.locator("#su-confirm").fill(pw);
  ok((await p.locator("#su-phone").inputValue()) === "8012345678" && (await p.locator("#su-password").inputValue()) === pw, "phone and password inputs are independent");
  await shot("02-signup");
  ok(!(await p.locator("#su-terms").isChecked()), "the Privacy Policy & Terms box starts unticked");
  const ph = await p.locator("label[for=su-terms] a", { hasText: "Privacy Policy" }).getAttribute("href");
  const th = await p.locator("label[for=su-terms] a", { hasText: "Terms" }).getAttribute("href");
  ok(/\/privacy$/.test(ph ?? "") && /\/terms$/.test(th ?? "") && /^https?:\/\//.test(ph ?? ""), "the checkbox links to the Privacy Policy and Terms pages on the Reader site", { ph, th });
  await p.getByRole("button", { name: "Create Publisher Account" }).click();
  await p.getByText("Please accept the Privacy Policy and Terms to continue.").waitFor({ timeout: 5000 });
  ok(p.url().includes("/sign-up"), "submitting without ticking the box is blocked");
  ok((await p.locator("footer nav[aria-label=Legal] a").count()) >= 2, "the sign-up page footer links to the Privacy Policy and Terms");
  await p.locator("#su-terms").check();
  await p.getByRole("button", { name: "Create Publisher Account" }).click();
  await p.getByRole("heading", { name: "Verify your email" }).waitFor({ timeout: 15000 });
  ok(true, "unverified publisher sees the verification gate");
  await p.goto(BASE + "/books");
  ok(await p.getByRole("heading", { name: "Verify your email" }).isVisible(), "other pages are gated too");
  const log = await db.emailLog.findFirst({ where: { toEmail: email, subject: { contains: "Verify" } }, orderBy: { createdAt: "desc" } });
  await p.goto(`${BASE}/verify-email?token=${log!.body.match(/token=([\w-]+)/)![1]}`);
  await p.getByRole("heading", { name: "Email verified" }).waitFor();
  ok(true, "email verification link works");
  await p.goto(BASE + "/dashboard");
  await p.getByRole("heading", { name: "Welcome, Ngozi" }).waitFor();
  ok(true, "dashboard after verification");

  section("Empty dashboard & navigation drawer");
  await p.getByText("Publish your first book").waitFor();
  ok(true, "empty state for new publisher");
  await p.getByRole("button", { name: "Open menu" }).click();
  const nav = p.getByRole("dialog", { name: "Menu" });
  let missing = 0;
  for (const l of ["Dashboard", "My Books", "Upload Book", "Sales", "Wallet", "Payouts", "Payment Method", "Support", "Notifications", "Profile", "Settings"]) if (!(await nav.getByRole("link", { name: new RegExp(`^${l}( \\d+ unread)?$`) }).isVisible())) { missing++; console.log("   missing", l); }
  ok(missing === 0, "mobile drawer lists every section");
  await p.goto(BASE + "/books");
  await p.getByRole("button", { name: "Open menu" }).click();
  ok(await nav.getByRole("link", { name: "Drafts" }).isVisible() && await nav.getByRole("link", { name: "Under Review" }).isVisible() && await nav.getByRole("link", { name: "Rejected" }).isVisible() && await nav.getByRole("link", { name: "Approved" }).isVisible() && await nav.getByRole("link", { name: "All Books" }).isVisible(), "My Books sub-menu (All / Approved / Under Review / Rejected / Drafts)");
  await shot("03-drawer");
  await p.keyboard.press("Escape");
  ok(!(await nav.isVisible()), "drawer closes");

  section("Upload book (validation, progress, draft, submit)");
  await p.goto(BASE + "/books/new");
  writeFileSync(fx("cover.jpg"), await sharp({ create: { width: 800, height: 1200, channels: 3, background: "#8a5a44" } }).jpeg().toBuffer());
  writeFileSync(fx("book.txt"), "# Chapter One\n\n" + Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1}: the tide came in over the harbour wall and the lamps along the quay were lit one by one.`).join("\n\n") + "\n\n# Chapter Two\n\n" + Array.from({ length: 10 }, (_, i) => `Second chapter paragraph ${i + 1}, where the story moves inland.`).join("\n\n"));
  writeFileSync(fx("bad.exe"), "MZ");
  await p.getByRole("button", { name: /Save Draft/ }).click();
  await p.getByRole("alert").first().waitFor();
  ok(true, "empty form shows a clear validation error");
  await p.locator("#bk-title").fill("Harbour Lights");
  await p.locator("#bk-author").fill("Ngozi Eze");
  await p.locator("#bk-category").selectOption("Contemporary Fiction");
  await p.locator("#bk-desc").fill("A quiet story about a harbour town, its lamplighters and the families that depend on the tide.");
  await p.locator("#bk-cover").setInputFiles(fx("cover.jpg"));
  await p.locator("#bk-file").setInputFiles(fx("bad.exe"));
  await p.locator("#bk-price-NGN").fill("2500");
  ok((await p.locator("#bk-price-USD").count()) === 0 && (await p.locator("#bk-price-GBP").count()) === 0 && await p.getByText(/converted at the international exchange rate/i).first().isVisible(), "publisher sets one price in their own currency; others are converted automatically");
  ok(await p.getByText("You receive ₦2,125", { exact: false }).first().isVisible(), "form shows the publisher's 85% take-home");
  await p.getByRole("button", { name: /Save Draft/ }).click();
  await p.getByText(/must be a PDF, DOCX or TXT/).first().waitFor();
  ok(true, "invalid book file type rejected with a clear message");
  await p.locator("#bk-file").setInputFiles(fx("book.txt"));
  await shot("04-upload-form");
  await overflow(p, "upload form");
  await p.getByRole("button", { name: /Save Draft/ }).click();
  await p.waitForURL(/\/books\/[a-z0-9]+$/);
  await p.getByRole("heading", { name: "Harbour Lights" }).waitFor();
  ok(await p.getByText("Draft", { exact: true }).first().isVisible(), "saved as Draft");
  await shot("05-book-draft");
  await p.getByRole("button", { name: "Submit for Review" }).click();
  await p.getByText("Reviewing", { exact: true }).first().waitFor();
  ok(true, "Submit for Review → Reviewing");
  const bookId = p.url().split("/").pop()!;
  await p.goto(BASE + "/books?tab=reviewing");
  await p.getByRole("link", { name: "Harbour Lights" }).first().waitFor();
  ok(true, "listed under Under Review");
  await shot("06-books-reviewing");
  await overflow(p, "my books");

  section("Rejection → edit → resubmit → approval → Reader");
  const sin = await fetch(BASE + "/api/auth/signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@publisher.ebookvox.app", password: "ChangeMe!2026" }) });
  const ajar = sin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const admin = (u: string, body: object) => fetch(BASE + u, { method: "POST", headers: { "content-type": "application/json", cookie: ajar }, body: JSON.stringify(body) });
  ok((await admin(`/api/admin/review/${bookId}`, { action: "reject", reason: "Please add a longer description and a clearer cover." })).status === 200, "admin rejects");
  await p.goto(BASE + "/books?tab=rejected");
  await p.getByText("Please add a longer description").first().waitFor();
  ok(true, "rejection reason shown to publisher");
  await shot("07-rejected");
  await p.getByRole("link", { name: "Edit" }).first().click();
  await p.locator("#bk-desc").waitFor();
  await p.locator("#bk-desc").fill("A quiet, richly observed story about a harbour town, its lamplighters and the families that depend on the tide — now with a much longer description.");
  await p.getByRole("button", { name: "Resubmit for Review" }).click();
  await p.getByText("Reviewing", { exact: true }).first().waitFor();
  ok(true, "edited and resubmitted");
  const ap = await admin(`/api/admin/review/${bookId}`, { action: "approve" });
  ok(ap.status === 200 && (await ap.json()).status === "PUBLISHED", "admin approves → published to Reader");
  await p.reload();
  await p.getByText("Live in the Reader catalogue").waitFor();
  ok(true, "publisher sees Published");
  await p.goto(BASE + "/books?tab=approved");
  await p.getByRole("link", { name: "Harbour Lights" }).first().waitFor();
  ok(true, "listed under Approved");

  const rc = await fetch(READER + "/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: "Tola", lastName: "Reader", email: `r.${stamp}@example.com`, password: pw, acceptTerms: true, confirmPassword: pw, country: "NG", phoneCountry: "NG", phone: "8099999999" }) });
  const rjar = rc.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  await rdb.user.updateMany({ where: { email: `r.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  const rget = (u: string, init: RequestInit = {}) => fetch(READER + u, { ...init, headers: { cookie: rjar, "content-type": "application/json" } });
  const hl = (await (await rget("/api/books")).json()).books.find((b: any) => b.title === "Harbour Lights");
  ok(hl && hl.price.currency === "NGN" && hl.coverUrl, "book visible in Reader with cover and ₦ price");
  const co = await (await rget("/api/checkout", { method: "POST", body: JSON.stringify({ bookId: hl.id }) })).json();
  await fetch(`${MOCK}/__set/${co.reference}/success`);
  ok((await (await rget(`/api/checkout/verify?reference=${co.reference}`)).json()).status === "PAID", "reader purchase verified by Paystack");
  for (let i = 0; i < 6; i++) {
    const evt = JSON.stringify({ type: "sale.completed", data: { orderId: `hist-${stamp}-${i}`, orderNumber: `ORD-H${i}`, bookExternalId: bookId, buyer: `Reader ${i} X.`, amountMinor: 250000, currency: "NGN", paidAt: new Date(Date.now() - (i + 1) * 3 * 86400_000).toISOString() } });
    await fetch(BASE + "/api/webhooks/reader", { method: "POST", body: evt, headers: { "x-ebookvox-signature": sign(evt) } });
  }

  section("Dashboard, sales, wallet");
  await p.goto(BASE + "/dashboard");
  await p.getByRole("heading", { name: "Sales over time" }).waitFor();
  ok(await p.getByText("Total sales").isVisible() && await p.getByText("Available wallet balance").isVisible() && await p.getByText("Pending withdrawal").isVisible() && await p.getByText("Total withdrawn").isVisible() && await p.getByText("Total earnings").isVisible(), "dashboard cards present");
  ok(await p.getByRole("heading", { name: "Earnings over time" }).isVisible() && await p.getByRole("heading", { name: "Books sold" }).isVisible() && await p.getByRole("heading", { name: "Top performing books" }).isVisible(), "all four charts");
  for (const r of ["7 days", "30 days", "3 months", "6 months", "1 year"]) { await p.getByRole("tab", { name: r }).click(); await p.waitForLoadState("networkidle"); }
  ok(true, "all five time filters work");
  await p.getByRole("tab", { name: "30 days" }).click();
  await p.waitForLoadState("networkidle");
  await p.locator("svg[role=img]").first().hover({ position: { x: 200, y: 100 } });
  await shot("08-dashboard");
  await overflow(p, "dashboard with data");
  await p.goto(BASE + "/sales");
  await p.getByText("Harbour Lights").filter({ visible: true }).first().waitFor();
  ok(await p.getByText("₦2,125").filter({ visible: true }).first().isVisible(), "sales show the 85% share (₦2,125 of ₦2,500)");
  await shot("09-sales");
  await overflow(p, "sales");
  await p.goto(BASE + "/wallet");
  await p.getByText("Available balance").waitFor();
  ok(await p.getByText("Sale credit").first().isVisible(), "wallet lists transactions");
  await shot("10-wallet");
  await overflow(p, "wallet");

  section("Payment method & withdrawal");
  await p.goto(BASE + "/payment-method");
  await p.locator("#pm-bank").selectOption({ label: "Zenith Bank" });
  await p.locator("#pm-name").fill("Ngozi Eze");
  await p.locator("#pm-number").pressSequentially("01a2b3456789xyz");
  ok((await p.locator("#pm-number").inputValue()) === "0123456789", "account number accepts digits only");
  await p.getByRole("button", { name: "Save payment method" }).click();
  await p.getByText(/Zenith Bank · ••••••6789/).first().waitFor();
  ok(true, "bank details saved");
  await shot("11-payment-method");
  const big = JSON.stringify({ type: "sale.completed", data: { orderId: `big-${stamp}`, orderNumber: "ORD-BIG", bookExternalId: bookId, buyer: "Big B.", amountMinor: 12000000, currency: "NGN", paidAt: new Date().toISOString() } });
  await fetch(BASE + "/api/webhooks/reader", { method: "POST", body: big, headers: { "x-ebookvox-signature": sign(big) } });
  await p.goto(BASE + "/payouts");
  await p.locator("#wd-amount").fill("50000");
  await p.getByRole("button", { name: "Request withdrawal" }).click();
  await p.getByText(/minimum withdrawal is ₦100,000/i).first().waitFor();
  ok(true, "UI shows minimum-withdrawal message");
  await p.locator("#wd-amount").fill("9000000");
  await p.getByRole("button", { name: "Request withdrawal" }).click();
  await p.getByText(/available balance is insufficient/).first().waitFor();
  ok(true, "UI shows insufficient-balance message");
  await p.locator("#wd-amount").fill("100000");
  await p.getByRole("button", { name: "Request withdrawal" }).click();
  await p.getByText("Processing", { exact: true }).filter({ visible: true }).first().waitFor();
  ok(true, "withdrawal status: Processing");
  ok(await p.getByRole("button", { name: "Request withdrawal" }).isDisabled(), "form locked while a withdrawal is processing");
  await shot("12-payouts");
  await overflow(p, "payouts");
  const wd = await db.withdrawal.findFirst({ where: { publisher: { email } } });
  await admin(`/api/admin/withdrawals/${wd!.id}`, { action: "paid", reference: "TRX-0001-OK" });
  await p.reload();
  await p.getByText("Paid", { exact: true }).filter({ visible: true }).first().waitFor();
  ok(true, "status becomes Paid after admin processes it");

  section("Support, notifications, profile, settings");
  await p.goto(BASE + "/support");
  await p.getByRole("button", { name: /New ticket/ }).first().click();
  await p.locator("#t-subject").fill("Payout timing");
  await p.locator("#t-message").fill("How long do bank payouts take?");
  await p.getByRole("button", { name: "Submit ticket" }).click();
  await p.waitForURL(/\/support\/.+/);
  const tk = await db.ticket.findFirst({ where: { user: { email } } });
  await admin(`/api/admin/tickets/${tk!.id}`, { message: "Usually within two business days." });
  await p.reload();
  await p.getByText("Usually within two business days.").waitFor();
  ok(await p.getByText("Waiting for Publisher").first().isVisible(), "admin reply visible; status Waiting for Publisher");
  await shot("13-support");
  await admin(`/api/admin/tickets/${tk!.id}`, { status: "CLOSED" });
  await p.reload();
  await p.getByText(/ticket is closed/).waitFor();
  ok((await p.locator("#reply").count()) === 0, "closed ticket: no reply box");
  await p.goto(BASE + "/dashboard");
  const bell = p.getByRole("link", { name: /Notifications, \d+ unread/ });
  await bell.waitFor();
  ok(true, "unread badge: " + (await bell.getAttribute("aria-label")));
  await bell.click();
  await p.getByRole("heading", { name: "Notifications" }).waitFor();
  await shot("14-notifications");
  await p.getByText("New sale").first().click();
  await p.waitForURL("**/sales");
  await p.goto(BASE + "/notifications");
  await p.getByRole("button", { name: /Mark all read/ }).click();
  await p.getByText("You're all caught up").waitFor();
  ok(true, "mark all read clears the count");

  await p.goto(BASE + "/profile");
  writeFileSync(fx("me.png"), await sharp({ create: { width: 900, height: 700, channels: 3, background: "#d98e62" } }).png().toBuffer());
  await p.locator("#avatar-file").setInputFiles(fx("me.png"));
  await p.getByRole("img", { name: /profile photo/ }).first().waitFor({ timeout: 15000 });
  ok(await p.getByRole("img", { name: /profile photo/ }).first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), "profile photo uploaded and displayed");
  await p.locator("#pf-bio").fill("Writer of harbour stories.");
  await p.getByRole("button", { name: "Save profile" }).click();
  await p.getByText("Profile saved.").waitFor();
  ok((await db.user.findUnique({ where: { email } }))!.bio === "Writer of harbour stories.", "profile edits persist");
  await shot("15-profile");
  await overflow(p, "profile");

  await p.goto(BASE + "/settings");
  await p.locator("#pw-current").fill(pw);
  await p.locator("#pw-new").fill("Brand1NewPass");
  await p.locator("#pw-confirm").fill("Mismatch1Pass");
  ok((await p.locator("#pw-current").inputValue()) === pw && (await p.locator("#pw-new").inputValue()) === "Brand1NewPass", "password inputs hold independent values");
  await p.getByRole("button", { name: "Update password" }).click();
  await p.getByText("Passwords do not match.").first().waitFor();
  ok(true, "mismatch error shown");
  await p.locator("#pw-confirm").fill("Brand1NewPass");
  await p.getByRole("button", { name: "Update password" }).click();
  await p.getByText("Password updated.").waitFor();
  ok(true, "password changed");
  await p.getByRole("button", { name: "Dark", exact: true }).click();
  await p.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  ok(true, "dark mode applies");
  await shot("16-settings-dark");

  section("Dark mode contrast & responsive sweep");
  const routes = ["/dashboard", "/books", "/books/new", `/books/${bookId}`, "/sales", "/wallet", "/payouts", "/payment-method", "/support", "/notifications", "/profile", "/settings"];
  for (const route of routes) {
    await p.goto(BASE + route);
    await p.waitForLoadState("networkidle");
    const bad = await p.evaluate(() => {
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const bgOf = (el: Element | null): number[] => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; el = el.parentElement; } return [23, 17, 14]; };
      const out: string[] = [];
      document.querySelectorAll("a, button, h1, h2, h3, label, p, span, dt, dd, td, th").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1)) return;
        const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(bgOf(el))].sort((x, y) => y - x);
        const cr = (a + 0.05) / (b + 0.05);
        if (cr < 3) out.push(`${el.tagName.toLowerCase()}:"${(el.textContent ?? "").trim().slice(0, 24)}" ${cr.toFixed(2)}`);
      });
      return out.slice(0, 5);
    });
    ok(bad.length === 0, `dark mode contrast ≥ 3:1: ${route}`, bad);
  }
  await p.goto(BASE + "/dashboard"); await p.waitForLoadState("networkidle"); await shot("17-dashboard-dark");
  const cookies = await ctx.cookies();
  for (const [name, opts] of [["Pixel 7", devices["Pixel 7"]], ["iPad (gen 7)", devices["iPad (gen 7)"]], ["Desktop 1280", { viewport: { width: 1280, height: 800 } }], ["Small phone 320", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }]] as Array<[string, any]>) {
    const c2 = await browser.newContext(opts);
    await c2.addInitScript(INIT);
    await c2.addCookies(cookies);
    const q = await c2.newPage();
    let bad = 0;
    for (const route of routes) {
      await q.goto(BASE + route);
      await q.waitForLoadState("networkidle");
      const o = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) { bad++; console.log(`   overflow ${name} ${route} ${o.sw}/${o.iw}`); }
    }
    await q.goto(BASE + "/dashboard"); await q.waitForLoadState("networkidle");
    await q.screenshot({ path: `${SHOTS}/sweep-${name.replace(/\W+/g, "_")}.png` });
    ok(bad === 0, `${name}: ${routes.length} screens without horizontal overflow`);
    await c2.close();
  }

  section("Logout");
  await p.goto(BASE + "/settings");
  await p.getByRole("button", { name: "Sign out" }).last().click();
  await p.waitForURL("**/sign-in");
  await p.goto(BASE + "/dashboard");
  ok(p.url().includes("/sign-in"), "logout works");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await browser.close(); await db.$disconnect(); await rdb.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
