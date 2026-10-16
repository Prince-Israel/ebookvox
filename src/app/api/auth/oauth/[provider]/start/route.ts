import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { buildAuthUrl, isConfigured, isProvider, safeNext } from "@/lib/oauth";

export const GET = route(async (req, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  if (!isProvider(provider)) return NextResponse.redirect(new URL("/sign-in?error=oauth_unknown", base));
  if (!isConfigured(provider)) return NextResponse.redirect(new URL(`/sign-in?error=${provider}_not_configured`, base));
  const sp = req.nextUrl.searchParams;
  return NextResponse.redirect(await buildAuthUrl(provider, { mobile: sp.get("mobile") === "1", next: safeNext(sp.get("next")) }));
});
