"use client";
import { useEffect, useState } from "react";
import { Banner, Button, Input, Sheet, useToast } from "./ui";
import { api, ApiFailure } from "@/lib/client";

type P = { id: string; firstName: string; lastName: string; email: string; phone: string | null; country: string };
/** Edit sheet used for readers (kind="users") and publishers (kind="publishers"). */
export function UserEditSheet({ user, onClose, onSaved, kind = "users" }: { user: (P & { name?: string; bio?: string }) | null; onClose: () => void; onSaved: () => void; kind?: "users" | "publishers" }) {
  const toast = useToast();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", country: "", publisherName: "", bio: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => { if (user) { setF({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone ?? "", country: user.country, publisherName: user.name ?? "", bio: user.bio ?? "" }); setErr(null); setFields({}); } }, [user]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setFields({});
    try {
      const body = kind === "users" ? { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone || null, country: f.country.toUpperCase() } : { publisherName: f.publisherName, firstName: f.firstName, lastName: f.lastName, phone: f.phone, country: f.country.toUpperCase(), bio: f.bio };
      await api(`/api/${kind}/${user!.id}`, { method: "PATCH", json: body });
      toast("Saved."); onSaved();
    } catch (x) { setErr((x as ApiFailure).message); setFields((x as ApiFailure).fields ?? {}); }
    setBusy(false);
  }
  return (
    <Sheet open={!!user} onClose={onClose} title={kind === "users" ? "Edit user" : "Edit publisher"}>
      <form onSubmit={save} className="space-y-4" noValidate>
        {err && <Banner tone="danger">{err}</Banner>}
        {kind === "publishers" && <Input label="Publisher name" id="e-pub" value={f.publisherName} onChange={set("publisherName")} error={fields.publisherName} />}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="First name" id="e-first" value={f.firstName} onChange={set("firstName")} error={fields.firstName} /><Input label="Last name" id="e-last" value={f.lastName} onChange={set("lastName")} error={fields.lastName} /></div>
        {kind === "users" ? <Input label="Email" id="e-email" type="email" value={f.email} onChange={set("email")} error={fields.email} hint="Changing the email marks it unverified." /> : <Input label="Email" id="e-email" value={f.email} readOnly disabled />}
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Phone" id="e-phone" inputMode="tel" value={f.phone} onChange={set("phone")} error={fields.phone} /><Input label="Country (2-letter code)" id="e-country" maxLength={2} value={f.country} onChange={set("country")} error={fields.country} /></div>
        {kind === "publishers" && <Input label="Biography" id="e-bio" value={f.bio} onChange={set("bio")} error={fields.bio} />}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Save changes</Button>
      </form>
    </Sheet>
  );
}
