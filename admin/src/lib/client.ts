"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiFailure extends Error {
  constructor(message: string, public status = 0, public fields?: Record<string, string>, public service?: string, public code?: string) {
    super(message);
  }
}

/** fetch wrapper that always yields a human-readable error (never a bare "Failed to fetch"). */
export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiFailure("We couldn't reach Ebookvox. Check your internet connection and try again.");
  }
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    if (typeof window !== "undefined") window.location.href = "/login?expired=1";
    throw new ApiFailure("Your session has expired. Please sign in again.", 401);
  }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiFailure(data?.error ?? "Something went wrong. Please try again.", res.status, data?.fields, data?.service, data?.code);
  return data as T;
}

export function useApi<T>(url: string | null, errorMessage = "We couldn't load this. Please try again.") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await api<T>(url);
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e instanceof ApiFailure && e.service && e.status >= 500 ? `${errorMessage} ${e.message}` : e instanceof ApiFailure && e.status && e.status < 500 && e.status !== 429 ? e.message : e instanceof ApiFailure && !e.status ? e.message : errorMessage);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

/** multipart upload with progress (fetch can't report upload progress). */
export function upload<T = any>(url: string, method: "POST" | "PATCH", body: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => reject(new ApiFailure("We couldn't reach Ebookvox. Check your internet connection and try again."));
    x.ontimeout = () => reject(new ApiFailure("The upload took too long. Check your connection and try again."));
    x.onload = () => {
      let data: any = null;
      try { data = JSON.parse(x.responseText); } catch {}
      if (x.status === 401) { window.location.href = "/login?expired=1"; return reject(new ApiFailure("Your session has expired.", 401)); }
      if (x.status >= 200 && x.status < 300) resolve(data as T);
      else reject(new ApiFailure(data?.error ?? "The upload failed. Please try again.", x.status, data?.fields));
    };
    x.timeout = 5 * 60_000;
    x.send(body);
  });
}
