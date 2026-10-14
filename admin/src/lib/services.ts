import { createHash, createHmac } from "node:crypto";
import { db } from "./db";
import { ApiError } from "./api";

export type ServiceName = "reader" | "publisher";
const CONF: Record<ServiceName, { url: () => string | undefined; secret: () => string | undefined; label: string }> = {
  reader: { url: () => process.env.READER_URL, secret: () => process.env.READER_ADMIN_SECRET, label: "Reader" },
  publisher: { url: () => process.env.PUBLISHER_URL, secret: () => process.env.PUBLISHER_ADMIN_SECRET, label: "Publisher" },
};
export const serviceLabel = (s: ServiceName) => CONF[s].label;

export class ServiceError extends ApiError {
  constructor(public service: ServiceName, status: number, message: string, public down = false, public code?: string) {
    super(status, message);
  }
}

async function logError(service: ServiceName, operation: string, message: string) {
  console.error(`[service:${service}] ${operation}: ${message}`);
  try {
    await db.serviceErrorLog.create({ data: { service, operation: operation.slice(0, 200), message: message.slice(0, 500) } });
    const old = await db.serviceErrorLog.findMany({ orderBy: { createdAt: "desc" }, skip: 300, select: { id: true } });
    if (old.length) await db.serviceErrorLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  } catch {}
}

type Opts = { query?: Record<string, string | number | undefined | null>; body?: unknown; raw?: boolean; timeoutMs?: number };

/**
 * Signed server-to-server call. The signature covers timestamp, method, path+query and body hash, so a captured request
 * can't be altered or replayed after 60 seconds. Secrets never leave this process.
 */
export async function call<T = any>(service: ServiceName, method: string, path: string, opts: Opts = {}): Promise<T> {
  const c = CONF[service];
  const base = c.url(), secret = c.secret();
  if (!base || !secret) throw new ServiceError(service, 503, `${c.label} service is not configured.`, true);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const full = `/api/internal/${path}${qs.size ? `?${qs}` : ""}`;
  const body = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}\n${method}\n${full}\n${createHash("sha256").update(body).digest("hex")}`).digest("hex");
  let res: Response;
  try {
    res = await fetch(base.replace(/\/$/, "") + full, {
      method, body: body || undefined, cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      headers: { "x-svc-timestamp": ts, "x-svc-signature": sig, ...(body ? { "content-type": "application/json" } : {}) },
    });
  } catch (e) {
    await logError(service, `${method} ${path}`, (e as Error).message);
    throw new ServiceError(service, 502, `${c.label} service is temporarily unavailable.`, true);
  }
  if (opts.raw && res.ok) return res as unknown as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status >= 500 || res.status === 401 || res.status === 503) {
      await logError(service, `${method} ${path}`, `HTTP ${res.status}: ${data?.error ?? "no body"}`);
      throw new ServiceError(service, 502, res.status === 401 ? `${c.label} service rejected our credentials. Check the shared service secret.` : `${c.label} service is temporarily unavailable.`, true);
    }
    // 4xx = a business rule inside the service (e.g. "ticket is closed"): pass its message through.
    throw new ServiceError(service, res.status, data?.error ?? "The request was rejected.", false, data?.code);
  }
  return data as T;
}
export const reader = <T = any>(method: string, path: string, opts?: Opts) => call<T>("reader", method, path, opts);
export const publisher = <T = any>(method: string, path: string, opts?: Opts) => call<T>("publisher", method, path, opts);

/** Never lets a failing service be mistaken for an empty one. */
export async function settle<T>(service: ServiceName, fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; service: ServiceName; error: string }> {
  try { return { ok: true, data: await fn() }; }
  catch (e) { return { ok: false, service, error: e instanceof ApiError ? e.message : `${CONF[service].label} service is temporarily unavailable.` }; }
}

export async function health() {
  const probe = async (s: ServiceName) => {
    const t = Date.now();
    const r = await settle(s, () => call(s, "GET", "health", { timeoutMs: 5000 }));
    return { service: s, label: CONF[s].label, ok: r.ok, ms: Date.now() - t, error: r.ok ? null : r.error };
  };
  return Promise.all([probe("reader"), probe("publisher")]);
}
