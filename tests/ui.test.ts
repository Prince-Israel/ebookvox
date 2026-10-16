import { chromium, devices, type Page, type BrowserContext } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS ?? "/tmp/ev-shots";
const TMP = path.join(SHOTS, "fixtures");
mkdirSync(TMP, { recursive: true });
const db = new PrismaClient();
let pass = 0;
const failures: string[] = [];
const ok = (c: unknown, n: string, d?: unknown) => { if (c) { pass++; console.log("  ✓", n); } else { failures.push(n); console.log("  ✗", n, d ?? ""); } };
const section = (s: string) => console.log(`\n${s}`);
const stamp = Date.now().toString(36);
const email = `ui.${stamp}@example.com`;
const pw = "Sup3rSecret!";

// Record every Audio element so tests can inspect playback state.
const INIT = `(() => { window.__name = (f) => f; window.__audios = []; window.__cur = null; const A = window.Audio; window.Audio = function(...a){ const el = new A(...a); window.__audios.push(el); el.addEventListener('play', () => { if (!el.src.startsWith('data:')) window.__cur = el; }); return el; }; window.Audio.prototype = A.prototype; })();`;
const audioState = (p: Page) => p.evaluate(() => { const a = (window as any).__cur as HTMLAudioElement | null; return a ? { paused: a.paused, t: a.currentTime, rate: a.playbackRate, src: a.src, vol: a.volume, dur: a.duration } : null; });

async function overflow(p: Page, label: string) {
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(o.sw <= o.iw + 1, `no horizontal overflow: ${label} (${o.sw}/${o.iw})`);
}

function lum(rgb: number[]) { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const parseRgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);

