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
    await completeOAuth(provider, {
      state,
      code,
      appleUser: get("user"),
      acceptLanguage: req.headers.get("accept-language"),
      ipCountry: req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry"),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.redirect(new URL("/home", base), 303);
  } catch (e) {
    console.error("[oauth]", provider, (e as Error).message);
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", base), 303);
  }
}

export const GET = route(async (req, { params }: { params: Promise<{ provider: string }> }) => handle(req, (await params).provider, req.nextUrl.searchParams));
// Apple returns the code via a cross-site form POST, so the same-origin check is skipped here;
// the one-time `state` row in the database is what protects this endpoint.
export const POST = route(async (req, { params }: { params: Promise<{ provider: string }> }) => handle(req, (await params).provider, await req.formData()), { skipOrigin: true });
