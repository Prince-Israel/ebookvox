import { db } from "./db";
import { sendEmail } from "./email";

const base = () => (process.env.APP_URL ?? "http://localhost:3230").replace(/\/$/, "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const DAY = 86400_000;
export const DIGEST_SUBJECT_PREFIX = "Your Ebookvox reading update";

type Pick = { id: string; title: string; author: string; coverUrl: string | null };
const cover = (b: Pick) => (b.coverUrl ? (b.coverUrl.startsWith("http") ? b.coverUrl : `${base()}/api/books/${b.id}/cover`) : null);

function html(name: string, resume: (Pick & { percent: number }) | null, fresh: Pick[]) {
  const card = (b: Pick, note: string, href: string, cta: string) => `
    <table role="presentation" width="100%" style="margin:14px 0;border:1px solid #eadfce;border-radius:16px"><tr>
      <td width="84" style="padding:12px">${cover(b) ? `<img src="${cover(b)}" width="72" alt="" style="border-radius:8px;display:block">` : ""}</td>
      <td style="padding:12px 12px 12px 0;font-family:Arial,sans-serif">
        <div style="font:600 17px Georgia,serif;color:#2b2420">${esc(b.title)}</div>
        <div style="font-size:13px;color:#8a7a6e;margin:2px 0 8px">${esc(b.author)} · ${note}</div>
        <a href="${href}" style="display:inline-block;background:#6b4a35;color:#fff;padding:9px 18px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">${cta}</a>
      </td></tr></table>`;
  return `
<div style="font-family:Georgia,serif;background:#faf3ea;padding:28px">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;padding:28px;color:#2b2420">
    <h1 style="margin:0 0 6px;color:#5a3e2b">Ebookvox</h1>
    <p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 6px">Hi ${esc(name)}, ${resume ? "your book is waiting where you left it." : "here is what's new on Ebookvox."}</p>
    ${resume ? `<h2 style="font-size:16px;margin:18px 0 0">Continue where you stopped</h2>${card(resume, `${Math.round(resume.percent)}% done`, `${base()}/read/${resume.id}`, "Continue listening")}` : ""}
    ${fresh.length ? `<h2 style="font-size:16px;margin:18px 0 0">New books</h2>${fresh.map((b) => card(b, "new", `${base()}/books/${b.id}`, "Take a look")).join("")}` : ""}
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#8a7a6e;margin-top:22px">You get this because new-book updates are on for your account. <a href="${base()}/settings" style="color:#6b4a35">Turn them off in Settings</a>.</p>
  </div></div>`;
}

/**
 * Sends each reader a short "continue where you stopped" + "new books" email, at most one per week, never to someone who was active in the last
 * 3 days, and only when there is something to say. Run it weekly from a cron job (see POST /api/cron/digest). `dryRun` only reports who would get one.
 */
export async function runDigest({ dryRun = false, limit = 200, now = new Date() }: { dryRun?: boolean; limit?: number; now?: Date } = {}) {
  const weekAgo = new Date(+now - 6 * DAY), threeDays = new Date(+now - 3 * DAY), twoWeeks = new Date(+now - 14 * DAY);
  const recentlyMailed = new Set((await db.emailLog.findMany({ where: { subject: { startsWith: DIGEST_SUBJECT_PREFIX }, createdAt: { gt: weekAgo } }, select: { toEmail: true } })).map((r) => r.toEmail));
  const newest = await db.book.findMany({ where: { status: "APPROVED", createdAt: { gt: twoWeeks } }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, title: true, author: true, coverUrl: true } });
  const users = await db.user.findMany({
    where: { status: "ACTIVE", notifyBooks: true, emailVerifiedAt: { not: null } },
    select: { id: true, email: true, firstName: true, sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } }, library: { select: { bookId: true, percent: true, lastOpenedAt: true, completedAt: true, book: { select: { id: true, title: true, author: true, coverUrl: true } } } } },
  });
  let sent = 0, skipped = 0;
  for (const u of users) {
    if (sent >= limit) break;
    if (recentlyMailed.has(u.email)) { skipped++; continue; }
    const lastSeen = Math.max(u.sessions[0] ? +u.sessions[0].createdAt : 0, ...u.library.map((l) => (l.lastOpenedAt ? +l.lastOpenedAt : 0)));
    if (lastSeen > +threeDays) { skipped++; continue; }
    const owned = new Set(u.library.map((l) => l.bookId));
    const resumeRow = u.library.filter((l) => l.lastOpenedAt && !l.completedAt && l.percent > 0 && l.percent < 99).sort((a, b) => +b.lastOpenedAt! - +a.lastOpenedAt!)[0];
    const resume = resumeRow ? { ...resumeRow.book, percent: resumeRow.percent } : null;
    const fresh = newest.filter((b) => !owned.has(b.id)).slice(0, 3);
    if (!resume && !fresh.length) { skipped++; continue; }
    if (!dryRun) await sendEmail(u.email, `${DIGEST_SUBJECT_PREFIX}${resume ? ": pick up " + resume.title : ""}`, html(u.firstName, resume, fresh));
    sent++;
  }
  return { sent, skipped, dryRun };
}
