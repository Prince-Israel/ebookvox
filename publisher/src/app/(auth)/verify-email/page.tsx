"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui";
import { api, ApiFailure } from "@/lib/client";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "bad">("working");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!token) { setState("bad"); setMsg("This verification link is incomplete."); return; }
    api("/api/auth/verify", { method: "POST", json: { token } })
      .then(() => setState("ok"))
      .catch((e: ApiFailure) => { setState("bad"); setMsg(e.message); });
  }, [token]);
  return (
    <div className="anim-up text-center">
      {state === "working" && <><Spinner className="mx-auto size-10 text-accent" /><h1 className="mt-5 text-3xl font-semibold">Verifying your email…</h1></>}
      {state === "ok" && (<><CheckCircle2 className="mx-auto size-16 text-success" /><h1 className="mt-5 text-3xl font-semibold">Email verified</h1><p className="mt-2 text-muted">Thanks! Your account is fully set up.</p><Link href="/dashboard" className="mt-6 inline-block rounded-full bg-primary px-8 py-3 font-medium text-primary-fg">Go to dashboard</Link></>)}
      {state === "bad" && (<><XCircle className="mx-auto size-16 text-danger" /><h1 className="mt-5 text-3xl font-semibold">Link not valid</h1><p className="mt-2 text-muted">{msg}</p><Link href="/dashboard" className="mt-6 inline-block font-semibold text-accent hover:underline">Go to dashboard</Link></>)}
    </div>
  );
}
export default function Page() {
  return <Suspense><Verify /></Suspense>;
}
