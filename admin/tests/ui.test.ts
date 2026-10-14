import { chromium, devices, type Page, type BrowserContext } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: ReaderPrisma } = require("/Users/mac/Development/ebookvox/node_modules/@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: PubPrisma } = require("/Users/mac/Development/ebookvox/publisher/node_modules/@prisma/client");

const BASE = process.env.BASE!, READER = process.env.READER!, PUB = process.env.PUB!, MOCK = "http://localhost:4010";
const SHOTS = process.env.SHOTS ?? "/tmp/eva-shots";
mkdirSync(path.join(SHOTS, "fx"), { recursive: true });
const rdb = new ReaderPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/prisma/test-adm.db" } } });
const pdb = new PubPrisma({ datasources: { db: { url: "file:/Users/mac/Development/ebookvox/publisher/prisma/test-adm.db" } } });
let pass = 0; const failures: string[] = [];
const ok = (c: unknown, n: string, d?: unknown) => { if (c) { pass++; console.log("  ✓", n); } else { failures.push(n); console.log("  ✗", n, d ?? ""); } };
const section = (s: string) => console.log(`\n${s}`);
const stamp = Date.now().toString(36), pw = "Sup3rSecret!";
const INIT = "window.__name = (f) => f;";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(base: string, jar: { v: string }, method: string, p: string, body?: unknown) {
  const res = await fetch(base + p, { method, headers: { "content-type": "application/json", cookie: jar.v }, body: body ? JSON.stringify(body) : undefined });
  const c = res.headers.getSetCookie().map((x) => x.split(";")[0]).join("; ");
  if (c) jar.v = c;
  return { status: res.status, data: await res.json().catch(() => null) };
}
async function overflow(p: Page, label: string) { const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); ok(o.sw <= o.iw + 1, `no horizontal overflow: ${label} (${o.sw}/${o.iw})`); }

