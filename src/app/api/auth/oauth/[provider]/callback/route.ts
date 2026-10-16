import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { completeOAuth, isConfigured, isProvider } from "@/lib/oauth";

async function handle(req: NextRequest, provider: string, p: URLSearchParams | FormData) {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const get = (k: string) => (p.get(k) ? String(p.get(k)) : undefined);
  if (!isProvider(provider) || !isConfigured(provider)) return NextResponse.redirect(new URL("/sign-in?error=oauth_unknown", base), 303);
  const state = get("state");
  const code = get("code");
  if (!state || !code) return NextResponse.redirect(new URL("/sign-in?error=oauth_cancelled", base), 303);
  try {
    const done = await completeOAuth(provider, {
      state,
      code,
      appleUser: get("user"),
      acceptLanguage: req.headers.get("accept-language"),
      ipCountry: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry"),
      userAgent: req.headers.get("user-agent"),
    });
    if (done.mobile) {
      // Back to the app through its custom URL scheme. The page also offers a tap-to-open button in case the browser doesn't hop automatically.
      const url = `ebookvox://oauth?code=${encodeURIComponent(done.code)}${done.next ? `&next=${encodeURIComponent(done.next)}` : ""}`;
      return new NextResponse(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signing you in…</title><body style="font-family:system-ui;text-align:center;padding:3rem 1.5rem"><h1 style="font-size:1.4rem">Signing you in…</h1><p>If the app doesn't open, tap the button.</p><p><a href="${url}" style="display:inline-block;background:#6b4a3a;color:#fff;padding:.9rem 1.6rem;border-radius:2rem;text-decoration:none;font-weight:600">Open Ebookvox</a></p><script>location.replace(${JSON.stringify(url)})</script></body>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    return NextResponse.redirect(new URL(done.next ?? "/home", base), 303);
  } catch (e) {
    console.error("[oauth]", provider, (e as Error).message);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", base), 303);
  }
}

export const GET = route(async (req, { params }: { params: Promise<{ provider: string }> }) => handle(req, (await params).provider, req.nextUrl.searchParams));
// Apple returns the code via a cross-site form POST, so the same-origin check is skipped here;
// the one-time `state` row in the database is what protects this endpoint.
export const POST = route(async (req, { params }: { params: Promise<{ provider: string }> }) => handle(req, (await params).provider, await req.formData()), { skipOrigin: true });