async function main() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const phone: BrowserContext = await browser.newContext({ ...devices["iPhone 13"], permissions: [] });
  await phone.addInitScript(INIT);
  const p = await phone.newPage();
  p.on("pageerror", (e) => console.log("   [pageerror]", e.message));
  const shot = (name: string) => p.screenshot({ path: `${SHOTS}/${name}.png` });

  // ------------------------------------------------------------ splash + onboarding
  section("Web: no onboarding, visitors land on the home page");
  const webCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const wp = await webCtx.newPage();
  await wp.goto(BASE + "/");
  await wp.waitForURL("**/home");
  ok(await wp.getByRole("heading", { name: "Welcome to Ebookvox" }).isVisible(), "web visitors go straight to the home page (no splash / onboarding)");
  ok(await wp.getByRole("heading", { name: /Trending books|New books/ }).isVisible(), "trending / new books carousel sits right after the Read Aloud card");
  await wp.locator("#ra-text").fill("A visitor types some text.");
  await wp.getByRole("button", { name: "Read Aloud", exact: true }).click();
  await wp.getByText("Create a free account to continue").waitFor();
  ok(true, "Read Aloud asks a visitor to register or sign in");
  await wp.keyboard.press("Escape");
  await wp.goto(BASE + "/books");
  await wp.getByRole("heading", { name: "FREE BOOKS" }).waitFor();
  ok(await wp.getByRole("heading", { name: "PAID BOOKS" }).isVisible(), "visitors see all books (free and paid)");
  await wp.getByRole("button", { name: /Read Now|Purchase/ }).first().click();
  await wp.getByText("Create a free account to continue").waitFor();
  ok(true, "Read / Purchase asks a visitor to register or sign in");
  await wp.goto(BASE + "/library");
  await wp.waitForURL(/sign-in/);
  ok(true, "private screens redirect visitors to sign in");
  await webCtx.close();

  section("Native app: splash & onboarding (iPhone 13 + Capacitor)");
  await phone.addInitScript("window.Capacitor = { isNativePlatform: () => true };");
  await p.goto(BASE + "/");
  ok(await p.getByText("Your Words. Our Voice.").first().isVisible(), "splash shows brand + tagline");
  await shot("01-splash");
  await p.getByText("Read with your eyes.").waitFor({ timeout: 6000 });
  ok(true, "splash transitions to onboarding automatically");
  const titles = ["Read with your eyes.", "Listen with your ears.", "Discover books.", "Give your words a voice."];
  for (let i = 0; i < 4; i++) {
    ok(await p.getByRole("heading", { name: titles[i] }).isVisible(), `onboarding screen ${i + 1}: "${titles[i]}"`);
    if (i === 0) await shot("02-onboarding");
    if (i < 3) await p.getByRole("button", { name: /^Next/ }).click();
  }
  await shot("03-onboarding-last");
  ok(await p.getByRole("link", { name: "Create Account" }).isVisible() && await p.getByRole("link", { name: "Sign In" }).isVisible(), "final screen has Create Account + Sign In");
  ok(!(await p.content()).toLowerCase().includes("guest"), "no Guest button in the app onboarding");
  await overflow(p, "onboarding");
  await p.getByRole("tab", { name: "Go to step 1" }).click();
  ok(await p.getByRole("heading", { name: titles[0] }).isVisible(), "onboarding dots navigate back");

  // ------------------------------------------------------------ sign up
  section("Sign up form");
  await p.goto(BASE + "/sign-up");
  await shot("04-signup");
  ok((await p.getByRole("link", { name: /Download the Ebookvox Android app/ }).count()) === 0, "inside the mobile app there are no store badges (you already have the app)");
  const google = p.getByRole("link", { name: /with Google/ }), apple = p.getByRole("link", { name: /with Apple/ });
  const gb = await google.boundingBox(), ab = await apple.boundingBox();
  ok(gb && ab && gb.height >= 52 && ab.height >= 52 && gb.width > 250, `Google/Apple buttons large (${gb?.height}px high)`);
  await p.locator("#su-first").fill("Ada");
  await p.locator("#su-last").fill("Okafor");
  await p.locator("#su-email").fill(email);
  await p.locator("#su-phone").fill("");
  await p.locator("#su-phone").pressSequentially("abc80-12 34x5678@y");
  ok((await p.locator("#su-phone").inputValue()) === "8012345678", "phone input keeps digits only", await p.locator("#su-phone").inputValue());
  await p.locator("#su-country").selectOption("NG");
  ok((await p.locator("#su-dial").inputValue()) === "NG", "dialing code follows country (+234)");
  await p.locator("#su-country").selectOption("GB");
  ok((await p.locator("#su-dial").inputValue()) === "GB", "dialing code switches to +44 for UK");
  await p.locator("#su-country").selectOption("NG");
  await p.locator("#su-password").fill(pw);
  await p.locator("#su-confirm").fill(pw);
  ok((await p.locator("#su-phone").inputValue()) === "8012345678" && (await p.locator("#su-password").inputValue()) === pw, "phone and password fields keep independent state");
  await p.getByRole("button", { name: "Create Account" }).click();
  await p.waitForURL("**/home", { timeout: 15000 });
  ok(await p.getByRole("heading", { name: "Welcome back, Ada" }).isVisible(), "lands on dashboard: Welcome back, Ada");
  const dbu = await db.user.findUnique({ where: { email } });
  ok(dbu?.phone === "+2348012345678" && dbu.currency === "NGN", "phone saved as +2348012345678, currency NGN");
  await shot("05-home");
  const promo = p.getByRole("link", { name: /Publish your books/ }).first();
  ok(/\/sign-up$/.test((await promo.getAttribute("href")) ?? "") && (await promo.getAttribute("target")) === "_blank", "Home invites authors & publishers to publish — the button opens the Publisher site's registration page");
  ok(await p.getByRole("heading", { name: "Are you an author or publisher?" }).isVisible(), "the author/publisher banner is shown on Home");
  ok((await p.getByRole("heading", { name: "Take Ebookvox with you" }).count()) === 0, "the Get-the-app section is hidden inside the app");
  ok((await p.locator("ins.adsbygoogle").count()) === 0, "no ad slots render until AdSense is configured");
  await overflow(p, "home");

  // ------------------------------------------------------------ read aloud: text
  section("Read Aloud — text");
  await p.getByRole("tab", { name: "TEXT" }).click();
  const readBtn = p.getByRole("button", { name: "Read Aloud", exact: true });
  ok(await readBtn.isDisabled(), "Read Aloud disabled while empty");
  const para = (n: number) => `Paragraph number ${n} is here to give the player plenty to say. It has a few sentences so that the audio lasts long enough for every control to be exercised properly, one after another.`;
  await p.locator("#ra-text").fill(["Chapter heading", ...Array.from({ length: 8 }, (_, i) => para(i + 1))].join("\n\n"));
  await readBtn.click();
  // On a phone the controls live in the mini player; its "Open full player" button shows the whole player in a sheet.
  await p.getByRole("button", { name: /Open full player/ }).first().click();
  await p.getByRole("region", { name: "Audio player" }).first().waitFor();
  await p.waitForFunction(() => { const a = (window as any).__cur; return a && !a.paused && a.currentTime > 0.3 && !a.src.startsWith("data:"); }, null, { timeout: 40000 });
  ok(true, "text is spoken (audio playing, currentTime advancing)");
  ok(await p.getByText("Paragraph number 1 is here").first().isVisible(), "text displayed with paragraphs preserved");
  await shot("06-player");
  await overflow(p, "home + player");
  // speed
  const speedBtns = p.getByRole("group", { name: "Playback speed" }).getByRole("button");
  ok((await speedBtns.count()) === 6 && (await speedBtns.evaluateAll((els) => els.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 20; }))), "all six speeds are always visible on screen (changing speed never hides 1x)");
  await p.getByRole("button", { name: "1.5x speed" }).click();
  ok((await audioState(p))?.rate === 1.5, "speed 1.5x actually changes playbackRate");
  ok(await p.getByRole("button", { name: "1x speed" }).isVisible(), "after choosing 1.5x, 1x is still visible and can be chosen again");
  for (const s of ["0.5", "0.75", "1.25", "2", "1"]) {
    await p.getByRole("button", { name: `${s}x speed` }).click();
    if ((await audioState(p))?.rate !== Number(s)) ok(false, `speed ${s}x`);
  }
  ok((await audioState(p))?.rate === 1, "all six speeds apply");
  const sh = p.getByRole("dialog", { name: "Player" });
  // pause / play
  await sh.getByRole("button", { name: "Pause", exact: true }).first().click();
  ok((await audioState(p))?.paused === true, "pause works");
  await sh.getByRole("button", { name: "Play", exact: true }).first().click();
  try { await p.waitForFunction(() => (window as any).__cur?.paused === false, null, { timeout: 15000 }); ok(true, "play resumes"); }
  catch { ok(false, "play resumes", JSON.stringify(await audioState(p)) + " | " + (await sh.getByRole("region", { name: "Audio player" }).first().innerText()).replace(/\n/g, " / ")); }
  // seek
  const before = await audioState(p);
  await sh.getByRole("slider", { name: "Seek" }).fill("1");
  await p.waitForTimeout(400);
  ok(true, "seek slider accepts input");
  // next / prev
  const passageNo = async () => Number((await sh.getByRole("region", { name: "Audio player" }).first().innerText()).match(/passage (\d+) of/)?.[1] ?? 0);
  await p.waitForFunction(() => /passage \d+ of/.test(document.body.innerText), null, { timeout: 30000 });
  const n0 = await passageNo();
  await sh.getByRole("button", { name: "Next passage" }).first().click();
  await p.waitForFunction((n) => document.body.innerText.includes(`passage ${n} of`), n0 + 1, { timeout: 30000 });
  ok(true, `Next moves from passage ${n0} to ${n0 + 1}`);
  await sh.getByRole("button", { name: "Previous passage" }).first().click();
  await p.waitForFunction((n) => document.body.innerText.includes(`passage ${n} of`), n0, { timeout: 30000 });
  ok(true, "Previous moves back");
  // volume + repeat
  await sh.getByRole("slider", { name: "Volume" }).last().fill("0.4");
  ok(Math.abs(((await audioState(p))?.vol ?? 1) - 0.4) < 0.01, "volume slider sets volume");
  await sh.getByRole("button", { name: /Repeat: off/ }).click();
  ok(await sh.getByRole("button", { name: /Repeat: all/ }).isVisible(), "repeat toggles");
  // voices
  const src1 = (await audioState(p))!.src;
  await sh.getByRole("button", { name: /Change voice/ }).first().click();
  await p.getByRole("dialog", { name: "Choose a voice" }).waitFor();
  const voiceCards = await p.getByRole("dialog", { name: "Choose a voice" }).locator("li").count();
  ok(voiceCards >= 30, `voice picker lists ${voiceCards} voices`);
  await shot("07-voices");
  ok(await p.getByRole("dialog", { name: "Choose a voice" }).getByText("Nigerian English").first().isVisible() && await p.getByRole("dialog", { name: "Choose a voice" }).getByText("British English").first().isVisible(), "voices show accent labels");
  await p.getByRole("button", { name: "Preview voice Ryan" }).click();
  await p.waitForFunction(() => (window as any).__audios.some((a: HTMLAudioElement, i: number) => i > 0 && !a.paused && a.src.startsWith("blob:")), null, { timeout: 30000 });
  ok(true, "voice preview plays");
  await p.getByRole("dialog", { name: "Choose a voice" }).getByRole("button", { name: "Use voice" }).nth(3).click();
  await p.waitForFunction((s) => { const a = (window as any).__cur; return a && a.src !== s && !a.paused && a.src.startsWith("blob:"); }, src1, { timeout: 40000 });
  const src2 = (await audioState(p))!.src;
  ok(src2 !== src1, "selecting another voice regenerates the audio (different source)");
  await p.keyboard.press("Escape");
  await p.keyboard.press("Escape"); // close the player sheet too

  // ---- playback survives navigation (the player lives above the pages) ----
  await p.getByRole("button", { name: "Play", exact: true }).first().click().catch(() => {});
  await p.waitForFunction(() => (window as any).__cur?.paused === false, null, { timeout: 20000 });
  const tBefore = (await audioState(p))!.t;
  await p.getByRole("link", { name: "Books", exact: true }).last().click();
  await p.getByRole("heading", { name: "FREE BOOKS" }).waitFor();
  const t1 = (await audioState(p))!;
  await p.waitForTimeout(1500);
  const st = await audioState(p);
  ok(st?.paused === false && (st.t > t1.t || st.src !== t1.src), "audio keeps playing after moving to Books", { tBefore, t1, st });
  ok(await p.getByRole("button", { name: "Stop and close player" }).isVisible(), "a mini player follows the listener to other pages");
  await p.getByRole("link", { name: "Profile", exact: true }).last().click();
  await p.getByRole("heading", { name: "Profile" }).first().waitFor();
  ok((await audioState(p))?.paused === false, "still playing on Profile");
  await shot("07b-miniplayer-elsewhere");
  await p.getByRole("button", { name: "Pause", exact: true }).first().click();
  ok((await audioState(p))?.paused === true, "pausing from the mini player works anywhere");
  await p.getByRole("link", { name: "Home", exact: true }).last().click();
  await p.getByRole("tab", { name: "UPLOAD" }).waitFor();

  // ------------------------------------------------------------ uploads
  section("Read Aloud — upload (TXT / DOCX / PDF)");
  const txt = path.join(TMP, "story.txt"); writeFileSync(txt, "The Lighthouse\n\nThe keeper climbed the stairs each evening.\n\nThe sea was calm.");
  const dx = path.join(TMP, "memo.docx"); writeFileSync(dx, await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ text: "Memo Title", heading: HeadingLevel.HEADING_1 }), new Paragraph("This memo comes from a Word document."), new Paragraph("Another paragraph in Word.")] }] })));
  const pd = await PDFDocument.create(); const f = await pd.embedFont(StandardFonts.Helvetica); const pg = pd.addPage([595, 842]);
  pg.drawText("PDF paragraph one lives here.", { x: 50, y: 760, size: 12, font: f }); pg.drawText("PDF paragraph two follows later.", { x: 50, y: 700, size: 12, font: f });
  const pdf = path.join(TMP, "paper.pdf"); writeFileSync(pdf, await pd.save());
  const bad = path.join(TMP, "broken.pdf"); writeFileSync(bad, "not really a pdf");
  await p.getByRole("tab", { name: "UPLOAD" }).click();
  const input = p.locator("#ra-file");
  ok(((await input.getAttribute("accept")) ?? "").includes(".pdf") && ((await input.getAttribute("accept")) ?? "").includes(".docx"), "file input accepts pdf/docx/txt (works with iOS/Android pickers)");
  for (const [file, expect] of [[txt, "keeper climbed the stairs"], [dx, "memo comes from a Word document"], [pdf, "PDF paragraph one lives here"]] as const) {
    await input.setInputFiles(file);
    await p.getByText(expect).first().waitFor({ timeout: 30000 });
    await p.waitForFunction(() => /(Paused|Reading) · [\d.]+x/.test(document.body.innerText), null, { timeout: 40000 });
    ok(true, `${path.extname(file).toUpperCase()} → text extracted, audio prepared`);
    await p.getByRole("button", { name: "Play", exact: true }).first().click();
    await p.waitForFunction(() => { const a = (window as any).__cur; return a && !a.paused && !a.src.startsWith("data:"); }, null, { timeout: 30000 });
    ok(true, `${path.extname(file).toUpperCase()} plays immediately`);
    await p.getByRole("button", { name: "Pause", exact: true }).first().click();
  }
  await shot("08-upload");
  await input.setInputFiles(bad);
  await p.getByRole("alert").filter({ hasText: /couldn't|PDF/i }).first().waitFor({ timeout: 15000 });
  ok(await p.getByRole("button", { name: "Try again" }).first().isVisible(), "bad file shows a clear error with retry");
  await overflow(p, "home + upload");

  // ------------------------------------------------------------ books
  section("Books");
  await p.getByRole("link", { name: "Books", exact: true }).last().click();
  await p.getByRole("heading", { name: "FREE BOOKS" }).waitFor();
  ok(await p.getByRole("heading", { name: "PAID BOOKS" }).isVisible(), "Books page has FREE BOOKS and PAID BOOKS");
  ok((await p.getByText("FREE", { exact: true }).count()) >= 5, "free books labelled FREE");
  ok((await p.getByText(/₦[\d,]+ NGN/).count()) >= 4, "paid books show ₦ price with NGN currency");
  await shot("09-books");
  await overflow(p, "books");
  await p.getByRole("link", { name: /^Dracula/ }).first().click();
  await p.getByRole("heading", { name: "Dracula" }).waitFor();
  ok(await p.getByRole("button", { name: /Buy Book/ }).isVisible() && await p.getByText("Publisher:").isVisible(), "paid detail: Buy Book, publisher, price");
  await shot("10-book-detail");
  await p.getByRole("button", { name: /Buy Book/ }).click();
  await p.getByRole("heading", { name: "Checkout" }).waitFor();
  await p.locator("dd", { hasText: "Ada Okafor" }).waitFor();
  ok(await p.locator("dd", { hasText: "Ada Okafor" }).isVisible() && await p.locator("dd", { hasText: email }).isVisible() && await p.locator("dd", { hasText: "+2348012345678" }).isVisible(), "checkout shows user info");
  ok(await p.getByRole("button", { name: /Proceed to Secure Payment/ }).isDisabled(), "payment blocked until email verified");
  await shot("11-checkout");
  await db.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  await p.reload();
  const proceed = p.getByRole("button", { name: /Proceed to Secure Payment/ });
  await proceed.waitFor();
  ok(await proceed.isEnabled(), "payment enabled after verification");
  const nav = p.waitForURL(/localhost:4010\/pay\//, { timeout: 15000 }).catch(() => null);
  await proceed.click();
  await nav;
  ok(p.url().startsWith("http://localhost:4010/pay/"), "redirected to Paystack authorization URL");
  const ref = p.url().split("/pay/")[1];
  await fetch(`http://localhost:4010/__set/${ref}/success`);
  await p.goto(`${BASE}/payment/callback?reference=${ref}&trxref=${ref}`);
  await p.getByRole("heading", { name: "Payment successful" }).waitFor({ timeout: 20000 });
  ok(true, "returning from Paystack: server verifies → Payment successful");
  await shot("12-payment-success");
  await p.getByRole("link", { name: "Start reading" }).click();
  await p.getByRole("heading", { name: "Dracula" }).waitFor();
  ok(await p.getByText("JONATHAN HARKER", { exact: false }).first().isVisible(), "purchased book opens inside the app");

  // ------------------------------------------------------------ reading
  section("Reading experience & progress");
  await p.getByRole("button", { name: "Next chapter" }).click();
  await p.getByText("2 / 27").waitFor();
  await p.getByRole("button", { name: "Play", exact: true }).first().click().catch(async () => { await p.getByRole("button", { name: "Open full player" }).click(); });
  await p.waitForFunction(() => { const a = (window as any).__cur; return a && !a.paused && !a.src.startsWith("data:") && a.currentTime > 0.5; }, null, { timeout: 40000 });
  ok(true, "book chapter is read aloud");
  await shot("13-reader");
  await overflow(p, "reader");
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Pause", exact: true }).first().click();
  await p.waitForTimeout(800);
  const ub = await db.userBook.findFirst({ where: { user: { email }, book: { title: "Dracula" } } });
  ok(ub && ub.chapterIndex === 1 && ub.percent > 0 && ub.lastOpenedAt, "progress saved to DB (chapter, percent, last opened)", ub);
  await p.goto(BASE + "/library");
  await p.getByRole("heading", { name: "Purchased Books" }).waitFor();
  ok(await p.getByRole("link", { name: "Continue" }).first().isVisible(), "library: Continue button on in-progress book");
  ok(await p.getByRole("heading", { name: "Currently Reading" }).isVisible() && await p.getByRole("heading", { name: "Recently Read" }).isVisible(), "library sections present");
  await shot("14-library");
  await p.getByRole("link", { name: "Continue" }).first().click();
  await p.getByText("2 / 27").waitFor();
  ok(true, "Continue Reading resumes at saved chapter");

  // ------------------------------------------------------------ orders / support / notifications / profile / settings
  section("Orders, support, notifications, profile, settings");
  await p.goto(BASE + "/orders");
  await p.getByText("Payment reference").first().waitFor();
  ok(await p.getByText("Paid", { exact: true }).first().isVisible() && await p.getByText("NGN").first().isVisible(), "orders page shows status + currency + reference");
  await shot("15-orders");
  await p.goto(BASE + "/support");
  await p.getByRole("button", { name: /New ticket/ }).first().click();
  await p.locator("#t-subject").fill("Voice question");
  await p.locator("#t-message").fill("Can I get more Nigerian voices?");
  // --- on-screen keyboard: simulate it by shrinking the viewport (what Android does) and check the field being typed in stays visible
  const fullVp = p.viewportSize()!;
  await p.locator("#t-message").focus();
  await p.setViewportSize({ width: fullVp.width, height: Math.round(fullVp.height * 0.52) });
  await p.waitForTimeout(900);
  const kb = await p.evaluate(() => { const r = document.querySelector("#t-message")!.getBoundingClientRect(); const nav = document.querySelector("nav[data-hide-on-kb]") as HTMLElement | null; return { open: document.documentElement.dataset.kb, top: r.top, bottom: r.bottom, vh: window.innerHeight, navHidden: !nav || getComputedStyle(nav).display === "none" }; });
  ok(kb.open === "open" && kb.top >= 0 && kb.bottom <= kb.vh + 1 && kb.navHidden, "with the keyboard up, the field being typed in is fully visible and the bottom bar steps aside", kb);
  await p.setViewportSize(fullVp);
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Submit ticket" }).click();
  await p.waitForURL(/\/support\/.+/);
  await p.getByText("Can I get more Nigerian voices?").first().waitFor();
  ok(await p.getByText("Open", { exact: true }).first().isVisible(), "ticket created with status Open");
  const tk = await db.ticket.findFirst({ where: { user: { email } } });
  await db.ticketMessage.create({ data: { ticketId: tk!.id, authorId: "admin", authorRole: "ADMIN", body: "Thanks Ada — more voices are coming soon!" } });
  await db.ticket.update({ where: { id: tk!.id }, data: { status: "WAITING_USER" } });
  await p.reload();
  await p.getByText("more voices are coming soon").waitFor();
  ok(await p.getByText("Waiting for User").first().isVisible(), "admin reply appears in conversation (Waiting for User)");
  await shot("16-support");
  await p.locator("#reply").fill("Great, thank you!");
  await p.getByRole("button", { name: "Send reply" }).click();
  await p.getByText("Great, thank you!").first().waitFor();
  ok(true, "user can reply");
  await p.waitForLoadState("networkidle");
  // photo in the chat
  const shotPng = await sharp({ create: { width: 480, height: 320, channels: 3, background: "#e9c46a" } }).png().toBuffer();
  await p.locator('input[type=file][aria-label="Attach photos"]').setInputFiles({ name: "problem.png", mimeType: "image/png", buffer: shotPng });
  await p.getByRole("button", { name: "Remove problem.png" }).waitFor();
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Send reply/.test(b.textContent ?? "") && !b.disabled), null, { timeout: 15000 });
  await p.getByRole("button", { name: "Send reply" }).click();
  await p.locator('img[alt="problem.jpg"]').first().waitFor({ timeout: 20000 });
  ok(await p.locator('img[alt="problem.jpg"]').first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 100), "a photo sent in the support chat appears in the conversation");
  await p.locator('img[alt="problem.jpg"]').first().click();
  ok(await p.getByRole("dialog", { name: "Photo" }).isVisible(), "tapping a photo opens it full screen");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(1000); // let the reply request settle before closing the ticket behind it
  await db.ticket.update({ where: { id: tk!.id }, data: { status: "CLOSED" } });
  await p.reload();
  await p.getByText(/ticket is closed/i).first().waitFor();
  ok((await p.locator("#reply").count()) === 0 && await p.getByText("Closed", { exact: true }).first().isVisible(), "closed ticket: status Closed, reply box removed");
  await p.goto(BASE + "/home");
  const bell = p.getByRole("link", { name: /Notifications, \d+ unread/ });
  await bell.first().waitFor();
  ok(true, "unread count badge shown: " + (await bell.first().getAttribute("aria-label")));
  await bell.first().click();
  await p.getByRole("heading", { name: "Notifications" }).waitFor();
  await p.getByText("Payment successful").first().click();
  await p.waitForURL("**/orders");
  await p.goto(BASE + "/notifications");
  await p.getByRole("button", { name: /Mark all read/ }).click();
  await p.getByText("You're all caught up").waitFor();
  ok(await p.getByRole("link", { name: "Notifications" }).first().isVisible(), "mark all read clears unread count");
  await shot("17-notifications");

  await p.goto(BASE + "/profile");
  ok(await p.getByRole("link", { name: /Publish your books/ }).first().isVisible(), "Profile also links to publishing");
  ok(/site build \d{4}-\d{2}-\d{2}/.test(await p.locator("body").innerText()), "Profile shows which build you are running");
  const photo = path.join(TMP, "me.png"); writeFileSync(photo, await sharp({ create: { width: 800, height: 600, channels: 3, background: "#d98e62" } }).png().toBuffer());
  await p.locator("#avatar-file").setInputFiles(photo);
  await p.getByRole("img", { name: /profile photo/ }).first().waitFor({ timeout: 15000 });
  const loaded = await p.getByRole("img", { name: /profile photo/ }).first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
  ok(loaded, "profile photo uploaded and displayed immediately");
  ok(await p.getByRole("button", { name: "Replace profile photo" }).isVisible(), "photo can be replaced");
  await shot("18-profile");
  await overflow(p, "profile");

  await p.goto(BASE + "/settings");
  await p.getByRole("button", { name: "Dark", exact: true }).click();
  await p.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  ok(true, "dark mode applies");
  await shot("19-settings-dark");
  await overflow(p, "settings (dark)");

  // ------------------------------------------------------------ dark mode contrast on every main screen
  section("Dark mode contrast");
  for (const route of ["/home", "/books", "/library", "/profile", "/orders", "/support", "/notifications", "/settings"]) {
    await p.goto(BASE + route);
    await p.waitForLoadState("networkidle");
    const bad = await p.evaluate(() => {
      const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
      const bgOf = (el: Element | null): number[] => { while (el) { const c = parse(getComputedStyle(el).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c; el = el.parentElement; } return [23, 17, 14]; };
      const out: string[] = [];
      document.querySelectorAll("a, button, h1, h2, h3, label, p, span, svg").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || getComputedStyle(el).visibility === "hidden") return;
        const own = el.tagName === "svg" ? true : Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1);
        if (!own) return;
        const cs = getComputedStyle(el);
        const fg = parse(el.tagName === "svg" ? cs.color : cs.color);
        const bg = bgOf(el);
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        const cr = (a + 0.05) / (b + 0.05);
        if (cr < 3) out.push(`${el.tagName.toLowerCase()}:"${(el.textContent ?? "").trim().slice(0, 24)}" ${cr.toFixed(2)}`);
      });
      return out.slice(0, 5);
    });
    ok(bad.length === 0, `contrast ≥ 3:1 for all visible text/icons in dark mode: ${route}`, bad);
  }
  await p.goto(BASE + "/books"); await p.waitForLoadState("networkidle"); await shot("20-books-dark");
  await p.goto(BASE + "/home"); await p.waitForLoadState("networkidle"); await shot("21-home-dark");
  const nav2 = await p.locator("nav[aria-label=Main] a").first().evaluate((a) => ({ c: getComputedStyle(a).color, b: getComputedStyle(a.closest("nav")!).backgroundColor }));
  ok(ratio(parseRgb(nav2.c), parseRgb(nav2.b)) >= 3, "bottom navigation labels visible in dark mode", nav2);

  // ------------------------------------------------------------ logout
  section("Logout");
  await p.goto(BASE + "/profile");
  await p.getByRole("button", { name: "Sign out" }).click();
  await p.waitForURL("**/sign-in");
  await p.goto(BASE + "/library");
  await p.waitForURL("**/sign-in**");
  ok(p.url().includes("/sign-in"), "after logout private pages are inaccessible");
  await p.locator("#signin-email").fill(email);
  await p.locator("#signin-password").fill(pw);
  await p.getByRole("button", { name: "Sign In" }).click();
  await p.waitForURL("**/library");
  ok(true, "sign in through the UI returns to the page that was requested");

  // ------------------------------------------------------------ responsive sweep
  section("Website only: store badges, publisher invitation, Google/Apple buttons");
  {
    const wc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const w = await wc.newPage();
    await w.goto(BASE + "/home");
    const heading = w.getByRole("heading", { name: "Take Ebookvox with you" });
    await heading.scrollIntoViewIfNeeded();
    const apk = w.getByRole("link", { name: /Download the Ebookvox Android app/ }).first();
    ok(await heading.isVisible() && await apk.isVisible() && /Ebookvox-Reader-android\.apk$/.test((await apk.getAttribute("href")) ?? ""), "the website offers the Android app (APK until the Play Store listing is set)");
    ok(await w.getByRole("img", { name: /App Store — coming soon/ }).first().isVisible(), "the App Store badge says “coming soon” until a listing exists");
    ok((await w.getByRole("link", { name: /Publish your books/ }).first().getAttribute("href"))?.endsWith("/sign-up") === true, "guests also see the author/publisher invitation");
    await w.goto(BASE + "/sign-in");
    await w.getByRole("link", { name: /Download the Ebookvox Android app/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
    ok(await w.getByRole("link", { name: /Download the Ebookvox Android app/ }).first().isVisible(), "the sign-in page shows the app badges");
    ok(((await w.getByRole("link", { name: /with Google/ }).getAttribute("href")) ?? "").startsWith("/api/auth/oauth/google/start"), "Continue with Google is a plain link on the website");
    await w.goto(BASE + "/sign-in?next=%2Flibrary");
    ok((await w.getByRole("link", { name: /with Apple/ }).getAttribute("href")) === "/api/auth/oauth/apple/start?next=%2Flibrary", "the destination survives the Apple sign-in round trip");
    await w.screenshot({ path: path.join(SHOTS, "web-badges.png") }).catch(() => {});
    await wc.close();
  }

  section("Responsive sweep (iPhone, Android, tablet, desktop)");
  const profiles: Array<[string, any]> = [["Pixel 7", devices["Pixel 7"]], ["iPad (gen 7)", devices["iPad (gen 7)"]], ["Desktop 1280", { viewport: { width: 1280, height: 800 } }], ["Small phone 320", { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true }]];
  const cookies = await phone.cookies();
  for (const [name, opts] of profiles) {
    const ctx = await browser.newContext(opts);
    await ctx.addCookies(cookies);
    const q = await ctx.newPage();
    for (const route of ["/home", "/books", "/library", "/profile", "/settings", "/orders", "/support", "/notifications", `/books/${(await db.book.findFirst({ where: { title: "Dracula" } }))!.id}`]) {
      await q.goto(BASE + route);
      await q.waitForLoadState("networkidle");
      const o = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) ok(false, `overflow on ${name} ${route} (${o.sw}/${o.iw})`);
    }
    await q.goto(BASE + "/home"); await q.waitForLoadState("networkidle");
    await q.screenshot({ path: `${SHOTS}/sweep-${name.replace(/\W+/g, "_")}.png` });
    ok(true, `${name}: 9 screens without horizontal overflow`);
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exitCode = 1; }
  await browser.close();
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
