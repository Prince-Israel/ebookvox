import nodemailer from "nodemailer";
import { db } from "./db";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3240";

export async function sendEmail(to: string, subject: string, html: string) {
  const log = await db.emailLog.create({ data: { toEmail: to, subject, body: html } });
  if (!process.env.SMTP_HOST) return void console.log(`[email:not-sent-no-SMTP] to=${to} subject="${subject}"`);
  try {
    const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    await t.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
    await db.emailLog.update({ where: { id: log.id }, data: { sent: true } });
  } catch (e) {
    await db.emailLog.update({ where: { id: log.id }, data: { error: String((e as Error).message).slice(0, 300) } });
  }
}

const shell = (title: string, body: string, cta: string, href: string) => `
<div style="font-family:Georgia,serif;background:#faf3ea;padding:32px"><div style="max-width:480px;margin:auto;background:#fff;border-radius:20px;padding:32px;color:#2b2420">
<h1 style="margin:0 0 4px;color:#5a3e2b">Ebookvox <span style="color:#d9824f">Publisher</span></h1><h2 style="font-weight:600">${title}</h2>
<p style="font-family:Arial,sans-serif;line-height:1.6">${body}</p>
<p><a href="${href}" style="display:inline-block;background:#6b4a35;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-family:Arial,sans-serif">${cta}</a></p>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#8a7a6e">Or paste this link into your browser:<br>${href}</p></div></div>`;

export const sendVerificationEmail = (to: string, name: string, token: string) =>
  sendEmail(to, "Verify your Ebookvox Publisher email", shell(`Welcome, ${name}`, "Confirm your email address to start uploading and selling books. This link is valid for 24 hours.", "Verify email", `${appUrl()}/verify-email?token=${token}`));
export const sendResetEmail = (to: string, name: string, token: string) =>
  sendEmail(to, "Reset your Ebookvox Publisher password", shell(`Hi ${name}`, "We received a request to reset your password. This link is valid for 1 hour. If this wasn't you, ignore this email.", "Reset password", `${appUrl()}/reset-password?token=${token}`));