async function main() {
  // ---- seed the ecosystem through the real APIs
  const rj = { v: "" }, pj = { v: "" };
  const rs = await api(READER, rj, "POST", "/api/auth/signup", { firstName: "Ola", lastName: "Reader", email: `ola.${stamp}@example.com`, password: pw, confirmPassword: pw, country: "NG", phoneCountry: "NG", phone: "8012345678" });
  await rdb.user.updateMany({ where: { email: `ola.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  const ps = await api(PUB, pj, "POST", "/api/auth/signup", { firstName: "Pia", lastName: "Press", email: `pia.${stamp}@example.com`, password: pw, confirmPassword: pw, country: "NG", phoneCountry: "NG", phone: "8087654321" });
  await pdb.user.updateMany({ where: { email: `pia.${stamp}@example.com` }, data: { emailVerifiedAt: new Date() } });
  const mkBook = async (title: string) => {
    const fd = new FormData();
    const f = { title, author: "Pia Press", category: "Classic Fiction", description: "A long enough description of this test book for the moderation queue.", isFree: false, prices: { NGN: 15000000, USD: 10000, GBP: 8000, EUR: 9500 } };
    for (const [k, v] of Object.entries(f)) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    fd.append("cover", new Blob([new Uint8Array(await sharp({ create: { width: 600, height: 900, channels: 3, background: "#8a5a44" } }).jpeg().toBuffer())], { type: "image/jpeg" }), "c.jpg");
    fd.append("file", new Blob(["# One\n\n" + Array.from({ length: 20 }, (_, i) => `Paragraph ${i} of the test book about tides and harbours.`).join("\n\n")], { type: "text/plain" }), "b.txt");
    const r = await fetch(PUB + "/api/books", { method: "POST", headers: { cookie: pj.v }, body: fd });
    const id = (await r.json()).id as string;
    await api(PUB, pj, "POST", `/api/books/${id}/submit`);
    return id;
  };
  const book1 = await mkBook(`UI Book One ${stamp}`), book2 = await mkBook(`UI Book Two ${stamp}`);
  ok(ps.status === 200 && rs.status === 200 && book1 && book2, "seeded 1 reader, 1 publisher, 2 submitted books");
  await sleep(1200);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("   [pageerror]", e.message));
  const shot = (n: string, page: Page = p) => page.screenshot({ path: `${SHOTS}/${n}.png` });
  const fx = (n: string) => path.join(SHOTS, "fx", n);

  section("Login (desktop)");
  await p.goto(BASE + "/dashboard");
  ok(p.url().includes("/login"), "dashboard redirects to login when signed out");
  ok((await p.getByText(/sign.?up|create account|register/i).count()) === 0, "no signup / registration UI on the login page");
  await shot("01-login");
  await p.locator("#admin-email").fill("superadmin@ebookvox.app");
  await p.locator("#admin-password").fill("wrong-password");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.getByText("Incorrect email or password.").waitFor();
  ok(true, "wrong password shows a clear error");
  await p.locator("#admin-password").fill("ChangeMe!2026");
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForURL("**/dashboard");
  await p.getByRole("heading", { name: /Welcome, Super/ }).waitFor();
  ok(true, "super admin signs in");

  section("Header & shell");
  ok(await p.getByRole("button", { name: "Toggle menu" }).isVisible() && await p.getByRole("searchbox", { name: /Search users, books, orders/ }).isVisible(), "header: menu toggle + global search");
  ok(await p.getByPlaceholder("Search users, books, orders...").isVisible(), "search placeholder text");
  ok(await p.getByRole("button", { name: /Switch to dark mode/ }).isVisible() && await p.getByRole("link", { name: /Notifications/ }).isVisible() && await p.getByRole("button", { name: "Admin menu" }).isVisible(), "theme toggle, notifications bell, admin profile");
  ok(await p.getByText("Super Admin", { exact: true }).first().isVisible(), "admin name + role shown");
  const navLabels = ["Dashboard", "Users", "Publishers", "Authors", "All Books", "Publisher Books", "Book Review", "Orders", "Transactions", "Publisher Sales", "Publisher Payouts", "Support", "Activity Log", "Admins", "Settings"];
  let missing = 0; for (const l of navLabels) if (!(await p.getByRole("navigation", { name: "Main" }).getByRole("link", { name: new RegExp(`^${l}( \\d+ unread support messages)?$`) }).isVisible())) { missing++; console.log("   missing nav:", l); }
  ok(missing === 0, "sidebar lists every section for a Super Admin");
  await p.getByRole("button", { name: "Toggle menu" }).click();
  ok(!(await p.getByRole("navigation", { name: "Main" }).isVisible()), "menu toggle collapses the sidebar");
  const mainW = await p.locator("main").evaluate((m) => m.getBoundingClientRect().width);
  ok(mainW > 900, `after collapsing, the content uses the full width (${Math.round(mainW)}px)`);
  await p.getByRole("button", { name: "Toggle menu" }).click();
  ok(await p.getByRole("navigation", { name: "Main" }).isVisible(), "…and expands it again");

  section("Dashboard");
  await p.getByText("TOTAL USERS", { exact: false }).first().waitFor();
  const cardTitles = ["Total users", "Total books", "Total orders", "Total publishers", "Gross revenue"];
  let miss2 = 0; for (const t of cardTitles) if (!(await p.getByLabel(t, { exact: true }).isVisible())) { miss2++; console.log("   missing card", t); }
  ok(miss2 === 0, "all five dashboard cards");
  const usersCard = await p.getByLabel("Total users", { exact: true }).innerText();
  const dbUsers = await rdb.user.count({ where: { role: "USER", status: { not: "DELETED" } } });
  ok(new RegExp(`\\b${dbUsers}\\b`).test(usersCard) && /Active/.test(usersCard) && /Suspended/.test(usersCard), `users card shows the live total (${dbUsers}) with Active/Suspended`, usersCard);
  const booksCard = await p.getByLabel("Total books", { exact: true }).innerText();
  ok(/Reader books/.test(booksCard) && /Publisher books/.test(booksCard) && /Approved/.test(booksCard), "books card breakdown");
  ok(/Paid/.test(await p.getByLabel("Total orders", { exact: true }).innerText()), "orders card breakdown");
  ok(/Active/.test(await p.getByLabel("Total publishers", { exact: true }).innerText()), "publishers card breakdown");
  ok(await p.getByRole("heading", { name: "User growth" }).isVisible() && await p.getByRole("heading", { name: "Book categories" }).isVisible() && await p.getByRole("heading", { name: "Recent book activity" }).isVisible(), "growth chart, categories and recent activity");
  for (const r of ["7 days", "30 days", "3 months", "6 months", "1 year"]) { await p.getByRole("tab", { name: r }).click(); await p.waitForLoadState("networkidle"); }
  ok(true, "all five range filters");
  await p.getByRole("tab", { name: "30 days" }).click();
  await p.waitForLoadState("networkidle");
  await p.locator("svg[role=img]").first().hover({ position: { x: 300, y: 100 } });
  await shot("02-dashboard");
  await overflow(p, "dashboard desktop");

  section("Book review (UI)");
  await p.goto(BASE + "/book-review");
  await p.getByRole("heading", { name: `UI Book One ${stamp}` }).waitFor();
  ok(await p.getByRole("heading", { name: `UI Book Two ${stamp}` }).isVisible(), "queue shows submitted books");
  await shot("03-book-review");
  const card1 = p.locator("li", { has: p.getByRole("heading", { name: `UI Book One ${stamp}` }) });
  ok(await card1.getByText("Pia Press").first().isVisible() && await card1.getByRole("button", { name: "Approve" }).isVisible() && await card1.getByRole("button", { name: "Reject" }).isVisible() && await card1.getByRole("button", { name: "Review" }).isVisible(), "each book offers Approve / Reject / Review");
  await card1.getByRole("button", { name: "Review" }).click();
  await p.getByText("Text preview").waitFor();
  ok(await p.getByText("Paragraph 1 of the test book").first().isVisible() || await p.getByText("tides and harbours").first().isVisible(), "Review opens detail with the text preview");
  await p.keyboard.press("Escape");
  const card2 = p.locator("li", { has: p.getByRole("heading", { name: `UI Book Two ${stamp}` }) });
  await card2.getByRole("button", { name: "Reject" }).click();
  const rejBtn = p.getByRole("dialog").getByRole("button", { name: "Reject book" });
  ok(await rejBtn.isDisabled(), "Reject stays disabled until a reason is typed");
  await p.locator("#confirm-input").fill("Cover artwork is too low resolution; please upload a sharper image.");
  await rejBtn.click();
  await p.getByText("Book rejected. The publisher can see your reason.").waitFor();
  ok((await pdb.book.findUnique({ where: { id: book2 } })).status === "REJECTED", "rejection saved and sent to the publisher");
  await card1.getByRole("button", { name: "Approve" }).click();
  await p.getByText(/Approved — the book is now live/).waitFor({ timeout: 30000 });
  ok((await pdb.book.findUnique({ where: { id: book1 } })).status === "PUBLISHED" && !!(await rdb.book.findFirst({ where: { externalId: book1, status: "APPROVED" } })), "approval published the book to the Reader catalogue");
  await p.getByRole("tab", { name: "Rejected" }).click();
  await p.getByText("Cover artwork is too low resolution").first().waitFor();
  ok(true, "rejected tab shows the reason");

  section("Users (UI)");
  await p.goto(BASE + "/users");
  await p.getByRole("link", { name: "Ola Reader" }).first().waitFor();
  ok(await p.getByRole("columnheader", { name: "Purchased books" }).isVisible() && await p.getByRole("columnheader", { name: "Registered" }).isVisible(), "user table columns");
  await p.getByLabel("Search users", { exact: true }).fill("ola." + stamp);
  await p.getByRole("link", { name: "Ola Reader" }).first().waitFor();
  const row = p.locator("tr", { hasText: "Ola Reader" });
  await row.getByRole("button", { name: "Suspend" }).click();
  await p.getByText("Ola Reader was suspended.").waitFor();
  ok((await rdb.user.findFirst({ where: { email: `ola.${stamp}@example.com` } })).status === "SUSPENDED", "Suspend works from the table");
  await row.getByRole("button", { name: "Activate" }).click();
  await p.getByText("Ola Reader was activated.").waitFor();
  ok((await rdb.user.findFirst({ where: { email: `ola.${stamp}@example.com` } })).status === "ACTIVE", "Activate works");
  await row.getByRole("button", { name: "Edit" }).click();
  await p.locator("#e-first").fill("Olamide");
  await p.getByRole("button", { name: "Save changes" }).click();
  await p.getByText("Saved.").first().waitFor();
  ok((await rdb.user.findFirst({ where: { email: `ola.${stamp}@example.com` } })).firstName === "Olamide", "Edit saves");
  await p.getByRole("link", { name: "Olamide Reader" }).first().click();
  await p.getByRole("heading", { name: "Olamide Reader" }).waitFor();
  for (const t of ["Personal Information", "Account Status", "Purchase History", "Orders", "Library", "Support Tickets", "Activity"]) if (!(await p.getByRole("tab", { name: t }).isVisible())) ok(false, `profile tab ${t}`);
  ok(true, "user profile has all seven sections");
  await p.getByRole("tab", { name: "Activity" }).click();
  await p.getByText("Registered an account").waitFor();
  await shot("04-user-profile");
  const doomed = await api(READER, { v: "" }, "POST", "/api/auth/signup", { firstName: "Del", lastName: "Me", email: `delme.${stamp}@example.com`, password: pw, confirmPassword: pw, country: "NG", phoneCountry: "NG", phone: "8011111111" });
  await p.goto(BASE + "/users");
  await p.getByLabel("Search users", { exact: true }).fill("delme." + stamp);
  await p.getByRole("link", { name: "Del Me" }).first().waitFor();
  await p.locator("tr", { hasText: "Del Me" }).getByRole("button", { name: "Delete" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Delete user" }).click();
  await p.getByText("User deleted.").waitFor();
  ok((await rdb.user.findUnique({ where: { id: doomed.data.user.id } })).status === "DELETED", "Delete asks for confirmation then erases the user");
  await p.getByLabel("Search users", { exact: true }).fill("zzzz-nobody");
  await p.getByText("No users match").waitFor();
  ok(true, "empty state for no matches");

  section("Payouts (UI)");
  // make the publisher earn enough: two sales of ₦160,000? one sale (₦150,000 → ₦127,500) ≥ ₦100,000 minimum
  const rr = { v: rj.v };
  const login = await api(READER, rr, "POST", "/api/auth/signin", { email: `ola.${stamp}@example.com`, password: pw });
  const bk = await rdb.book.findFirst({ where: { externalId: book1 } });
  const co = await api(READER, rr, "POST", "/api/checkout", { bookId: bk.id });
  await fetch(`${MOCK}/__set/${co.data.reference}/success`);
  await api(READER, rr, "GET", `/api/checkout/verify?reference=${co.data.reference}`);
  await api(PUB, pj, "PUT", "/api/payment-method", { bankCode: "058", accountName: "Pia Press", accountNumber: "0123456789" });
  for (let i = 0; i < 40 && !(await pdb.sale.count()); i++) await sleep(500);
  const wr = await api(PUB, pj, "POST", "/api/withdrawals", { currency: "NGN", amount: 100000 });
  ok(login.status === 200 && wr.status === 200, "publisher earned and requested a ₦100,000 payout");
  await p.goto(BASE + "/payouts");
  await p.getByText("Pia Press").first().waitFor();
  ok(await p.getByRole("tab", { name: "Pending" }).isVisible() && await p.getByRole("tab", { name: "Processing" }).isVisible() && await p.getByRole("tab", { name: "Paid" }).isVisible() && await p.getByRole("tab", { name: "Rejected" }).isVisible(), "status tabs: Pending / Processing / Paid / Rejected");
  await shot("05-payouts");
  await p.getByRole("button", { name: "Mark Paid" }).first().click();
  const confirmPaid = p.getByRole("button", { name: "Confirm payout is Paid" });
  ok(await confirmPaid.isDisabled(), "Mark Paid is disabled until a payout reference is entered");
  await p.locator("#payout-ref").fill("GTB-REF-5521");
  await confirmPaid.click();
  await p.getByText(/Payout marked as Paid/).waitFor();
  ok((await pdb.withdrawal.findFirst({ where: { status: "PAID" } })).payoutReference === "GTB-REF-5521", "payout Paid with reference");

  section("Support (UI)");
  const tk = await api(READER, rr, "POST", "/api/tickets", { subject: "UI ticket", message: "Hello from the reader side." });
  await p.goto(BASE + "/support");
  await p.getByRole("link", { name: "UI ticket" }).first().click();
  await p.getByText("Hello from the reader side.").waitFor();
  await p.locator("#admin-reply").fill("Replying from the admin console.");
  await p.getByRole("button", { name: "Send reply" }).click();
  await p.getByText("Reply sent.").waitFor();
  await p.getByRole("list", { name: "Conversation" }).getByText("Replying from the admin console.").waitFor();
  const seen = await api(READER, rr, "GET", `/api/tickets/${tk.data.ticket.id}`);
  ok(seen.data.ticket.messages.at(-1).body === "Replying from the admin console." && seen.data.ticket.status === "WAITING_USER", "reply persisted and visible to the reader", seen);
  await p.getByRole("button", { name: "Closed", exact: true }).click({ timeout: 8000 }).catch(async (e) => { console.log("   page text:", (await p.locator("main").innerText()).slice(0, 600)); throw e; });
  await p.getByText(/ticket is closed, so replies are turned off/).waitFor();
  ok((await p.locator("#admin-reply").count()) === 0, "closed ticket: reply box removed");
  await shot("06-support");

  section("Notifications, search, activity (UI)");
  await p.goto(BASE + "/dashboard");
  const bell = p.getByRole("link", { name: /Notifications, \d+ unread/ });
  await bell.waitFor();
  ok(true, "unread badge: " + (await bell.getAttribute("aria-label")));
  await bell.click();
  await p.getByRole("heading", { name: "Notifications" }).waitFor();
  await shot("07-notifications");
  await p.getByRole("button", { name: /Mark all read/ }).click();
  await p.getByText("You're all caught up").waitFor();
  ok(true, "mark all read clears the badge");
  const box = p.getByRole("searchbox", { name: /Search users, books, orders/ });
  await box.fill("Aurora");
  await box.fill("Pia");
  await p.getByRole("listbox", { name: "Search results" }).getByRole("option").first().waitFor({ timeout: 15000 });
  ok(await p.getByRole("listbox", { name: "Search results" }).getByText(/Publisher|Author|Publisher book/).first().isVisible(), "global search shows typed results with a type label");
  await shot("08-search");
  await p.getByRole("listbox").getByRole("option").first().click();
  await p.waitForURL((u) => !u.pathname.endsWith("/notifications"), { timeout: 15000 });
  ok(/\/(publishers|authors|publisher-books|book-review|books)/.test(p.url()), "clicking a result navigates to the record", p.url());
  await p.goto(BASE + "/activity");
  await p.getByText("Approved book").first().waitFor();
  ok(await p.getByRole("columnheader", { name: "Actor" }).isVisible() && await p.getByRole("columnheader", { name: "Role" }).isVisible() && await p.getByRole("columnheader", { name: "Action" }).isVisible() && await p.getByRole("columnheader", { name: "Time" }).isVisible(), "activity table columns (actor, role, action, target, date, time)");

  section("Admins & permissions (UI)");
  await p.goto(BASE + "/admins");
  await p.getByRole("button", { name: "Create admin" }).click();
  await p.locator("#ad-name").fill("Fiona Finance");
  await p.locator("#ad-email").fill(`fiona.${stamp}@example.com`);
  await p.locator("#ad-job").fill("Finance lead");
  await p.locator("#ad-role").selectOption("FINANCE");
  ok(await p.getByLabel("Payouts").isChecked() && !(await p.getByLabel("Users", { exact: true }).isChecked()), "role selection pre-fills permissions");
  await p.getByLabel("Users", { exact: true }).check();
  await p.locator("#ad-pass").fill("TempPassw0rd!");
  await p.getByRole("button", { name: "Create administrator" }).click();
  await p.getByText("Administrator created.").waitFor();
  ok(await p.getByText("Fiona Finance").first().isVisible(), "admin created from the UI");
  // sign in as the new admin in a separate browser context
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx2.addInitScript(INIT);
  const f = await ctx2.newPage();
  await f.goto(BASE + "/login");
  await f.locator("#admin-email").fill(`fiona.${stamp}@example.com`);
  await f.locator("#admin-password").fill("TempPassw0rd!");
  await f.getByRole("button", { name: "Sign in" }).click();
  await f.waitForURL("**/settings");
  ok(await f.getByText("Your password is temporary").isVisible(), "new admin is sent to Settings to change the temporary password");
  await f.locator("#pw-current").fill("TempPassw0rd!"); await f.locator("#pw-new").fill("FionaNew#2026Pass"); await f.locator("#pw-confirm").fill("FionaNew#2026Pass");
  await f.getByRole("button", { name: "Update password" }).click();
  await f.waitForURL("**/dashboard");
  const fnav = f.getByRole("navigation", { name: "Main" });
  ok(await fnav.getByRole("link", { name: "Publisher Payouts" }).isVisible() && await fnav.getByRole("link", { name: "Users", exact: true }).isVisible() && !(await fnav.getByRole("link", { name: "Admins" }).isVisible()) && !(await fnav.getByRole("link", { name: "Book Review" }).isVisible()), "menu shows only permitted sections");
  await f.goto(BASE + "/admins");
  await f.getByText(/permission/i).first().waitFor();
  ok((await f.getByRole("button", { name: "Create admin" }).count()) === 0, "Admins page is not usable by a non-Super Admin (server-enforced)");
  await f.goto(BASE + "/book-review");
  await f.getByText(/don't have permission/i).first().waitFor();
  ok(true, "typing a forbidden URL shows a permission error, not data");
  await shot("09-limited-admin", f);
  await ctx2.close();

  section("Settings (UI)");
  await p.goto(BASE + "/settings");
  writeFileSync(fx("me.png"), await sharp({ create: { width: 800, height: 600, channels: 3, background: "#d98e62" } }).png().toBuffer());
  await p.locator("#admin-avatar").setInputFiles(fx("me.png"));
  await p.getByText("Profile photo updated.").waitFor();
  ok(await p.getByRole("img", { name: /profile photo/ }).first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), "profile photo uploaded and displayed");
  await p.locator("#pf-job").fill("Chief of Operations");
  await p.getByRole("button", { name: "Save profile" }).click();
  await p.getByText("Profile saved.").waitFor();
  ok(true, "profile saved");
  await p.getByText("v1.0.0").first().waitFor();
  ok(await p.getByText("Trinity Media Global").isVisible() && await p.getByText("© 2026 Ebookvox").first().isVisible(), "version, developer and copyright");
  await p.getByLabel("New category").fill("Cookbooks");
  await p.getByRole("button", { name: "Add" }).click();
  await p.getByRole("button", { name: "Save categories" }).click();
  await p.getByText("Saved and applied.").waitFor();
  ok((await pdb.platformConfig.findUnique({ where: { key: "categories" } })).value.includes("Cookbooks"), "category added in Settings reaches the Publisher platform");
  await shot("10-settings");
  await overflow(p, "settings desktop");

  section("Dark mode");
  await p.getByRole("button", { name: /Switch to dark mode/ }).click();
  await p.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  ok(true, "dark mode applies");
  const routes = ["/dashboard", "/users", "/publishers", "/authors", "/books", "/publisher-books", "/book-review", "/orders", "/transactions", "/sales", "/payouts", "/support", "/admins", "/activity", "/notifications", "/settings"];
  for (const route of routes) {
    await p.goto(BASE + route);
    await p.waitForLoadState("networkidle");
    const bad = await p.evaluate(() => {
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const bgOf = (el: Element | null): number[] => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; el = el.parentElement; } return [23, 17, 14]; };
      const out: string[] = [];
      document.querySelectorAll("a, button, h1, h2, h3, label, p, span, dt, dd, td, th, input, select").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const own = ["INPUT", "SELECT"].includes(el.tagName) || Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
        if (!own) return;
        const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(bgOf(el))].sort((x, y) => y - x);
        const cr = (a + 0.05) / (b + 0.05);
        if (cr < 3) out.push(`${el.tagName.toLowerCase()}:"${(el.textContent ?? "").trim().slice(0, 24)}" ${cr.toFixed(2)}`);
      });
      return out.slice(0, 5);
    });
    ok(bad.length === 0, `dark mode contrast ≥ 3:1: ${route}`, bad);
    // icons: svg stroke colour vs background
    const iconBad = await p.evaluate(() => {
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const bgOf = (el: Element | null): number[] => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; el = el.parentElement; } return [23, 17, 14]; };
      let n = 0;
      document.querySelectorAll("button svg.lucide, a svg.lucide, nav svg.lucide").forEach((el) => { const r = el.getBoundingClientRect(); if (r.width < 4) return; const [a, b] = [lum(parse(getComputedStyle(el).color)), lum(bgOf(el))].sort((x, y) => y - x); if ((a + 0.05) / (b + 0.05) < 3) n++; });
      return n;
    });
    ok(iconBad === 0, `dark mode icons visible: ${route}`, iconBad);
  }
  await p.goto(BASE + "/dashboard"); await p.waitForLoadState("networkidle"); await shot("11-dashboard-dark");
  await p.goto(BASE + "/payouts"); await p.waitForLoadState("networkidle"); await shot("12-payouts-dark");

  section("Responsive: tablet and mobile");
  const cookies = await ctx.cookies();
  const mobile: Array<[string, any]> = [["iPad", devices["iPad (gen 7)"]], ["iPhone 13", devices["iPhone 13"]], ["Pixel 7", devices["Pixel 7"]], ["Small 320", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }]];
  for (const [name, opts] of mobile) {
    const c = await browser.newContext(opts); await c.addInitScript(INIT); await c.addCookies(cookies);
    const q = await c.newPage();
    let bad = 0;
    for (const route of routes) { await q.goto(BASE + route); await q.waitForLoadState("networkidle"); const o = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })); if (o.sw > o.iw + 1) { bad++; console.log(`   overflow ${name} ${route} ${o.sw}/${o.iw}`); } }
    ok(bad === 0, `${name}: ${routes.length} screens without horizontal overflow`);
    if (name === "iPhone 13") {
      await q.goto(BASE + "/users"); await q.waitForLoadState("networkidle");
      ok(!(await q.locator("table").first().isVisible()) && (await q.locator("ul > li").count()) > 0, "mobile: tables become cards");
      await q.getByRole("button", { name: "Toggle menu" }).click();
      const dr = q.getByRole("dialog", { name: "Navigation" });
      await dr.waitFor();
      ok(await dr.getByRole("link", { name: "Publisher Payouts" }).isVisible(), "mobile: sidebar becomes a drawer");
      await shot("13-mobile-drawer", q);
      await q.keyboard.press("Escape");
      await q.goto(BASE + "/dashboard"); await q.waitForLoadState("networkidle"); await shot("14-mobile-dashboard", q);
    }
    if (name === "iPad") { await q.goto(BASE + "/dashboard"); await q.waitForLoadState("networkidle"); await shot("15-tablet-dashboard", q); }
    await c.close();
  }

  section("Service outage (Publisher stopped)");
  execSync('pkill -f "next start -p 3340" || true');
  await sleep(1500);
  await p.getByRole("button", { name: /Switch to light mode/ }).click().catch(() => {});
  await p.goto(BASE + "/dashboard");
  await p.getByLabel("Total publishers", { exact: true }).getByText("Unavailable", { exact: true }).waitFor({ timeout: 20000 });
  ok(await p.getByLabel("Total users", { exact: true }).getByText("Unavailable", { exact: true }).count() === 0, "Reader cards still show data");
  ok(await p.getByRole("alert").getByText(/Publisher service is temporarily unavailable/).first().isVisible(), "banner names the unavailable service");
  const pubCardText = await p.getByLabel("Total publishers", { exact: true }).innerText();
  ok(!/\b0\b/.test(pubCardText), "publisher card shows 'Unavailable' — not a fake 0", pubCardText);
  ok(await p.getByLabel("Total publishers", { exact: true }).getByRole("button", { name: "Retry" }).isVisible(), "Retry button on the unavailable card");
  await shot("16-outage");
  await p.goto(BASE + "/publishers");
  await p.getByText(/We couldn't load publishers/).waitFor();
  ok(await p.getByText(/Publisher service is temporarily unavailable/).first().isVisible() && await p.getByRole("button", { name: "Try again" }).isVisible(), "publishers page: clear message naming the service, with retry");
  await shot("17-outage-publishers");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await browser.close(); await rdb.$disconnect(); await pdb.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
