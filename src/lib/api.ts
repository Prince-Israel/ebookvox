import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response | object | void>;

/** Wraps a route handler: JSON responses, same-origin check, uniform error mapping. */
export function route<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>, opts: { skipOrigin?: boolean } = {}) {
  return async (req: NextRequest, ctx: C) => {
    try {
      if (!opts.skipOrigin && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        if (origin) {
          const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
          if (new URL(origin).host !== host) throw new ApiError(403, "Request blocked: cross-site requests are not allowed.");
        }
      }
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, fields: e.fields }, { status: e.status });
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const i of e.issues) fields[String(i.path[0] ?? "form")] ??= i.message;
        return NextResponse.json({ error: Object.values(fields)[0] ?? "Please check your input.", fields }, { status: 400 });
      }
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "The request was not valid JSON.");
  }
}

const hits = new Map<string, number[]>();
/** Small in-process limiter; use a shared store (Redis) when running multiple instances. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");
  arr.push(now);
  hits.set(key, arr);
}

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
