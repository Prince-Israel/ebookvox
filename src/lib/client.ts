"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiFailure extends Error {
  constructor(message: string, public status = 0, public fields?: Record<string, string>) {
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
    if (typeof window !== "undefined" && !(window as unknown as { __signingOut?: boolean }).__signingOut) window.location.href = "/sign-in?expired=1";
    throw new ApiFailure("Your session has expired. Please sign in again.", 401);
  }
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiFailure(data?.error ?? "Something went wrong. Please try again.", res.status, data?.fields);
  return data as T;
}

export function useApi<T>(url: string | null, errorMessage = "We couldn't load this. Please try again.", initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial); // `initial` is what the server already rendered; it is refreshed for the signed-in viewer right after
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url && !initial);
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
      if (id === seq.current) setError(e instanceof ApiFailure && e.status && e.status < 500 && e.status !== 429 ? e.message : e instanceof ApiFailure && !e.status ? e.message : errorMessage);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [url, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
